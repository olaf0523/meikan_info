// ロック画面の光の粒子エンジン (Canvas 2D・加算合成)
//   ember  … 常に舞い上がる金の火の粉
//   mote   … 解錠の「充填」で錠前へ渦を巻いて吸い込まれる光
//   spark  … 封印が弾ける瞬間の火花
//   streak … 扉が開くときの、中心から放射状に流れる光跡

type Kind = "ember" | "mote" | "spark" | "streak";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  kind: Kind;
  seed: number;
  color: string;
};

type Spawn = Pick<Particle, "x" | "y" | "vx" | "vy" | "life" | "size" | "kind"> & { age?: number };

const COLORS = ["255,246,220", "255,226,164", "248,204,124", "255,238,196"];
const MAX_PARTICLES = 1600;

function createGlowSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d");
  if (g) {
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(255,242,206,0.95)");
    gradient.addColorStop(0.45, "rgba(255,204,118,0.35)");
    gradient.addColorStop(1, "rgba(255,180,80,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
  }
  return canvas;
}

export class LockFx {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly ambient: boolean;
  private readonly glow: HTMLCanvasElement;
  private readonly particles: Particle[] = [];
  private readonly resizeObserver: ResizeObserver;
  private raf = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private emberClock = 0;
  private warpClock = 0;
  private mode: "idle" | "charge" | "warp" = "idle";
  private focusX = 0;
  private focusY = 0;

  constructor(canvas: HTMLCanvasElement, options: { ambient: boolean }) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not supported");
    this.canvas = canvas;
    this.ctx = ctx;
    this.ambient = options.ambient;
    this.glow = createGlowSprite();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    if (this.ambient) {
      for (let i = 0; i < 90; i++) this.spawnEmber(true);
    }
  }

  start() {
    const loop = (time: number) => {
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) {
        this.last = time;
        return;
      }
      this.step(time);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
  }

  /** キー入力時の小さな火花 */
  puff(x: number, y: number, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 2.8;
      this.add({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 24 + Math.random() * 28, size: 0.6 + Math.random() * 1.4, kind: "spark" });
    }
  }

  /** 光を錠前へ渦巻かせて集める */
  charge(x: number, y: number) {
    this.mode = "charge";
    this.focusX = x;
    this.focusY = y;
    const reach = Math.max(this.width, this.height) * 0.5;
    for (let i = 0; i < 240; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 110 + Math.random() * reach;
      this.add({
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        vx: -Math.sin(angle) * 2.4,
        vy: Math.cos(angle) * 2.4,
        life: 150,
        size: 0.8 + Math.random() * 1.9,
        kind: "mote",
      });
    }
  }

  /** 封印が弾ける火花 */
  burst(x: number, y: number, count = Math.round(560 * Math.min(1, Math.max(0.45, (this.width * this.height) / (1440 * 900))))) {
    this.mode = "idle";
    this.focusX = x;
    this.focusY = y;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.pow(Math.random(), 0.6) * 18;
      this.add({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 55 + Math.random() * 100, size: 0.7 + Math.random() * 2.5, kind: "spark" });
    }
  }

  /** 中心から光跡が流れ出す (扉の向こうへ飛び込む演出) */
  warp(x: number, y: number) {
    this.mode = "warp";
    this.focusX = x;
    this.focusY = y;
    this.warpClock = 0;
  }

  private add(spawn: Spawn) {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({
      ...spawn,
      age: spawn.age ?? 0,
      seed: Math.random() * 1000,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
  }

  private spawnEmber(scattered = false) {
    const life = 520 + Math.random() * 640;
    this.add({
      x: Math.random() * this.width,
      y: scattered ? Math.random() * this.height : this.height + 10,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.22 + Math.random() * 0.8),
      life,
      size: 0.5 + Math.random() * 2.1,
      kind: "ember",
      age: scattered ? Math.random() * life * 0.8 : 0,
    });
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private step(time: number) {
    const dt = this.last ? Math.min(3, (time - this.last) / 16.667) : 1;
    this.last = time;
    const { ctx, width, height, focusX, focusY } = this;

    if (this.ambient && this.mode !== "warp") {
      this.emberClock += dt;
      while (this.emberClock > 4) {
        this.emberClock -= 4;
        this.spawnEmber();
      }
    }

    if (this.mode === "warp") {
      this.warpClock += dt;
      const density = Math.min(1, Math.max(0.35, (width * height) / (1440 * 900)));
      const count = Math.min(30, 6 + this.warpClock * 0.5) * density * dt;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 110;
        const speed = 1.5 + Math.random() * 2.5;
        this.add({
          x: focusX + Math.cos(angle) * radius,
          y: focusY + Math.sin(angle) * radius,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 110,
          size: 0.6 + Math.random() * 1.7,
          kind: "streak",
        });
      }
    }

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    let alive = 0;
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.life) continue;

      switch (p.kind) {
        case "ember":
          p.vx += Math.sin((p.age + p.seed) * 0.02) * 0.004 * dt;
          if (this.mode === "charge") {
            p.vx += (focusX - p.x) * 0.00014 * dt;
            p.vy += (focusY - p.y) * 0.00014 * dt;
          } else if (this.mode === "warp") {
            const dx = p.x - focusX;
            const dy = p.y - focusY;
            const d = Math.hypot(dx, dy) || 1;
            p.vx += (dx / d) * 0.4 * dt;
            p.vy += (dy / d) * 0.4 * dt;
          }
          break;
        case "mote": {
          const dx = focusX - p.x;
          const dy = focusY - p.y;
          const d = Math.hypot(dx, dy) || 1;
          p.vx = (p.vx + ((dx / d) * 0.6 - (dy / d) * 0.2) * dt) * 0.93;
          p.vy = (p.vy + ((dy / d) * 0.6 + (dx / d) * 0.2) * dt) * 0.93;
          if (d < 14) p.age = p.life;
          break;
        }
        case "spark":
          p.vx *= Math.pow(0.962, dt);
          p.vy = p.vy * Math.pow(0.962, dt) + 0.05 * dt;
          break;
        case "streak":
          p.vx *= 1 + 0.075 * dt;
          p.vy *= 1 + 0.075 * dt;
          if (p.x < -120 || p.x > width + 120 || p.y < -120 || p.y > height + 120) p.age = p.life;
          break;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const t = p.age / p.life;
      const alpha =
        p.kind === "ember"
          ? Math.min(1, t * 8, (1 - t) * 4) * (0.55 + 0.45 * Math.sin(p.age * 0.08 + p.seed))
          : p.kind === "spark"
            ? Math.pow(1 - t, 1.4)
            : Math.min(1, t * 6);

      if (alpha > 0.01) {
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > 2.2 && (p.kind !== "ember" || this.mode === "warp")) {
          const length = Math.min(p.kind === "streak" || p.kind === "ember" ? 110 : 28, speed * (p.kind === "spark" ? 2.2 : 5));
          ctx.strokeStyle = `rgba(${p.color},${(alpha * 0.85).toFixed(3)})`;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x - (p.vx / speed) * length, p.y - (p.vy / speed) * length);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        const glowSize = p.size * (p.kind === "ember" ? 5 : 6);
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.glow, p.x - glowSize, p.y - glowSize, glowSize * 2, glowSize * 2);
        ctx.globalAlpha = 1;
      }
      this.particles[alive++] = p;
    }
    this.particles.length = alive;
  }
}
