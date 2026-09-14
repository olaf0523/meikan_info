"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import Icon from "@/components/Icon";
import DoorLeaf from "@/components/lock/DoorLeaf";
import Padlock from "@/components/lock/Padlock";
import PanelCorners from "@/components/lock/PanelCorners";
import Sigil from "@/components/lock/Sigil";
import { createLockAudio, type LockAudio } from "@/components/lock/lock-audio";
import { LockFx } from "@/components/lock/lock-fx";
import type { StyleWithVars } from "@/components/lock/types";
import { PIN_LENGTH, UNLOCK_FLAG } from "@/lib/lock-shared";

/**
 * idle → checking → error (やり直し)
 *                 → charge (光が錠前に集まる) → unseal (封印が弾ける) → gate (扉が開き光の中へ) → ascend (白金の光) → メイン画面
 */
type Phase = "idle" | "checking" | "error" | "charge" | "unseal" | "gate" | "ascend";

const TIMELINE = { unseal: 1000, gate: 2050, ascend: 4550, navigate: 5300 };
const TIMELINE_REDUCED = { unseal: 120, gate: 260, ascend: 420, navigate: 800 };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const WELCOME = ["よ", "う", "こ", "そ"];
const SHAFTS: StyleWithVars[] = [
  { "--r": "34deg", "--delay": "0s", width: "16vw" },
  { "--r": "47deg", "--delay": "-3s", width: "9vw" },
  { "--r": "59deg", "--delay": "-6s", width: "13vw" },
];
const FLARES: StyleWithVars[] = [
  { "--k": 0.35, "--s": "70px" },
  { "--k": 0.6, "--s": "26px" },
  { "--k": 0.86, "--s": "140px" },
  { "--k": 1.15, "--s": "46px" },
];

type Sequence = { unlocked: boolean; navigated: boolean; timers: number[] };

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function centerOf(el: Element | null | undefined) {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** メイン画面へ (再読み込みすると Proxy が解錠済みとして本体を返す) */
function enterSite(sequence: Sequence) {
  if (sequence.navigated) return;
  sequence.navigated = true;
  sequence.timers.forEach(clearTimeout);
  try {
    sessionStorage.setItem(UNLOCK_FLAG, "1");
  } catch {
    // 保存できなくても遷移は続ける
  }
  window.location.reload();
}

/** 画面の揺れ (既存の transform に加算する) */
function shake(el: HTMLElement | null, kind: "rumble" | "impact", duration: number) {
  if (!el) return;
  const steps = kind === "rumble" ? 20 : 12;
  const keyframes = Array.from({ length: steps + 1 }, (_, i) => {
    const decay = kind === "impact" ? 1 - i / steps : Math.min(1, i / (steps * 0.6));
    const amplitude = (kind === "impact" ? 16 : 2.5) * decay;
    const x = i === steps ? 0 : (Math.random() * 2 - 1) * amplitude;
    const y = i === steps ? 0 : (Math.random() * 2 - 1) * amplitude;
    return { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` };
  });
  el.animate(keyframes, { duration, easing: "linear", composite: "add" });
}

/** 紋章の回転を段階的に加速させる */
function accelerate(root: HTMLElement | null) {
  if (!root) return;
  const animations = Array.from(root.querySelectorAll(".sigil-outer, .sigil-inner, .lock-corona, .lock-orbit")).flatMap(
    (el) => el.getAnimations(),
  );
  [
    [0, 4],
    [300, 11],
    [650, 28],
  ].forEach(([delay, rate]) => window.setTimeout(() => animations.forEach((a) => a.updatePlaybackRate(rate)), delay));
}

/** 15 桁のひし形から錠前へ、光の筋を走らせる */
function drawBeams(svg: SVGSVGElement | null, slots: HTMLElement | null, target: { x: number; y: number }) {
  if (!svg || !slots) return;
  svg.replaceChildren();
  Array.from(slots.children).forEach((slot, i, all) => {
    const from = centerOf(slot);
    const bend = (i - (all.length - 1) / 2) * 9;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      `M${from.x} ${from.y} Q${(from.x + target.x) / 2 + bend} ${Math.min(from.y, target.y) - 30} ${target.x} ${target.y}`,
    );
    path.setAttribute("class", "lock-beam");
    svg.append(path);
    const length = path.getTotalLength();
    const dash = length * 0.35;
    path.style.strokeDasharray = `${dash} ${length + dash}`;
    path.animate(
      [
        { strokeDashoffset: dash, opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { strokeDashoffset: -length, opacity: 0.3 },
      ],
      { duration: 720, delay: i * 30, easing: "cubic-bezier(0.55, 0, 0.2, 1)", fill: "forwards" },
    );
  });
}

function ripple(button: HTMLElement) {
  const wave = document.createElement("span");
  wave.className = "lock-ripple";
  button.append(wave);
  wave.animate(
    [
      { transform: "scale(0)", opacity: 0.95 },
      { transform: "scale(2.6)", opacity: 0 },
    ],
    { duration: 560, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  ).onfinish = () => wave.remove();
}

export default function LockScreen() {
  const [pin, setPin] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [soundOn, setSoundOn] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beamsRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const padlockRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<LockFx | null>(null);
  const audioRef = useRef<LockAudio | null>(null);
  const busyRef = useRef(false);
  const sequenceRef = useRef<Sequence>({ unlocked: false, navigated: false, timers: [] });

  const busy = phase !== "idle";

  // 光の粒子エンジン
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let fx: LockFx | null = null;
    try {
      fx = new LockFx(canvas, { ambient: !prefersReducedMotion() });
      fx.start();
      fxRef.current = fx;
    } catch {
      // Canvas が使えない環境では粒子なしで表示する
    }
    return () => {
      fx?.destroy();
      fxRef.current = null;
    };
  }, []);

  // マウスに合わせた奥行き (パララックス) と、入力欄への自動フォーカス
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !window.matchMedia("(pointer: fine)").matches) return;
    inputRef.current?.focus({ preventScroll: true });
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--mx", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty("--my", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // 解錠後は Enter / Space / Esc で演出をスキップ。画面を離れるときはタイマーを止める
  useEffect(() => {
    const sequence = sequenceRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (sequence.unlocked && (e.key === "Enter" || e.key === " " || e.key === "Escape")) {
        e.preventDefault();
        enterSite(sequence);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      sequence.timers.forEach(clearTimeout);
    };
  }, []);

  function audio() {
    if (!soundOn) return null;
    audioRef.current ??= createLockAudio();
    audioRef.current?.resume();
    return audioRef.current;
  }

  function schedule(fn: () => void, ms: number) {
    sequenceRef.current.timers.push(window.setTimeout(fn, ms));
  }

  async function submit(value: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    const sound = audio();
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
      sound?.error();
      setPhase("error");
      setMessage(status === "wrong" ? "PINコードが正しくありません" : "通信に失敗しました。もう一度お試しください");
      schedule(() => {
        setPin("");
        setPhase("idle");
        busyRef.current = false;
        inputRef.current?.focus({ preventScroll: true });
      }, 950);
      return;
    }

    sequenceRef.current.unlocked = true;
    setMessage("封印を解いています");
    celebrate(sound);
  }

  function celebrate(sound: LockAudio | null) {
    const reduced = prefersReducedMotion();
    const t = reduced ? TIMELINE_REDUCED : TIMELINE;
    const fx = fxRef.current;
    const target = centerOf(padlockRef.current);

    setPhase("charge");
    if (!reduced) {
      fx?.charge(target.x, target.y);
      drawBeams(beamsRef.current, slotsRef.current, target);
      accelerate(rootRef.current);
      shake(stageRef.current, "rumble", t.unseal);
      sound?.charge();
    }

    schedule(() => {
      setPhase("unseal");
      setMessage("解錠しました");
      if (!reduced) {
        fx?.burst(target.x, target.y);
        shake(stageRef.current, "impact", 650);
        shake(rootRef.current?.querySelector<HTMLElement>(".lock-content") ?? null, "impact", 650);
        sound?.unseal();
      }
    }, t.unseal);

    schedule(() => {
      setPhase("gate");
      if (!reduced) {
        fx?.warp(window.innerWidth / 2, window.innerHeight * 0.46);
        sound?.gate();
      }
    }, t.gate);

    schedule(() => setPhase("ascend"), t.ascend);
    schedule(() => enterSite(sequenceRef.current), t.navigate);
  }

  /** 光の彗星をキーから桁へ飛ばす */
  function launchComet(from: HTMLElement, index: number) {
    const root = rootRef.current;
    const slot = slotsRef.current?.children[index];
    if (!root || !slot || prefersReducedMotion()) return;
    const a = centerOf(from);
    const b = centerOf(slot);
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    const comet = document.createElement("span");
    comet.className = "lock-comet";
    root.append(comet);
    comet.animate(
      [
        { transform: `translate(${a.x}px, ${a.y}px) rotate(${angle}deg) scale(0.4)`, opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: `translate(${b.x}px, ${b.y}px) rotate(${angle}deg) scale(1)`, opacity: 1 },
      ],
      { duration: 380, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    ).onfinish = () => {
      comet.remove();
      fxRef.current?.puff(b.x, b.y, 16);
    };
  }

  function update(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (phase === "idle" && message) setMessage("");
    if (digits.length === PIN_LENGTH) void submit(digits);
  }

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (digits.length > pin.length) {
      audio()?.key();
      const slot = slotsRef.current?.children[digits.length - 1];
      if (slot) {
        const c = centerOf(slot);
        fxRef.current?.puff(c.x, c.y, 16);
      }
    }
    update(digits);
  };

  const press = (digit: string, e: MouseEvent<HTMLButtonElement>) => {
    if (busy || pin.length >= PIN_LENGTH) return;
    ripple(e.currentTarget);
    audio()?.key();
    launchComet(e.currentTarget, pin.length);
    update(pin + digit);
  };

  const erase = (e: MouseEvent<HTMLButtonElement>) => {
    if (busy) return;
    ripple(e.currentTarget);
    setPin((p) => p.slice(0, -1));
  };

  const clear = (e: MouseEvent<HTMLButtonElement>) => {
    if (busy) return;
    ripple(e.currentTarget);
    setPin("");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy && pin) void submit(pin);
  };

  return (
    <div
      ref={rootRef}
      className="lock-root"
      data-phase={phase}
      onPointerDown={() => {
        if (sequenceRef.current.unlocked) enterSite(sequenceRef.current);
      }}
    >
      {/* ---------------- 景色と扉 */}
      <div ref={stageRef} className="lock-stage" aria-hidden>
        <div className="lock-parallax">
          <div className="lock-scene" />
          <div className="lock-shafts">
            {SHAFTS.map((style, i) => (
              <span key={i} style={style} />
            ))}
          </div>
          <div className="lock-rays" />
          <div className="lock-flare">
            {FLARES.map((style, i) => (
              <span key={i} style={style} />
            ))}
          </div>
        </div>
        <div className="lock-light" />
        <div className="lock-doors">
          <DoorLeaf side="left" />
          <DoorLeaf side="right" />
          <span className="lock-seam" />
          <span className="lock-seam-pulse" />
        </div>
        <div className="lock-vignette" />
      </div>

      <canvas ref={canvasRef} className="lock-canvas" aria-hidden />

      <button
        type="button"
        onClick={() => setSoundOn((v) => !v)}
        aria-pressed={soundOn}
        aria-label={soundOn ? "効果音をオフにする" : "効果音をオンにする"}
        title={soundOn ? "効果音: オン" : "効果音: オフ"}
        className="lock-sound gold-outline grid size-10 place-items-center rounded-full text-gold transition hover:border-gold hover:text-gold-light"
      >
        <Icon name={soundOn ? "sound" : "mute"} className="size-5" />
      </button>

      {/* ---------------- 中央 */}
      <main className="lock-content">
        <div className="flex w-full max-w-md flex-col items-center px-5 py-8 text-center">
          <p className="lock-brand gold-outline flex items-center gap-2.5 rounded-full bg-[#060913]/90 py-1.5 pl-1.5 pr-4 font-serif text-sm font-bold tracking-[0.2em] text-gold-light sm:text-base">
            <span className="gold-fill grid size-7 place-items-center rounded-full font-serif text-sm font-extrabold tracking-normal">
              名
            </span>
            フリーランス名鑑 データベース
          </p>

          <div className="lock-emblem mt-5">
            <div className="lock-emblem-tilt">
              <div aria-hidden className="lock-emblem-disc" />
              <div aria-hidden className="lock-halo" />
              <div aria-hidden className="lock-corona" />
              <span aria-hidden className="lock-orbit lock-orbit-1" />
              <span aria-hidden className="lock-orbit lock-orbit-2" />
              <span aria-hidden className="lock-orbit lock-orbit-3" />
              <Sigil />
              <div ref={padlockRef} className="lock-padlock-wrap">
                <Padlock />
              </div>
              <span aria-hidden className="lock-core-flash" />
              <span aria-hidden className="lock-ring" />
              <span aria-hidden className="lock-ring" />
              <span aria-hidden className="lock-ring" />
            </div>
          </div>

          <section className="lock-panel mt-4 w-full rounded-3xl px-5 pb-5 pt-4 sm:px-7">
            <PanelCorners />
            <p className="font-serif text-[11px] font-bold tracking-[0.5em] text-gold">PRIVATE ARCHIVE</p>
            <h1 className="lock-title mt-2 font-serif text-2xl font-extrabold tracking-wider sm:text-3xl">封印を解くPINコード</h1>
            <p className="mt-2 text-sm text-ink/75">この名鑑は、許可された方のみ閲覧できます</p>

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
              <div
                ref={slotsRef}
                aria-hidden
                className="lock-slots"
                onClick={() => inputRef.current?.focus({ preventScroll: true })}
              >
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
                className={`mt-1 h-5 text-sm font-medium ${phase === "error" ? "text-rose-300" : "text-gold-light"}`}
              >
                {message || `${pin.length} / ${PIN_LENGTH} 桁`}
              </p>

              <div className="mx-auto mt-4 grid max-w-[17.5rem] grid-cols-3 gap-3">
                {KEYS.map((key) => (
                  <button key={key} type="button" onClick={(e) => press(key, e)} disabled={busy} className="lock-key">
                    {key}
                  </button>
                ))}
                <button type="button" onClick={clear} disabled={busy} className="lock-key" aria-label="すべて消去">
                  <span className="lock-key-sub">消去</span>
                </button>
                <button type="button" onClick={(e) => press("0", e)} disabled={busy} className="lock-key">
                  0
                </button>
                <button type="button" onClick={erase} disabled={busy} className="lock-key" aria-label="1文字消す">
                  <Icon name="backspace" className="size-6 text-gold" />
                </button>
              </div>

              <button
                type="submit"
                disabled={busy || !pin}
                className="lock-submit gold-fill mx-auto mt-5 flex w-full max-w-[17.5rem] items-center justify-center gap-2 rounded-2xl py-3.5 font-serif text-lg font-bold tracking-[0.3em] transition hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
              >
                <Icon name="lock" className="size-5" />
                解錠する
              </button>
            </form>
          </section>
        </div>
      </main>

      {/* ---------------- 解錠演出 */}
      <svg ref={beamsRef} className="lock-beams" aria-hidden />
      <div aria-hidden className="lock-welcome">
        <p className="lock-welcome-kicker">THE SEAL IS BROKEN</p>
        <p className="lock-welcome-title">
          {WELCOME.map((char, i) => (
            <span key={i} style={{ "--i": i } as StyleWithVars}>
              {char}
            </span>
          ))}
        </p>
        <div className="lock-welcome-rule" />
        <p className="lock-welcome-sub">フリーランス名鑑 データベースへ</p>
      </div>
      <div aria-hidden className="lock-sweep" />
      <div aria-hidden className="lock-iris" />
      <p aria-hidden className="lock-skip">クリック / Enter でスキップ</p>
    </div>
  );
}
