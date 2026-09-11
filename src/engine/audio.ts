/**
 * Audio sintetizado con WebAudio.
 *
 * No hay archivos de sonido: todos los efectos y la música chiptune se generan
 * con osciladores. Así el juego pesa poco y carga instantáneo en el celular.
 */

type Wave = OscillatorType;

export interface ToneOptions {
  freq: number;
  duration: number;
  wave?: Wave;
  volume?: number;
  /** Frecuencia final para hacer barridos (arpegios, monedas, errores). */
  slideTo?: number;
  delay?: number;
  attack?: number;
  release?: number;
}

interface Note {
  /** Semitono MIDI, o 0 para silencio. */
  n: number;
  /** Duración en pasos de corchea. */
  d: number;
}

const A4 = 440;

export function midiToFreq(n: number): number {
  return A4 * Math.pow(2, (n - 69) / 12);
}

/** Melodía principal: alegre, en La mayor, 16 compases. */
const MELODY: Note[] = [
  { n: 76, d: 2 }, { n: 79, d: 2 }, { n: 81, d: 2 }, { n: 79, d: 2 },
  { n: 76, d: 2 }, { n: 72, d: 2 }, { n: 74, d: 4 },
  { n: 74, d: 2 }, { n: 76, d: 2 }, { n: 79, d: 2 }, { n: 76, d: 2 },
  { n: 72, d: 4 }, { n: 0, d: 4 },
  { n: 81, d: 2 }, { n: 83, d: 2 }, { n: 84, d: 4 },
  { n: 83, d: 2 }, { n: 81, d: 2 }, { n: 79, d: 4 },
  { n: 76, d: 2 }, { n: 79, d: 2 }, { n: 81, d: 2 }, { n: 84, d: 2 },
  { n: 83, d: 4 }, { n: 0, d: 4 },
];

const BASS: Note[] = [
  { n: 45, d: 4 }, { n: 45, d: 4 }, { n: 52, d: 4 }, { n: 52, d: 4 },
  { n: 50, d: 4 }, { n: 50, d: 4 }, { n: 47, d: 4 }, { n: 47, d: 4 },
  { n: 45, d: 4 }, { n: 45, d: 4 }, { n: 52, d: 4 }, { n: 52, d: 4 },
  { n: 53, d: 4 }, { n: 52, d: 4 }, { n: 50, d: 4 }, { n: 47, d: 4 },
];

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicPlaying = false;
  private nextNoteTime = 0;
  private melodyIndex = 0;
  private bassIndex = 0;
  private stepIndex = 0;
  private tempo = 132;

  musicVolume = 0.32;
  sfxVolume = 0.55;
  muted = false;

  /** Debe llamarse desde un gesto del usuario (los navegadores lo exigen). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 1;
    master.connect(ctx.destination);
    this.master = master;

    const music = ctx.createGain();
    music.gain.value = this.musicVolume;
    music.connect(master);
    this.musicGain = music;

    const sfx = ctx.createGain();
    sfx.gain.value = this.sfxVolume;
    sfx.connect(master);
    this.sfxGain = sfx;

    // Buffer de ruido blanco reutilizable para percusión y efectos.
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = v;
    if (this.sfxGain && this.ctx) this.sfxGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  tone(opts: ToneOptions): void {
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.wave ?? 'square';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + opts.duration);
    }
    const peak = opts.volume ?? 0.3;
    const attack = opts.attack ?? 0.005;
    const release = opts.release ?? 0.06;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.setValueAtTime(peak, t0 + Math.max(attack, opts.duration - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t0);
    osc.stop(t0 + opts.duration + 0.02);
  }

  noise(duration: number, volume = 0.2, filterHz = 1800, delay = 0): void {
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest || !this.noiseBuffer) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterHz;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(t0);
    src.stop(t0 + duration);
  }

  // --- Efectos con nombre, usados por el juego ---

  sfx(name: SfxName): void {
    switch (name) {
      case 'step':
        this.noise(0.05, 0.055, 900);
        break;
      case 'pickup':
        this.tone({ freq: 520, duration: 0.09, wave: 'square', volume: 0.22, slideTo: 780 });
        break;
      case 'drop':
        this.tone({ freq: 380, duration: 0.09, wave: 'square', volume: 0.18, slideTo: 220 });
        break;
      case 'work':
        this.tone({ freq: 300, duration: 0.06, wave: 'sawtooth', volume: 0.12 });
        break;
      case 'craft':
        this.tone({ freq: 660, duration: 0.08, wave: 'square', volume: 0.24 });
        this.tone({ freq: 880, duration: 0.1, wave: 'square', volume: 0.2, delay: 0.07 });
        break;
      case 'ready':
        this.tone({ freq: 988, duration: 0.09, wave: 'triangle', volume: 0.26 });
        this.tone({ freq: 1319, duration: 0.12, wave: 'triangle', volume: 0.22, delay: 0.09 });
        break;
      case 'serve':
        this.tone({ freq: 784, duration: 0.08, wave: 'square', volume: 0.26 });
        this.tone({ freq: 1047, duration: 0.08, wave: 'square', volume: 0.24, delay: 0.07 });
        this.tone({ freq: 1319, duration: 0.14, wave: 'square', volume: 0.22, delay: 0.14 });
        break;
      case 'coin':
        this.tone({ freq: 1319, duration: 0.06, wave: 'square', volume: 0.2 });
        this.tone({ freq: 1760, duration: 0.16, wave: 'square', volume: 0.18, delay: 0.05 });
        break;
      case 'error':
        this.tone({ freq: 220, duration: 0.16, wave: 'sawtooth', volume: 0.2, slideTo: 110 });
        break;
      case 'angry':
        this.tone({ freq: 300, duration: 0.22, wave: 'sawtooth', volume: 0.22, slideTo: 90 });
        this.noise(0.18, 0.1, 500);
        break;
      case 'burn':
        this.noise(0.35, 0.16, 400);
        this.tone({ freq: 160, duration: 0.3, wave: 'sawtooth', volume: 0.14, slideTo: 70 });
        break;
      case 'menu':
        this.tone({ freq: 660, duration: 0.05, wave: 'square', volume: 0.16 });
        break;
      case 'select':
        this.tone({ freq: 880, duration: 0.07, wave: 'square', volume: 0.22 });
        this.tone({ freq: 1175, duration: 0.1, wave: 'square', volume: 0.18, delay: 0.06 });
        break;
      case 'back':
        this.tone({ freq: 440, duration: 0.09, wave: 'square', volume: 0.18, slideTo: 300 });
        break;
      case 'levelup':
        [523, 659, 784, 1047, 1319].forEach((f, i) => {
          this.tone({ freq: f, duration: 0.16, wave: 'square', volume: 0.22, delay: i * 0.09 });
        });
        break;
      case 'lose':
        [523, 440, 349, 262].forEach((f, i) => {
          this.tone({ freq: f, duration: 0.24, wave: 'triangle', volume: 0.22, delay: i * 0.16 });
        });
        break;
      case 'tick':
        this.tone({ freq: 1400, duration: 0.04, wave: 'square', volume: 0.14 });
        break;
      case 'customer':
        this.tone({ freq: 700, duration: 0.07, wave: 'triangle', volume: 0.16 });
        this.tone({ freq: 900, duration: 0.07, wave: 'triangle', volume: 0.14, delay: 0.06 });
        break;
    }
  }

  // --- Música ---

  startMusic(tempo = 132): void {
    if (!this.ctx || this.musicPlaying) return;
    this.tempo = tempo;
    this.musicPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.melodyIndex = 0;
    this.bassIndex = 0;
    this.stepIndex = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 40);
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setTempo(tempo: number): void {
    this.tempo = tempo;
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest || !this.musicPlaying) return;
    const stepDur = 30 / this.tempo; // duración de una corchea
    while (this.nextNoteTime < ctx.currentTime + 0.25) {
      const t = this.nextNoteTime;
      this.playSeqNote(MELODY, 'melody', t, stepDur, dest);
      this.playSeqNote(BASS, 'bass', t, stepDur, dest);
      // Percusión sencilla: bombo en el pulso, hi-hat en la contra.
      if (this.stepIndex % 4 === 0) this.kick(t, dest);
      if (this.stepIndex % 2 === 1) this.hat(t, dest);
      this.stepIndex++;
      this.nextNoteTime += stepDur;
    }
  }

  private melodyRemaining = 0;
  private bassRemaining = 0;

  private playSeqNote(seq: Note[], voice: 'melody' | 'bass', time: number, stepDur: number, dest: GainNode): void {
    const isMelody = voice === 'melody';
    let remaining = isMelody ? this.melodyRemaining : this.bassRemaining;
    let index = isMelody ? this.melodyIndex : this.bassIndex;
    if (remaining > 0) {
      if (isMelody) this.melodyRemaining = remaining - 1;
      else this.bassRemaining = remaining - 1;
      return;
    }
    const note = seq[index % seq.length];
    index++;
    remaining = note.d - 1;
    if (isMelody) {
      this.melodyIndex = index;
      this.melodyRemaining = remaining;
    } else {
      this.bassIndex = index;
      this.bassRemaining = remaining;
    }
    if (note.n === 0) return;

    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isMelody ? 'square' : 'triangle';
    osc.frequency.value = midiToFreq(note.n);
    const dur = note.d * stepDur * 0.92;
    const peak = isMelody ? 0.16 : 0.2;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private kick(time: number, dest: GainNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.16);
  }

  private hat(time: number, dest: GainNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(time);
    src.stop(time + 0.06);
  }
}

export type SfxName =
  | 'step' | 'pickup' | 'drop' | 'work' | 'craft' | 'ready' | 'serve' | 'coin'
  | 'error' | 'angry' | 'burn' | 'menu' | 'select' | 'back' | 'levelup'
  | 'lose' | 'tick' | 'customer';

export const audio = new AudioBus();
