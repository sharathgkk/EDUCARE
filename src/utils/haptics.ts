export type HapticCue =
  | 'success'
  | 'navigate'
  | 'error'
  | 'wake'
  | 'command'
  | 'stop';

export const HAPTIC_PATTERNS: Record<HapticCue, number[]> = {
  // Short double-pulse for Success / Confirmation
  success: [50, 40, 50],
  // Long sustained vibration for Navigation / Section Changed
  navigate: [260],
  // Three rapid pulses for Error / Access Denied
  error: [45, 35, 45, 35, 45],
  // Crisp single pulse when "Hey AI" / "Hi AI" wakes and listens
  wake: [35],
  // Alias of Success / Confirmation double-pulse for confirmed voice actions
  command: [50, 40, 50],
  // Single firm pulse confirming audio/speech stopped
  stop: [100],
};

export const HAPTIC_PATTERN_LABELS: Record<
  HapticCue,
  { title: string; patternText: string; description: string }
> = {
  success: {
    title: 'Success / Confirmation',
    patternText: 'Short double-pulse (50ms · 50ms)',
    description: 'Confirms completed voice actions, settings updates, or active section.',
  },
  navigate: {
    title: 'Navigation / Section Changed',
    patternText: 'Long sustained vibration (260ms)',
    description: 'Confirms you moved to a new section such as AI Tutor, Classes, Notes, or Exam.',
  },
  error: {
    title: 'Error / Access Denied',
    patternText: 'Three rapid pulses (45ms × 3)',
    description: 'Alerts you on restricted access (e.g. Teacher-only portal) or unrecognized command.',
  },
  wake: {
    title: 'Wake Word Armed',
    patternText: '1 crisp pulse (35ms)',
    description: 'Confirms "Hey AI" or "Hi AI" heard you and is ready for your command.',
  },
  command: {
    title: 'Voice Action Confirmed',
    patternText: 'Short double-pulse (50ms · 50ms)',
    description: 'Confirms actions like Read Page, Text Size, Contrast changes, or asking AI Tutor.',
  },
  stop: {
    title: 'Audio Stopped',
    patternText: '1 firm pulse (100ms)',
    description: 'Confirms screen reading or speech output has been silenced.',
  },
};

export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function triggerHaptic(cue: HapticCue, enabled = true): boolean {
  if (!enabled || !isVibrationSupported()) {
    return false;
  }
  try {
    return navigator.vibrate(HAPTIC_PATTERNS[cue]);
  } catch {
    return false;
  }
}

export function cancelHaptic(): void {
  if (!isVibrationSupported()) return;
  try {
    navigator.vibrate(0);
  } catch {
    // Ignore cancellation errors on restricted devices
  }
}
