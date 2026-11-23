// Neon Bay sound: everything is synthesized with WebAudio, no audio files.
// A short blip for a pickup, a crack for a gunshot, a two-tone siren for the
// police, a low engine hum while driving, and a slow bass line for the
// music. Nothing starts until the player first presses a key, so the browser
// never blocks it — and a headless run without audio simply stays quiet.

export function makeAudio() {
  return {
    ctx: null,
    muted: false,
    musicTimer: 0,
    musicStep: 0,
    engineOsc: null,
    engineGain: null,
  };
}

function ensure(audio) {
  if (audio.ctx || typeof window === 'undefined') return audio.ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio.ctx = new AC();
    return audio.ctx;
  } catch (err) {
    return null;
  }
}

export function unlockAudio(audio) {
  const ctx = ensure(audio);
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function tone(audio, freq, dur, type, vol, slideTo) {
  if (audio.muted) return;
  const ctx = ensure(audio);
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (err) {
    // A browser without audio keeps the game quiet instead of breaking it.
  }
}

function noiseBurst(audio, dur, vol, low) {
  if (audio.muted) return;
  const ctx = ensure(audio);
  if (!ctx) return;
  try {
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch (err) {
    // Quiet fallback.
  }
}

// One named game event, one sound. The world step hands these over.
export function playEvent(audio, event) {
  if (!event) return;
  switch (event.type) {
    case 'shot':
      noiseBurst(audio, 0.12, 0.5, 2600);
      tone(audio, 180, 0.1, 'square', 0.22, 60);
      break;
    case 'pickup':
      tone(audio, event.kind === 'health' ? 520 : 880, 0.14, 'sine', 0.3, event.kind === 'health' ? 780 : 1320);
      break;
    case 'crash':
      noiseBurst(audio, 0.25, 0.5, 700);
      break;
    case 'boom':
      noiseBurst(audio, 0.6, 0.7, 320);
      tone(audio, 70, 0.5, 'sine', 0.4, 30);
      break;
    case 'mission':
      tone(audio, 523, 0.16, 'triangle', 0.3);
      setTimeout(() => tone(audio, 659, 0.16, 'triangle', 0.3), 150);
      setTimeout(() => tone(audio, 784, 0.3, 'triangle', 0.3), 300);
      break;
    case 'fare':
      tone(audio, 988, 0.12, 'sine', 0.28, 1240);
      break;
    case 'busted':
    case 'wasted':
      tone(audio, 220, 0.5, 'sawtooth', 0.25, 110);
      break;
    case 'enter':
      tone(audio, 300, 0.08, 'square', 0.15, 420);
      break;
    case 'siren':
      break;
    default:
      break;
  }
}

// A slow two-tone siren while the player is wanted.
export function playSiren(audio, time) {
  if (audio.muted || !audio.ctx) return;
  const phase = Math.floor(time * 1.4) % 2;
  tone(audio, phase === 0 ? 660 : 520, 0.32, 'sine', 0.05);
}

// The engine hum follows the driven car's speed.
export function setEngine(audio, on, speedRatio) {
  if (audio.muted) {
    stopEngine(audio);
    return;
  }
  const ctx = ensure(audio);
  if (!ctx) return;
  try {
    if (!on) {
      stopEngine(audio);
      return;
    }
    if (!audio.engineOsc) {
      audio.engineOsc = ctx.createOscillator();
      audio.engineGain = ctx.createGain();
      audio.engineOsc.type = 'sawtooth';
      audio.engineGain.gain.value = 0.03;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      audio.engineOsc.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(ctx.destination);
      audio.engineOsc.start();
    }
    audio.engineOsc.frequency.setValueAtTime(55 + speedRatio * 130, ctx.currentTime);
  } catch (err) {
    // Quiet fallback.
  }
}

function stopEngine(audio) {
  try {
    if (audio.engineOsc) {
      audio.engineOsc.stop();
      audio.engineOsc = null;
      audio.engineGain = null;
    }
  } catch (err) {
    audio.engineOsc = null;
    audio.engineGain = null;
  }
}

// A lazy bass line: A minor, one note a beat, only while playing.
const BASS_LINE = [110, 0, 130.8, 0, 98, 0, 146.8, 0, 110, 0, 164.8, 0, 130.8, 0, 98, 0];

export function stepMusic(audio, dt, playing) {
  if (!playing || audio.muted) return;
  audio.musicTimer -= dt;
  if (audio.musicTimer > 0) return;
  audio.musicTimer = 0.42;
  const note = BASS_LINE[audio.musicStep % BASS_LINE.length];
  audio.musicStep += 1;
  if (note) tone(audio, note, 0.38, 'triangle', 0.12);
}
