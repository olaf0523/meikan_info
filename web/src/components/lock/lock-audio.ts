// 外部の音源ファイルを使わず、Web Audio で解錠の効果音を合成する

export type LockAudio = {
  resume: () => void;
  key: () => void;
  error: () => void;
  charge: () => void;
  unseal: () => void;
  gate: () => void;
};

export function createLockAudio(): LockAudio | null {
  const AudioCtx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.ratio.value = 6;
  compressor.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(compressor);

  // 残響の代わりのフィードバックディレイ
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.27;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.5;
  echo.connect(feedback);
  feedback.connect(echo);
  echo.connect(echoOut);
  echoOut.connect(master);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  const envelope = (param: AudioParam, at: number, peak: number, attack: number, release: number) => {
    param.setValueAtTime(0.0001, at);
    param.exponentialRampToValueAtTime(peak, at + attack);
    param.exponentialRampToValueAtTime(0.0001, at + attack + release);
  };

  const tone = (
    type: OscillatorType,
    frequency: number,
    at: number,
    peak: number,
    attack: number,
    release: number,
    options: { glideTo?: number; wet?: boolean; detune?: number } = {},
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    if (options.glideTo) osc.frequency.exponentialRampToValueAtTime(options.glideTo, at + attack + release);
    if (options.detune) osc.detune.value = options.detune;
    envelope(gain.gain, at, peak, attack, release);
    osc.connect(gain);
    gain.connect(master);
    if (options.wet !== false) gain.connect(echo);
    osc.start(at);
    osc.stop(at + attack + release + 0.05);
  };

  const whoosh = (at: number, peak: number, attack: number, release: number, from: number, to: number) => {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + attack + release);
    const gain = ctx.createGain();
    envelope(gain.gain, at, peak, attack, release);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    gain.connect(echo);
    source.start(at);
    source.stop(at + attack + release + 0.05);
  };

  const now = () => ctx.currentTime + 0.02;

  return {
    resume: () => void ctx.resume(),
    // テンキー: 水晶を弾くような短い音
    key: () => {
      const t = now();
      tone("sine", 1567.98, t, 0.1, 0.005, 0.2);
      tone("sine", 2349.32, t, 0.035, 0.005, 0.14);
    },
    // 失敗: 低く沈む二音
    error: () => {
      const t = now();
      tone("triangle", 196, t, 0.25, 0.01, 0.22, { wet: false });
      tone("triangle", 155.56, t + 0.14, 0.25, 0.01, 0.32, { wet: false });
    },
    // 充填: うなりが高まっていく
    charge: () => {
      const t = now();
      tone("sawtooth", 55, t, 0.08, 0.95, 0.25, { glideTo: 110, wet: false });
      tone("sine", 110, t, 0.22, 0.95, 0.3, { glideTo: 220 });
      whoosh(t, 0.16, 0.95, 0.15, 300, 3400);
    },
    // 封印解除: 衝撃音と、きらめく鐘のアルペジオ
    unseal: () => {
      const t = now();
      tone("sine", 140, t, 0.9, 0.005, 0.95, { glideTo: 32, wet: false });
      whoosh(t, 0.5, 0.005, 1.1, 2600, 280);
      [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093].forEach((f, i) =>
        tone(i % 2 ? "triangle" : "sine", f, t + 0.08 + i * 0.075, 0.28, 0.01, 2.4),
      );
    },
    // 開扉: 聖歌のような和音が膨らみ、風が抜ける
    gate: () => {
      const t = now();
      [130.81, 196, 261.63, 329.63, 392, 493.88].forEach((f, i) => {
        tone("sine", f, t, 0.15, 1.2, 2.6, { detune: i % 2 ? 7 : -7 });
        tone("triangle", f * 2, t + 0.2, 0.045, 1.4, 2.2);
      });
      whoosh(t, 0.22, 1.4, 1.2, 400, 6400);
      tone("sine", 2637.02, t + 1.3, 0.07, 0.02, 2.2);
      tone("sine", 3135.96, t + 1.45, 0.05, 0.02, 2);
    },
  };
}
