"use client";

import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import Icon from "@/components/Icon";
import { PIN_LENGTH, UNLOCK_FLAG } from "@/lib/lock-shared";

type Phase = "idle" | "checking" | "error" | "unlocking" | "opening" | "flash";
type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;

// 描画のたびに変わらないよう、光の粒の配置は番号から決める
const MOTES: StyleWithVars[] = Array.from({ length: 30 }, (_, i) => {
  const size = 2 + ((i * 7) % 4);
  return {
    left: `${(i * 37 + 11) % 100}%`,
    width: size,
    height: size,
    animationDuration: `${10 + ((i * 13) % 12)}s`,
    animationDelay: `-${(i * 29) % 14}s`,
    "--dx": `${((i * 23) % 80) - 40}px`,
  };
});

const BURST: StyleWithVars[] = Array.from({ length: 44 }, (_, i) => ({
  "--a": `${i * (360 / 44)}deg`,
  "--d": `${130 + ((i * 53) % 120)}px`,
  "--delay": `${(i * 17) % 180}ms`,
}));

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// 解錠演出の時間配分 (ms): 錠前が開く → 扉が開く → 閃光 → メイン画面へ
const TIMELINE = { opening: 1150, flash: 3000, navigate: 3750 };
const TIMELINE_REDUCED = { opening: 150, flash: 350, navigate: 700 };

export default function LockScreen() {
  const [pin, setPin] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const audioRef = useRef<Chime | null>(null);

  const busy = phase !== "idle";

  // マウス操作の端末では入力欄に自動でフォーカス (タッチ端末はテンキーを使う)
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, []);

  async function submit(value: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    // 音はユーザー操作の中で準備しておく必要がある
    if (soundOn) {
      audioRef.current ??= createChime();
      void audioRef.current?.context.resume();
    }
    setMessage("照合しています…");
    setPhase("checking");

    let status: "ok" | "wrong" | "network" = "network";
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      status = res.ok ? "ok" : "wrong";
    } catch {
      status = "network";
    }

    if (status !== "ok") {
      setPhase("error");
      setMessage(status === "wrong" ? "PINコードが正しくありません" : "通信に失敗しました。もう一度お試しください");
      setTimeout(() => {
        setPin("");
        setPhase("idle");
        busyRef.current = false;
        inputRef.current?.focus({ preventScroll: true });
      }, 950);
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = reduced ? TIMELINE_REDUCED : TIMELINE;
    if (soundOn) audioRef.current?.play();
    setMessage("解錠しました");
    setPhase("unlocking");
    setTimeout(() => setPhase("opening"), timeline.opening);
    setTimeout(() => setPhase("flash"), timeline.flash);
    setTimeout(() => {
      try {
        sessionStorage.setItem(UNLOCK_FLAG, "1");
      } catch {
        // 保存できなくても遷移は続ける
      }
      window.location.reload();
    }, timeline.navigate);
  }

  function update(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (phase === "idle" && message) setMessage("");
    if (digits.length === PIN_LENGTH) void submit(digits);
  }

  const onInput = (e: ChangeEvent<HTMLInputElement>) => update(e.target.value);
  const press = (digit: string) => !busy && update(pin + digit);
  const erase = () => !busy && setPin((p) => p.slice(0, -1));
  const clear = () => !busy && setPin("");
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy && pin) void submit(pin);
  };

  return (
    <div className="lock-root" data-phase={phase}>
      <div aria-hidden className="lock-scene" />
      <div aria-hidden className="lock-rays" />
      <div aria-hidden className="lock-light" />
      <div aria-hidden className="lock-doors">
        <div className="lock-door lock-door-left">
          <span className="lock-door-frame" />
          <span className="lock-door-handle" />
        </div>
        <div className="lock-door lock-door-right">
          <span className="lock-door-frame" />
          <span className="lock-door-handle" />
        </div>
      </div>
      <div aria-hidden className="lock-motes">
        {MOTES.map((style, i) => (
          <span key={i} style={style} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSoundOn((v) => !v)}
        aria-pressed={soundOn}
        aria-label={soundOn ? "解錠音をオフにする" : "解錠音をオンにする"}
        title={soundOn ? "解錠音: オン" : "解錠音: オフ"}
        className="gold-outline absolute right-4 top-4 z-40 grid size-10 place-items-center rounded-full text-gold backdrop-blur transition hover:border-gold hover:text-gold-light"
      >
        <Icon name={soundOn ? "sound" : "mute"} className="size-5" />
      </button>

      <main className="lock-content">
        <div className="flex w-full max-w-md flex-col items-center px-5 py-8 text-center">
          <p className="gold-outline flex items-center gap-2.5 rounded-full bg-[#060913]/90 py-1.5 pl-1.5 pr-4 font-serif text-sm font-bold tracking-[0.2em] text-gold-light sm:text-base">
            <span className="gold-fill grid size-7 place-items-center rounded-full font-serif text-sm font-extrabold tracking-normal">名</span>
            フリーランス名鑑 データベース
          </p>

          <div className="lock-emblem mt-5">
            <div aria-hidden className="lock-halo" />
            <Sigil />
            <div className="absolute inset-0 grid place-items-center">
              <Padlock />
            </div>
            <span aria-hidden className="lock-ring" />
            <span aria-hidden className="lock-ring" />
            <div aria-hidden className="lock-burst">
              {BURST.map((style, i) => (
                <span key={i} style={style} />
              ))}
            </div>
          </div>

          <div className="lock-panel mt-4 w-full rounded-3xl px-5 pb-5 pt-4 sm:px-7">
          <p className="font-serif text-[11px] font-bold tracking-[0.5em] text-gold">PRIVATE ARCHIVE</p>
          <h1 className="gold-text mt-2 font-serif text-2xl font-extrabold tracking-wider drop-shadow-[0_4px_18px_rgba(0,0,0,0.8)] sm:text-3xl">
            封印を解くPINコード
          </h1>
          <p className="mt-2 text-sm text-ink/75 [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
            この名鑑は、許可された方のみ閲覧できます
          </p>

          <form onSubmit={onSubmit} className="mt-4 w-full">
            <label htmlFor="pin" className="sr-only">
              PINコード（{PIN_LENGTH}桁）
            </label>
            <input
              ref={inputRef}
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={onInput}
              disabled={busy}
              className="sr-only"
            />
            <div aria-hidden className="lock-slots" onClick={() => inputRef.current?.focus({ preventScroll: true })}>
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <span
                  key={i}
                  className="lock-slot"
                  data-filled={i < pin.length ? "" : undefined}
                  data-current={!busy && i === pin.length ? "" : undefined}
                  style={{ "--i": i } as StyleWithVars}
                />
              ))}
            </div>
            <p
              aria-live="polite"
              className={`mt-1 h-5 text-sm font-medium [text-shadow:0_2px_10px_rgba(0,0,0,0.9)] ${
                phase === "error" ? "text-rose-300" : "text-gold-light"
              }`}
            >
              {message || `${pin.length} / ${PIN_LENGTH} 桁`}
            </p>

            <div className="mx-auto mt-4 grid max-w-[17.5rem] grid-cols-3 gap-3">
              {KEYS.map((key) => (
                <button key={key} type="button" onClick={() => press(key)} disabled={busy} className="lock-key">
                  {key}
                </button>
              ))}
              <button type="button" onClick={clear} disabled={busy} className="lock-key" aria-label="すべて消去">
                <span className="lock-key-sub">消去</span>
              </button>
              <button type="button" onClick={() => press("0")} disabled={busy} className="lock-key">
                0
              </button>
              <button type="button" onClick={erase} disabled={busy} className="lock-key" aria-label="1文字消す">
                <Icon name="backspace" className="size-6 text-gold" />
              </button>
            </div>

            <button
              type="submit"
              disabled={busy || !pin}
              className="gold-fill mx-auto mt-5 flex w-full max-w-[17.5rem] items-center justify-center gap-2 rounded-2xl py-3.5 font-serif text-lg font-bold tracking-[0.3em] transition hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
            >
              <Icon name="lock" className="size-5" />
              解錠する
            </button>
          </form>
          </div>
        </div>
      </main>

      <div aria-hidden className="lock-welcome">
        <p className="lock-welcome-title">ようこそ</p>
        <p className="lock-welcome-sub">フリーランス名鑑 データベースへ</p>
      </div>
      <div aria-hidden className="lock-flash" />
    </div>
  );
}

// ---------------------------------------------------------------- 紋章と錠前

function Sigil() {
  return (
    <svg viewBox="0 0 240 240" className="lock-sigil" fill="none" stroke="currentColor" aria-hidden>
      <defs>
        <path id="sigil-text-path" d="M120 120 m-99 0 a99 99 0 1 1 198 0 a99 99 0 1 1 -198 0" />
      </defs>
      <g className="sigil-outer">
        <circle cx="120" cy="120" r="117" strokeOpacity="0.35" />
        <circle cx="120" cy="120" r="111" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="1 5" />
        <text fill="currentColor" stroke="none" fillOpacity="0.75" fontSize="8.5" fontWeight="700" letterSpacing="2">
          <textPath href="#sigil-text-path" textLength="618" lengthAdjust="spacing">
            FREELANCE MEIKAN ✦ PRIVATE ARCHIVE ✦ FREELANCE MEIKAN ✦ PRIVATE ARCHIVE ✦
          </textPath>
        </text>
        <circle cx="120" cy="120" r="90" strokeOpacity="0.45" />
      </g>
      <g className="sigil-inner">
        {Array.from({ length: 24 }, (_, i) => (
          <path
            key={i}
            d={i % 2 ? "M120 36 v5" : "M120 34 v10"}
            strokeOpacity={i % 2 ? 0.4 : 0.8}
            transform={`rotate(${i * 15} 120 120)`}
          />
        ))}
        {Array.from({ length: 4 }, (_, i) => (
          <path
            key={i}
            d="M120 24 l5 7 -5 7 -5 -7z"
            fill="currentColor"
            fillOpacity="0.85"
            stroke="none"
            transform={`rotate(${i * 90} 120 120)`}
          />
        ))}
        <rect x="66" y="66" width="108" height="108" strokeOpacity="0.28" transform="rotate(45 120 120)" />
        <rect x="66" y="66" width="108" height="108" strokeOpacity="0.28" />
        <circle cx="120" cy="120" r="70" strokeOpacity="0.3" strokeDasharray="2 6" />
      </g>
    </svg>
  );
}

function Padlock() {
  return (
    <svg viewBox="0 0 120 140" className="lock-padlock" aria-hidden>
      <defs>
        <linearGradient id="padlock-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c8" />
          <stop offset="0.35" stopColor="#f0cf85" />
          <stop offset="0.72" stopColor="#c9973f" />
          <stop offset="1" stopColor="#7d5520" />
        </linearGradient>
        <linearGradient id="padlock-shackle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdf0c4" />
          <stop offset="0.5" stopColor="#d9ac5a" />
          <stop offset="1" stopColor="#9a6c2a" />
        </linearGradient>
        <radialGradient id="padlock-glow">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#ffe3a0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffc861" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="padlock-shackle">
        <path d="M34 64 V42 a26 26 0 0 1 52 0 V64" fill="none" stroke="url(#padlock-shackle)" strokeWidth="11" strokeLinecap="round" />
      </g>
      <rect x="12" y="58" width="96" height="76" rx="16" fill="url(#padlock-body)" stroke="#fff4cf" strokeOpacity="0.55" />
      <rect x="20" y="66" width="80" height="60" rx="11" fill="none" stroke="#6b4716" strokeOpacity="0.35" />
      {[
        [26, 72],
        [94, 72],
        [26, 120],
        [94, 120],
      ].map(([cx, cy]) => (
        <path key={`${cx}-${cy}`} d={`M${cx} ${cy - 3.5} l3.5 3.5 -3.5 3.5 -3.5 -3.5z`} fill="#7a531c" fillOpacity="0.55" />
      ))}
      <circle className="padlock-glow" cx="60" cy="96" r="30" fill="url(#padlock-glow)" />
      <path d="M60 82 a9 9 0 0 1 5 16.5 l3 14 h-16 l3 -14 A9 9 0 0 1 60 82z" fill="#1a1206" />
    </svg>
  );
}

// ---------------------------------------------------------------- 解錠音

type Chime = { context: AudioContext; play: () => void };

/** 外部音源を使わず、Web Audio で柔らかな鐘の和音を鳴らす */
function createChime(): Chime | null {
  const AudioCtx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  const context = new AudioCtx();

  return {
    context,
    play() {
      const start = context.currentTime + 0.05;
      const master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);

      // 余韻を足すための簡単なディレイ
      const delay = context.createDelay();
      delay.delayTime.value = 0.24;
      const feedback = context.createGain();
      feedback.gain.value = 0.35;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(master);

      const bell = (frequency: number, at: number, peak: number, length: number, type: OscillatorType) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
        osc.connect(gain);
        gain.connect(master);
        gain.connect(delay);
        osc.start(at);
        osc.stop(at + length + 0.1);
      };

      // 上昇するアルペジオ (C メジャー 9th) と、温かい低音
      [523.25, 659.25, 783.99, 987.77, 1318.51, 1567.98].forEach((f, i) =>
        bell(f, start + i * 0.11, 0.5, 2.6, i % 2 ? "triangle" : "sine"),
      );
      bell(261.63, start + 1.15, 0.35, 3.4, "sine");
      bell(392, start + 1.2, 0.25, 3.2, "sine");
      bell(2093, start + 1.25, 0.12, 2.4, "sine");
    },
  };
}
