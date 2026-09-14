#!/usr/bin/env python3
"""フリーランス名鑑 (https://freelance-meikan.com/freelance) の全フリーランスを
スクレイピングし、OpenAI API でプロフィールを分析して CSV に出力する。

使い方:
    .venv/bin/python meikan_scraper.py scrape    # 一覧＋全プロフィール取得 (キー不要)
    .venv/bin/python meikan_scraper.py analyze   # OpenAI で分析 (OPENAI_API_KEY 必須)
    .venv/bin/python meikan_scraper.py export    # CSV 出力
    .venv/bin/python meikan_scraper.py all       # 上記を順に実行

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
ANALYSIS_FILE = DATA_DIR / "analysis.jsonl"
CSV_FILE = OUT_DIR / "meikan_freelancers.csv"

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


# ------------------------------------------------------------- 4. OpenAI 分析
ANALYSIS_PROMPT = """まず、プロフィールを具体的に分析してください。
このフリーランスの主な業種は何であり、自身の職業における専門性はどの程度か、つまり技術的な側面ではどの程度のレベルか？
このフリーランスが言及した自身の会社名は何か、その際の会社リンクは何か？
また、会社の資本金はいくらで、会社数はいくつか？連絡先情報は何か？

さらに、発注者・営業担当の視点で役立つ独自の分析（経験年数、主要実績、強み、想定顧客、事業形態、語学、リードとしての評価、アプローチ方法の提案）も行ってください。

【厳守事項】
- 情報はプロフィール本文・構造化データ・添付の会社サイト本文に書かれている内容のみを根拠にすること。推測で会社名・URL・資本金・連絡先を作らないこと。
- 記載がない項目は「不明」とすること（会社名がない場合は「なし」）。
- 資本金・会社数は明記されている場合のみ記入し、出典（プロフィール/会社サイト）を併記すること。
- 回答はすべて日本語。"""

ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "main_industry": {"type": "string", "description": "主な業種・職業"},
        "specialty": {"type": "string", "description": "具体的な専門分野・得意領域"},
        "expertise_level": {"type": "string", "enum": ["初級", "中級", "上級", "エキスパート", "判定不能"]},
        "technical_level_assessment": {"type": "string", "description": "技術レベルの評価と根拠"},
        "years_of_experience": {"type": "string"},
        "company_name": {"type": "string", "description": "本人が言及した自身の会社名。複数なら ; 区切り"},
        "company_url": {"type": "string", "description": "会社リンク。複数なら ; 区切り"},
        "role_in_company": {"type": "string", "description": "会社での役職 (代表取締役など)"},
        "capital": {"type": "string", "description": "資本金 (出典付き) または 不明"},
        "company_count": {"type": "string", "description": "関与・経営している会社数 または 不明"},
        "business_form": {"type": "string", "enum": ["法人代表", "法人所属", "個人事業主", "副業(会社員)", "不明"]},
        "contact_info": {"type": "string", "description": "本文・会社サイトから得た連絡先 (電話/メール/住所/予約フォーム/SNS等)"},
        "portfolio_urls": {"type": "string", "description": "ポートフォリオ・実績URL (; 区切り)"},
        "key_achievements": {"type": "string"},
        "strengths": {"type": "string"},
        "target_clients": {"type": "string", "description": "想定顧客・得意業界"},
        "languages": {"type": "string"},
        "lead_score": {"type": "integer", "description": "発注先/営業リードとしての有望度 1-5"},
        "lead_score_reason": {"type": "string"},
        "outreach_suggestion": {"type": "string", "description": "連絡・依頼時のアプローチ提案"},
        "summary": {"type": "string", "description": "100字程度の要約"},
    },
    "required": [
        "main_industry", "specialty", "expertise_level", "technical_level_assessment",
        "years_of_experience", "company_name", "company_url", "role_in_company", "capital",
        "company_count", "business_form", "contact_info", "portfolio_urls", "key_achievements",
        "strengths", "target_clients", "languages", "lead_score", "lead_score_reason",
        "outreach_suggestion", "summary",
    ],
}


def build_user_message(profile, company_pages):
    structured = {k: profile[k] for k in (
        "name", "profile_url", "status", "catchphrase", "job_types", "services", "hourly_rate",
        "industries", "prefecture", "skills", "qualifications", "phone", "email", "line",
        "twitter", "facebook", "youtube", "tiktok", "chatwork", "urls_in_profile", "interview_links",
    )}
    parts = [
        "## 構造化データ", json.dumps(structured, ensure_ascii=False, indent=1),
        "## 詳細プロフィール", profile["profile_text"][:8000] or "(なし)",
        "## 担当業務・得意業務", profile["work_text"][:4000] or "(なし)",
    ]
    for p in company_pages:
        parts += [f"## 会社サイト本文 ({p['url']})", p["text"]]
    return "\n\n".join(parts)


def analyze_all(model, workers, with_company_sites):
    from openai import OpenAI

    client = OpenAI()
    profiles = read_jsonl(PROFILES_FILE)
    done = read_jsonl(ANALYSIS_FILE)
    todo = [p for fid, p in profiles.items() if fid not in done]
    log(f"分析: 全{len(profiles)}件 / 済{len(done)}件 / 残り{len(todo)}件 (model={model})")

    def work(profile):
        pages = fetch_company_context(profile) if with_company_sites else []
        for attempt in range(1, 6):
            try:
                resp = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": ANALYSIS_PROMPT},
                        {"role": "user", "content": build_user_message(profile, pages)},
                    ],
                    response_format={"type": "json_schema", "json_schema": {
                        "name": "freelancer_analysis", "strict": True, "schema": ANALYSIS_SCHEMA}},
                )
                result = json.loads(resp.choices[0].message.content)
                result["id"] = profile["id"]
                result["company_site_pages"] = [p["url"] for p in pages]
                append_jsonl(ANALYSIS_FILE, result)
                return profile["name"]
            except Exception as e:
                if "invalid_api_key" in str(e) or "model_not_found" in str(e):
                    raise
                if attempt == 5:
                    log(f"  ! 分析失敗 id={profile['id']}: {e}")
                    return None
                time.sleep(3 * attempt)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(work, p) for p in todo]
        for n, fut in enumerate(as_completed(futures), 1):
            fut.result()
            if n % 20 == 0 or n == len(todo):
                log(f"  {n}/{len(todo)} 件分析完了")


# ------------------------------------------------------------------ 5. CSV 出力
CSV_COLUMNS = [
    ("id", "ID"), ("name", "氏名"), ("profile_url", "メイカンプロフィールURL"),
    ("avatar_url", "アバター画像URL"), ("status", "現在の対応状況"),
    ("main_industry", "基本業種(AI)"), ("specialty", "専門分野(AI)"),
    ("expertise_level", "専門性レベル(AI)"), ("technical_level_assessment", "技術レベル評価(AI)"),
    ("years_of_experience", "経験年数(AI)"),
    ("company_name", "会社名(AI)"), ("company_url", "会社リンク(AI)"),
    ("role_in_company", "会社での役職(AI)"), ("capital", "資本金(AI)"),
    ("company_count", "会社数(AI)"), ("business_form", "事業形態(AI)"),
    ("phone", "電話番号"), ("email", "メールアドレス"), ("line", "LINE"),
    ("twitter", "Twitter/X"), ("facebook", "Facebook"), ("youtube", "YouTube"),
    ("tiktok", "TikTok"), ("chatwork", "ChatWork"), ("contact_info", "連絡先情報(AI抽出)"),
    ("catchphrase", "キャッチコピー"), ("job_types", "職種"), ("services", "対応業務"),
    ("hourly_rate", "希望時給単価"), ("skills", "スキル"), ("industries", "得意業界"),
    ("prefecture", "在住都道府県"), ("qualifications", "資格"), ("likes", "いいね数"),
    ("blog_count", "ブログ数"), ("urls_in_profile", "プロフィール内URL"),
    ("portfolio_urls", "ポートフォリオURL(AI)"), ("key_achievements", "主要実績(AI)"),
    ("strengths", "強み(AI)"), ("target_clients", "想定顧客(AI)"), ("languages", "対応言語(AI)"),
    ("lead_score", "リード評価1-5(AI)"), ("lead_score_reason", "リード評価理由(AI)"),
    ("outreach_suggestion", "アプローチ提案(AI)"), ("summary", "要約(AI)"),
    ("company_site_pages", "参照した会社サイト"), ("profile_text", "詳細プロフィール全文"),
]


def export_csv(ids):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    profiles = read_jsonl(PROFILES_FILE)
    analysis = read_jsonl(ANALYSIS_FILE)
    order = [i for i in ids if i in profiles] + [i for i in profiles if i not in set(ids)]
    with CSV_FILE.open("w", encoding="utf-8-sig", newline="") as f:  # Excel で文字化けしないよう BOM 付き
        w = csv.writer(f)
        w.writerow([label for _, label in CSV_COLUMNS])
        for fid in order:
            row = {**profiles[fid], **analysis.get(fid, {})}
            w.writerow([
                "; ".join(v) if isinstance(v := row.get(key, ""), list) else v
                for key, _ in CSV_COLUMNS
            ])
    log(f"CSV出力: {CSV_FILE} ({len(order)}件, 分析済 {sum(1 for i in order if i in analysis)}件)")


def main():
    load_dotenv(ROOT / ".env")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["scrape", "analyze", "export", "all"])
    ap.add_argument("--model", default=os.getenv("OPENAI_MODEL", "gpt-5.4-mini"))
    ap.add_argument("--workers", type=int, default=6, help="OpenAI 並列リクエスト数")
    ap.add_argument("--no-company-sites", action="store_true", help="会社サイトの本文取得を行わない")
    ap.add_argument("--limit", type=int, default=0, help="テスト用: 先頭N件のみ処理")
    args = ap.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if args.command in ("scrape", "all"):
        ids = collect_ids()
    else:
        ids = json.loads(IDS_FILE.read_text(encoding="utf-8")) if IDS_FILE.exists() else []
    if args.limit:
        ids = ids[: args.limit]

    if args.command in ("scrape", "all"):
        scrape_profiles(ids)
    if args.command in ("analyze", "all"):
        if not os.getenv("OPENAI_API_KEY"):
            sys.exit("OPENAI_API_KEY が .env に設定されていません")
        analyze_all(args.model, args.workers, not args.no_company_sites)
    if args.command in ("export", "all", "analyze", "scrape"):
        export_csv(ids)


if __name__ == "__main__":
    main()
