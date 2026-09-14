#!/usr/bin/env python3
"""フリーランス名鑑 (https://freelance-meikan.com/freelance) の全フリーランスを
スクレイピングし、OpenAI API でプロフィールを分析して CSV に出力する。

使い方:
    .venv/bin/python meikan_scraper.py scrape         # 一覧＋全プロフィール取得 (キー不要)
    .venv/bin/python meikan_scraper.py analyze        # プロフィール分析 (職業・経歴・実績・会社)
    .venv/bin/python meikan_scraper.py find-company   # 会社名はあるがURL不明の人をWeb検索で補完
    .venv/bin/python meikan_scraper.py export         # CSV 出力
    .venv/bin/python meikan_scraper.py all            # 上記を順に実行

各段階はキャッシュ/JSONL に保存されるため、中断しても再実行で続きから再開できる。
"""

import argparse
import csv
import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urldefrag, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

BASE = "https://freelance-meikan.com"
LIST_URL = BASE + "/freelance"
ROOT = Path(__file__).resolve().parent
HTML_DIR = ROOT / "cache" / "html"
SITE_DIR = ROOT / "cache" / "company_sites"
DATA_DIR = ROOT / "data"
OUT_DIR = ROOT / "output"
IDS_FILE = DATA_DIR / "ids.json"
PROFILES_FILE = DATA_DIR / "profiles.jsonl"
ANALYSIS_FILE = DATA_DIR / "analysis_sol.jsonl"
COMPANY_SEARCH_FILE = DATA_DIR / "company_search.jsonl"
CSV_FILE = OUT_DIR / "meikan_freelancers.csv"

DEFAULT_MODEL = "gpt-5.6-sol"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept-Language": "ja,en;q=0.8",
}
REQUEST_DELAY = 0.6  # サイトへの負荷を抑えるための待機秒数

CONTACT_KEYS = {
    "電話番号": "phone",
    "メールアドレス": "email",
    "Line": "line",
    "Twitter": "twitter",
    "Facebook": "facebook",
    "YouTube": "youtube",
    "TikTok": "tiktok",
    "ChatWork": "chatwork",
}

# 会社サイトとして扱わないドメイン (SNS・フォーム・ポートフォリオ共有サービス等)
NON_COMPANY_DOMAINS = (
    "freelance-meikan.com", "twitter.com", "x.com", "facebook.com", "instagram.com",
    "youtube.com", "youtu.be", "tiktok.com", "line.me", "lin.ee", "forms.gle",
    "docs.google.com", "drive.google.com", "note.com", "lancers.jp", "crowdworks.jp",
    "coconala.com", "linkedin.com", "github.com", "wantedly.com", "amazon.co.jp",
    "bit.ly", "canva.com", "notion.site", "chatwork.com", "timerex.net",
)

URL_RE = re.compile(r"https?://[^\s<>\"'　、。）)」]+")

session = requests.Session()
session.headers.update(HEADERS)
write_lock = threading.Lock()


def log(msg):
    print(msg, flush=True)


def fetch(url, retries=3, timeout=30):
    for attempt in range(1, retries + 1):
        try:
            r = session.get(url, timeout=timeout)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            r.encoding = r.apparent_encoding if r.encoding in (None, "ISO-8859-1") else r.encoding
            return r.text
        except requests.RequestException as e:
            if attempt == retries:
                log(f"  ! 取得失敗 {url}: {e}")
                return None
            time.sleep(2 * attempt)


def clean(text):
    if text is None:
        return ""
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text.strip()


def read_jsonl(path):
    rows = {}
    if path.exists():
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    obj = json.loads(line)
                    rows[str(obj["id"])] = obj
    return rows


def append_jsonl(path, obj):
    with write_lock, path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def is_blank(value):
    return not value or re.match(r"^\s*(不明|なし|該当なし|記載なし)", value) is not None


# ---------------------------------------------------------------- 1. 一覧取得
def collect_ids():
    first = fetch(LIST_URL)
    soup = BeautifulSoup(first, "lxml")
    pages = [int(m.group(1)) for a in soup.select("a[href]")
             if (m := re.search(r"/freelance/page/(\d+)$", a["href"]))]
    last_page = max(pages) if pages else 1
    log(f"一覧ページ数: {last_page}")

    ids = []
    seen = set()
    for page in range(1, last_page + 1):
        html = first if page == 1 else fetch(f"{LIST_URL}/page/{page}")
        if page != 1:
            time.sleep(REQUEST_DELAY)
        if not html:
            continue
        psoup = BeautifulSoup(html, "lxml")
        found = 0
        for a in psoup.select("a.freelancer-box[href]"):
            m = re.search(r"/freelance/(\d+)$", a["href"])
            if m and m.group(1) not in seen:
                seen.add(m.group(1))
                ids.append(m.group(1))
                found += 1
        log(f"  page {page}/{last_page}: +{found} (累計 {len(ids)})")
    IDS_FILE.write_text(json.dumps(ids, ensure_ascii=False), encoding="utf-8")
    return ids


# ---------------------------------------------------------- 2. プロフィール解析
def dl_value_map(container):
    result = {}
    if not container:
        return result
    for dl in container.find_all("dl", recursive=False):
        dt, dd = dl.find("dt"), dl.find("dd")
        if dt and dd:
            result[clean(dt.get_text())] = dd
    return result


def parse_profile(fid, html):
    soup = BeautifulSoup(html, "lxml")
    fv = soup.select_one(".fv")
    name_el = soup.select_one("h1.name")
    status_el = soup.select_one(".status-block dd")
    likes_el = soup.select_one(".status-block .number")
    avatar_el = soup.select_one(".fv .right img") or soup.select_one(".fv .only-sp img")
    appeal_el = soup.select_one(".fv p.appeal")

    fields = dl_value_map(fv.select_one(".bottom .left") if fv else None)

    def joined(key, sep=" / "):
        dd = fields.get(key)
        if not dd:
            return ""
        parts = [clean(x.get_text()) for x in dd.find_all(["a", "p", "span"], recursive=True)
                 if not x.find(["a", "p", "span"]) and "もっと見る" not in x.get_text()]
        parts = [p for p in parts if p and p != "・"]
        return sep.join(dict.fromkeys(parts)) if parts else clean(dd.get_text())

    def section_text(sec_id):
        el = soup.select_one(f"#{sec_id} .text")
        return clean(el.get_text("\n")) if el else ""

    skills = [clean(p.get_text()) for p in soup.select("#skill .skill-list")]

    contacts = {v: "" for v in CONTACT_KEYS.values()}
    for a in soup.select("#contact a"):
        dd = a.find("dd")
        if not dd:
            continue
        span = dd.find("span")
        value = clean(span.get_text()) if span else ""
        label = clean(dd.get_text().replace(value, "", 1)) if value else clean(dd.get_text())
        key = CONTACT_KEYS.get(label)
        if not key or value in ("", "未登録"):
            continue
        href = a.get("href", "")
        if href.startswith("http") and key in ("twitter", "facebook", "youtube", "tiktok"):
            value = href
        contacts[key] = value

    interview_links = [a["href"] for a in soup.select(".interview a[href]")]
    blog_count = len(soup.select("#blog-content .slider-box a[href*='/blog/']"))

    profile_text = section_text("profile")
    work_text = section_text("workhistory")
    urls = list(dict.fromkeys(URL_RE.findall(profile_text + "\n" + work_text)))

    return {
        "id": fid,
        "name": clean(name_el.get_text()) if name_el else "",
        "profile_url": f"{BASE}/freelance/{fid}",
        "avatar_url": urljoin(BASE, avatar_el["src"]) if avatar_el else "",
        "status": clean(status_el.get_text()) if status_el else "",
        "likes": clean(likes_el.get_text()) if likes_el else "",
        "catchphrase": clean(appeal_el.get_text()) if appeal_el else "",
        "job_types": joined("職種"),
        "services": joined("対応業務", sep="・"),
        "hourly_rate": clean(fields["希望時給単価"].get_text()) if "希望時給単価" in fields else "",
        "industries": joined("得意業界"),
        "prefecture": joined("在住都道府県"),
        "skills": " / ".join(skills),
        "qualifications": section_text("qualification"),
        "profile_text": profile_text,
        "work_text": work_text,
        "urls_in_profile": urls,
        "interview_links": interview_links,
        "blog_count": blog_count,
        **contacts,
    }


def scrape_profiles(ids):
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    done = read_jsonl(PROFILES_FILE)
    todo = [i for i in ids if i not in done]
    log(f"プロフィール: 全{len(ids)}件 / 取得済{len(done)}件 / 残り{len(todo)}件")
    for n, fid in enumerate(todo, 1):
        cache = HTML_DIR / f"{fid}.html"
        if cache.exists():
            html = cache.read_text(encoding="utf-8")
        else:
            html = fetch(f"{BASE}/freelance/{fid}")
            time.sleep(REQUEST_DELAY)
            if not html:
                continue
            cache.write_text(html, encoding="utf-8")
        try:
            profile = parse_profile(fid, html)
        except Exception as e:  # 1件の解析失敗で全体を止めない
            log(f"  ! 解析失敗 id={fid}: {e}")
            continue
        append_jsonl(PROFILES_FILE, profile)
        if n % 25 == 0 or n == len(todo):
            log(f"  {n}/{len(todo)} 件取得 (最新: {profile['name']})")


# ---------------------------------------------------------- 3. 会社サイト取得
def is_company_candidate(url):
    host = urlparse(url).netloc.lower()
    return host and not any(host == d or host.endswith("." + d) for d in NON_COMPANY_DOMAINS)


def page_text(html, limit):
    soup = BeautifulSoup(html, "lxml")
    for t in soup(["script", "style", "noscript", "svg"]):
        t.decompose()
    return clean(soup.get_text("\n"))[:limit]


def fetch_company_context(profile):
    """プロフィール内の会社サイトらしきURLのトップページと会社概要ページの本文を取得。"""
    SITE_DIR.mkdir(parents=True, exist_ok=True)
    cache = SITE_DIR / f"{profile['id']}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))

    pages = []
    for url in [u for u in profile["urls_in_profile"] if is_company_candidate(u)][:2]:
        html = fetch(url, retries=1, timeout=12)
        if not html:
            continue
        pages.append({"url": url, "text": page_text(html, 3000)})
        soup = BeautifulSoup(html, "lxml")
        for a in soup.select("a[href]"):
            label = clean(a.get_text())
            href = urldefrag(urljoin(url, a["href"])).url
            if (re.search(r"会社概要|会社情報|企業情報|運営会社|特定商取引|about|company|profile", label + href, re.I)
                    and urlparse(href).netloc == urlparse(url).netloc
                    and href.rstrip("/") != urldefrag(url).url.rstrip("/")):
                sub = fetch(href, retries=1, timeout=12)
                if sub:
                    pages.append({"url": href, "text": page_text(sub, 3000)})
                break
    cache.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    return pages


# ------------------------------------------------------------- 4. プロフィール分析
ANALYSIS_PROMPT = """あなたはフリーランス人材のプロフィール調査を行うアナリストです。
与えられたプロフィールを具体的に分析し、次の「最も必要な情報」だけを抽出してください。

1. 職業: この人物の現在の職業・肩書きを一言で (例: 「株式会社〇〇 代表取締役 / Webマーケター」「フリーランスのフロントエンドエンジニア」)
2. 現在の仕事内容: 現在どのような仕事・事業をしているかを具体的に
3. 経歴: 学歴・勤務先・役職・独立/創業などを時系列で具体的に (年や期間が書かれていれば含める)
4. 過去の実績: 支援社数、売上改善、開発したサービス名、取引先、受賞など、数値や固有名詞を含めて具体的に
5. 専門性レベル: 経歴と実績から判断
6. 会社: 本人が代表取締役・取締役・経営者・創業者などを務めている(または務めていた)会社。
   「某株式会社の代表取締役」のように書かれていれば、その会社名と役職を抽出する。
   本人が役員ではなく単に所属・勤務しているだけの会社は role に「所属」と書く。
   会社リンクはプロフィール本文や会社サイト本文に URL が書かれている場合のみ記入する。

【厳守事項】
- 根拠はプロフィール本文・構造化データ・添付の会社サイト本文に書かれている内容のみ。推測で会社名・URL・実績を作らない。
- 「某大手企業」「東証プライム企業」「大手広告代理店」のように社名が伏せられている・一般名詞の場合は companies に含めない (経歴には書いてよい)。
- 記載がない項目は空文字にする (「不明」とは書かない)。
- 回答はすべて日本語。箇条書きにする場合は「・」で始めて改行区切りにする。"""

ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "occupation": {"type": "string", "description": "現在の職業・肩書き (一言)"},
        "current_work": {"type": "string", "description": "現在の仕事内容 (具体的に)"},
        "career_history": {"type": "string", "description": "経歴 (時系列)"},
        "past_achievements": {"type": "string", "description": "過去の実績 (数値・固有名詞を含めて)"},
        "expertise_level": {"type": "string", "enum": ["エキスパート", "上級", "中級", "初級", "判定不能"]},
        "companies": {
            "type": "array",
            "description": "本人が代表・役員・経営・創業・所属している会社。なければ空配列",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string", "description": "正式な会社名"},
                    "role": {"type": "string", "description": "代表取締役 / 取締役 / 創業者 / 所属 など"},
                    "is_current": {"type": "boolean", "description": "現在も務めている/所属しているか"},
                    "url": {"type": "string", "description": "本文に書かれた会社URL。なければ空文字"},
                    "url_source": {"type": "string", "enum": ["プロフィール記載", "会社サイト本文", ""]},
                },
                "required": ["name", "role", "is_current", "url", "url_source"],
            },
        },
    },
    "required": ["occupation", "current_work", "career_history", "past_achievements", "expertise_level", "companies"],
}


def build_user_message(profile, company_pages):
    structured = {k: profile[k] for k in (
        "name", "catchphrase", "job_types", "services", "industries", "prefecture", "skills",
        "qualifications", "urls_in_profile", "interview_links",
    )}
    parts = [
        "## 構造化データ", json.dumps(structured, ensure_ascii=False, indent=1),
        "## 詳細プロフィール", profile["profile_text"][:10000] or "(なし)",
        "## 担当業務・得意業務", profile["work_text"][:5000] or "(なし)",
    ]
    for p in company_pages:
        parts += [f"## 会社サイト本文 ({p['url']})", p["text"]]
    return "\n\n".join(parts)


def run_parallel(items, work, workers, label):
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(work, item) for item in items]
        for n, fut in enumerate(as_completed(futures), 1):
            fut.result()
            if n % 20 == 0 or n == len(items):
                log(f"  {n}/{len(items)} 件{label}完了")


def with_retries(fn, what):
    for attempt in range(1, 6):
        try:
            return fn()
        except Exception as e:
            if any(s in str(e) for s in ("invalid_api_key", "model_not_found", "insufficient_quota")):
                raise
            if attempt == 5:
                log(f"  ! {what} 失敗: {e}")
                return None
            time.sleep(4 * attempt)


def analyze_all(client, model, workers, ids):
    profiles = read_jsonl(PROFILES_FILE)
    done = read_jsonl(ANALYSIS_FILE)
    todo = [profiles[i] for i in ids if i in profiles and i not in done]
    log(f"分析: 対象{len(ids)}件 / 済{len(done)}件 / 残り{len(todo)}件 (model={model})")

    def work(profile):
        pages = fetch_company_context(profile)

        def call():
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": ANALYSIS_PROMPT},
                    {"role": "user", "content": build_user_message(profile, pages)},
                ],
                response_format={"type": "json_schema", "json_schema": {
                    "name": "freelancer_analysis", "strict": True, "schema": ANALYSIS_SCHEMA}},
            )
            return json.loads(resp.choices[0].message.content)

        result = with_retries(call, f"分析 id={profile['id']}")
        if result is not None:
            result.update(id=profile["id"], model=model, company_site_pages=[p["url"] for p in pages])
            append_jsonl(ANALYSIS_FILE, result)

    run_parallel(todo, work, workers, "分析")


# ------------------------------------------------------- 5. 会社URLのWeb検索補完
COMPANY_SEARCH_PROMPT = """あなたは企業調査の担当者です。Web検索を使って、指定された人物が代表・役員・経営・所属している会社の公式サイトURLを特定してください。

【厳守事項】
- 同名の別会社と取り違えないこと。代表者名・役員名・事業内容・所在地などが人物情報と一致することを確認できた場合のみ採用する。
- 公式サイト (コーポレートサイト、または会社が運営する公式サービスサイト) のみを採用する。
  求人サイト、SNS、フリーランス名鑑、企業データベース、ニュース記事、PR TIMES 等は公式サイトとして扱わない。
- 確証が持てない場合は url を空文字にし、confidence を low にする。
- evidence には、一致を確認した根拠 (例: 「会社概要の代表者名が一致」) と参照したURLを日本語で簡潔に書く。"""

COMPANY_SEARCH_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "company_name": {"type": "string"},
                    "url": {"type": "string"},
                    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    "evidence": {"type": "string"},
                },
                "required": ["company_name", "url", "confidence", "evidence"],
            },
        },
    },
    "required": ["results"],
}


def is_executive(company):
    """代表・役員・創業者・パートナーなど、単なる勤務先 (所属) ではない会社か。"""
    return bool(company["name"].strip()) and not company["role"].strip().startswith("所属") \
        and not re.match(r"^(某|東証|大手)", company["name"].strip())


def companies_missing_url(analysis):
    return [c for c in analysis.get("companies", []) if is_executive(c) and not c["url"].strip()]


def find_company_urls(client, model, workers, ids):
    profiles = read_jsonl(PROFILES_FILE)
    analysis = read_jsonl(ANALYSIS_FILE)
    done = read_jsonl(COMPANY_SEARCH_FILE)
    todo = [i for i in ids if i in analysis and i not in done and companies_missing_url(analysis[i])]
    log(f"会社URL検索: 対象{len(todo)}件 (会社名あり・URLなし) / 済{len(done)}件 (model={model})")

    def work(fid):
        p, a = profiles[fid], analysis[fid]
        query = {
            "人物名": p["name"], "在住都道府県": p["prefecture"], "職業": a["occupation"],
            "現在の仕事内容": a["current_work"][:600], "経歴": a["career_history"][:600],
            "調べる会社": [{"会社名": c["name"], "役職": c["role"]} for c in companies_missing_url(a)],
        }

        def call():
            resp = client.responses.create(
                model=model,
                tools=[{"type": "web_search"}],
                instructions=COMPANY_SEARCH_PROMPT,
                input=json.dumps(query, ensure_ascii=False, indent=1),
                text={"format": {"type": "json_schema", "name": "company_urls", "strict": True,
                                 "schema": COMPANY_SEARCH_SCHEMA}},
            )
            return json.loads(resp.output_text)

        result = with_retries(call, f"会社URL検索 id={fid}")
        if result is not None:
            append_jsonl(COMPANY_SEARCH_FILE, {"id": fid, "model": model, **result})

    run_parallel(todo, work, workers, "検索")


# ------------------------------------------------------------------ 6. CSV 出力
CSV_COLUMNS = [
    "ID", "氏名", "メイカンプロフィールURL", "アバター画像URL", "現在の対応状況",
    "職業(AI)", "現在の仕事内容(AI)", "経歴(AI)", "過去の実績(AI)", "専門性レベル(AI)",
    "会社名(AI)", "役職(AI)", "会社リンク(AI)", "会社リンク出典(AI)",
    "電話番号", "メールアドレス", "LINE", "Twitter/X", "Facebook", "YouTube", "TikTok", "ChatWork",
    "キャッチコピー", "職種", "希望時給単価", "スキル", "在住都道府県",
]


def merge_companies(analysis, search):
    """分析結果の会社一覧に、Web検索で見つかったURL (確度 high/medium) を補完する。"""
    found = {}
    for r in (search or {}).get("results", []):
        if r["url"].startswith("http") and r["confidence"] in ("high", "medium"):
            found[r["company_name"].strip()] = r
    companies = []
    for c in filter(is_executive, analysis.get("companies", [])):  # 過去の勤務先は経歴欄に記載済み
        c = dict(c)
        if not c["url"] and c["name"].strip() in found:
            hit = found[c["name"].strip()]
            c["url"], c["url_source"] = hit["url"], f"Web検索 (確度: {hit['confidence']})"
        companies.append(c)
    return sorted(companies, key=lambda c: not c["is_current"])  # 現在の役職を先に


def export_csv(ids):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    profiles = read_jsonl(PROFILES_FILE)
    analysis = read_jsonl(ANALYSIS_FILE)
    search = read_jsonl(COMPANY_SEARCH_FILE)
    order = [i for i in ids if i in profiles] + [i for i in profiles if i not in set(ids)]

    with CSV_FILE.open("w", encoding="utf-8-sig", newline="") as f:  # Excel で文字化けしないよう BOM 付き
        w = csv.writer(f)
        w.writerow(CSV_COLUMNS)
        for fid in order:
            p, a = profiles[fid], analysis.get(fid, {})
            companies = merge_companies(a, search.get(fid))
            role_of = lambda c: c["role"] + ("" if c["is_current"] else " (過去)")
            w.writerow([
                # 一部の画像URLはサイト側で /storage/storage/ と重複しており 404 になるため補正
                fid, p["name"], p["profile_url"], p["avatar_url"].replace("/storage/storage/", "/storage/"), p["status"],
                a.get("occupation", ""), a.get("current_work", ""), a.get("career_history", ""),
                a.get("past_achievements", ""), a.get("expertise_level", ""),
                "; ".join(c["name"] for c in companies),
                "; ".join(role_of(c) for c in companies),
                "; ".join(c["url"] for c in companies if c["url"]),
                "; ".join(c["url_source"] for c in companies if c["url"]),
                p["phone"], p["email"], p["line"], p["twitter"], p["facebook"], p["youtube"],
                p["tiktok"], p["chatwork"], p["catchphrase"], p["job_types"], p["hourly_rate"],
                p["skills"], p["prefecture"],
            ])
    log(f"CSV出力: {CSV_FILE} ({len(order)}件, 分析済 {sum(1 for i in order if i in analysis)}件, "
        f"会社URL検索済 {sum(1 for i in order if i in search)}件)")


def main():
    load_dotenv(ROOT / ".env")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["scrape", "analyze", "find-company", "export", "all"])
    ap.add_argument("--model", default=os.getenv("OPENAI_MODEL", DEFAULT_MODEL))
    ap.add_argument("--workers", type=int, default=8, help="OpenAI 並列リクエスト数")
    ap.add_argument("--ids", default="", help="テスト用: カンマ区切りのIDだけ処理")
    args = ap.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if args.command in ("scrape", "all"):
        ids = collect_ids()
        scrape_profiles(ids)
    else:
        ids = json.loads(IDS_FILE.read_text(encoding="utf-8")) if IDS_FILE.exists() else []
    target_ids = [i.strip() for i in args.ids.split(",") if i.strip()] or ids

    if args.command in ("analyze", "find-company", "all"):
        if not os.getenv("OPENAI_API_KEY"):
            sys.exit("OPENAI_API_KEY が .env に設定されていません")
        from openai import OpenAI
        client = OpenAI()
        if args.command in ("analyze", "all"):
            analyze_all(client, args.model, args.workers, target_ids)
        if args.command in ("find-company", "all"):
            find_company_urls(client, args.model, args.workers, target_ids)
    export_csv(ids)


if __name__ == "__main__":
    main()
