import type { LanguageCode } from '../types';

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

export interface SpeechRecognitionResultListItemLike {
  readonly length: number;
  readonly isFinal?: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultListItemLike>;
}

export interface SpeechRecognitionInstance {
  lang: string;
  continuous?: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function getSpeechLang(lang: LanguageCode): string {
  if (lang === 'kn') return 'kn-IN';
  if (lang === 'hi') return 'hi-IN';
  return 'en-IN';
}

let activeSpeechToken = 0;
let ttsQueueActive = false;

export function sanitizeTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' code snippet ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[#>\-\u2022]+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTextIntoSpeechChunks(text: string, maxLen = 200): string[] {
  const normalized = sanitizeTextForSpeech(text);
  if (!normalized) return [];
  if (normalized.length <= maxLen) return [normalized];

  const sentences = normalized.match(/[^.!?]+[.!?]*/g) || [normalized];
  const chunks: string[] = [];
  let current = '';

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    if (sentence.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const words = sentence.split(/\s+/);
      let part = '';
      for (const word of words) {
        if (part && part.length + 1 + word.length > maxLen) {
          chunks.push(part);
          part = word;
        } else {
          part = part ? `${part} ${word}` : word;
        }
      }
      if (part) chunks.push(part);
      continue;
    }

    if (current && current.length + 1 + sentence.length > maxLen) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function isSpeakingAloud(): boolean {
  const browserSpeaking =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    window.speechSynthesis.speaking;
  return ttsQueueActive || browserSpeaking;
}

export function speakAloud(
  text: string,
  lang: LanguageCode = 'en',
  rate = 1,
  onDone?: () => void
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    ttsQueueActive = false;
    onDone?.();
    return false;
  }

  const chunks = splitTextIntoSpeechChunks(text);
  if (chunks.length === 0) {
    ttsQueueActive = false;
    onDone?.();
    return false;
  }

  const token = ++activeSpeechToken;
  window.speechSynthesis.cancel();
  ttsQueueActive = true;

  let index = 0;
  let settled = false;

  const finishAll = (triggerCallback: boolean) => {
    if (settled) return;
    settled = true;
    if (token === activeSpeechToken) {
      ttsQueueActive = false;
    }
    if (triggerCallback) {
      onDone?.();
    }
  };

  const speakNext = () => {
    if (token !== activeSpeechToken) {
      finishAll(false);
      return;
    }
    if (index >= chunks.length) {
      finishAll(true);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.lang = getSpeechLang(lang);
    utterance.rate = rate;

    utterance.onend = () => {
      if (token !== activeSpeechToken) {
        finishAll(false);
        return;
      }
      index += 1;
      speakNext();
    };

    utterance.onerror = () => {
      if (token !== activeSpeechToken) {
        finishAll(false);
        return;
      }
      index += 1;
      speakNext();
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNext();
  return true;
}

export function stopSpeaking(): void {
  activeSpeechToken += 1;
  ttsQueueActive = false;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function playWakeChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.08, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playTone(523.25, 0, 0.11);
    playTone(783.99, 0.1, 0.16);
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Ignore audio context restriction errors
  }
}

export type CalibrationAudioCue = 'lock' | 'step' | 'complete' | 'warn';

export function playCalibrationTone(cue: CalibrationAudioCue): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (
      freq: number,
      startOffset: number,
      duration: number,
      type: OscillatorType = 'sine',
      peakGain = 0.08
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    if (cue === 'lock') {
      playTone(587.33, 0, 0.09, 'sine', 0.075);
      playTone(880, 0.09, 0.14, 'sine', 0.085);
    } else if (cue === 'step') {
      playTone(659.25, 0, 0.12, 'triangle', 0.08);
    } else if (cue === 'complete') {
      playTone(523.25, 0, 0.1, 'sine', 0.075);
      playTone(659.25, 0.09, 0.1, 'sine', 0.08);
      playTone(783.99, 0.18, 0.2, 'sine', 0.09);
    } else {
      playTone(330, 0, 0.11, 'triangle', 0.075);
      playTone(261.63, 0.12, 0.15, 'triangle', 0.075);
    }

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 550);
  } catch {
    // Ignore audio context restriction errors
  }
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function downloadPlainTextNote(title: string, content: string): void {
  const safeName = title.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'educare-note';
  const blob = new Blob([`${title}\n\n${content}`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
