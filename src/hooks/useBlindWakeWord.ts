import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '../types';
import {
  getSpeechLang,
  getSpeechRecognitionCtor,
  isSpeakingAloud,
  playWakeChime,
  stopSpeaking,
  type SpeechRecognitionInstance,
} from '../utils/speech';

export type BlindVoiceState =
  | 'listening'
  | 'armed'
  | 'needs-gesture'
  | 'unsupported';

interface UseBlindWakeWordOptions {
  enabled: boolean;
  language: LanguageCode;
  onCommand: (commandText: string) => void;
  onWakeOnly?: (doneEchoGuard: (durationMs?: number) => void) => void;
  directCommandPatterns?: RegExp[];
}

interface UseBlindWakeWordResult {
  listeningState: BlindVoiceState;
  lastHeard: string;
  armForReply: (durationMs?: number, echoCooldownMs?: number) => void;
  disarmReply: () => void;
  setEchoGuard: (durationMs?: number) => void;
}

const WAKE_WORD_REGEX = /\b(?:hey|hi)\s*,?\s*(?:a\s*\.?\s*i\s*\.?|eye|aye)\b/i;

export function useBlindWakeWord({
  enabled,
  language,
  onCommand,
  onWakeOnly,
  directCommandPatterns,
}: UseBlindWakeWordOptions): UseBlindWakeWordResult {
  const [listeningState, setListeningState] = useState<BlindVoiceState>('listening');
  const [lastHeard, setLastHeard] = useState<string>('');

  const onCommandRef = useRef(onCommand);
  const onWakeOnlyRef = useRef(onWakeOnly);
  const directCommandPatternsRef = useRef<RegExp[] | undefined>(directCommandPatterns);
  onCommandRef.current = onCommand;
  onWakeOnlyRef.current = onWakeOnly;
  directCommandPatternsRef.current = directCommandPatterns;

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const armedRef = useRef<boolean>(false);
  const armTimeoutRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const ignoreResultsUntilRef = useRef<number>(0);
  const blockedByPermissionRef = useRef<boolean>(false);
  const lastProcessedTranscriptRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const isRunningRef = useRef<boolean>(false);
  const enabledRef = useRef<boolean>(enabled);
  enabledRef.current = enabled;

  const clearArmTimer = useCallback(() => {
    if (armTimeoutRef.current !== null) {
      window.clearTimeout(armTimeoutRef.current);
      armTimeoutRef.current = null;
    }
  }, []);

  const setEchoGuard = useCallback((durationMs = 2400) => {
    ignoreResultsUntilRef.current = Date.now() + durationMs;
  }, []);

  const armForCommand = useCallback(
    (durationMs = 15000) => {
      if (!enabledRef.current) return;
      clearArmTimer();
      armedRef.current = true;
      setListeningState('armed');
      armTimeoutRef.current = window.setTimeout(() => {
        armedRef.current = false;
        if (enabledRef.current && !blockedByPermissionRef.current) {
          setListeningState('listening');
        }
      }, durationMs);
    },
    [clearArmTimer]
  );

  const armForReply = useCallback(
    (durationMs = 25000, echoCooldownMs = 450) => {
      if (!enabledRef.current) return;
      if (echoCooldownMs > 0) {
        setEchoGuard(echoCooldownMs);
      }
      armForCommand(durationMs);
    },
    [armForCommand, setEchoGuard]
  );

  const disarmReply = useCallback(() => {
    clearArmTimer();
    armedRef.current = false;
    if (enabledRef.current && !blockedByPermissionRef.current) {
      setListeningState('listening');
    }
  }, [clearArmTimer]);

  useEffect(() => {
    if (!enabled) {
      clearArmTimer();
      armedRef.current = false;
      blockedByPermissionRef.current = false;
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort?.();
          recognitionRef.current.stop();
        } catch {
          // Ignore stop errors
        }
        recognitionRef.current = null;
      }
      isRunningRef.current = false;
      return;
    }

    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) {
      setListeningState('unsupported');
      return;
    }

    let disposed = false;

    const startRecognition = () => {
      if (disposed || !enabledRef.current || isRunningRef.current) return;

      try {
        const recognition = new Recognition();
        recognition.lang = getSpeechLang(language);
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          if (disposed) return;
          isRunningRef.current = true;
          blockedByPermissionRef.current = false;
          setListeningState(armedRef.current ? 'armed' : 'listening');
        };

        recognition.onresult = (event) => {
          if (disposed || !enabledRef.current) return;
          const startIdx = event.resultIndex ?? 0;

          for (let i = startIdx; i < event.results.length; i++) {
            const resultItem = event.results[i];
            if (!resultItem || resultItem.length === 0) continue;

            if (resultItem.isFinal === false) continue;

            const rawTranscript = (resultItem[0]?.transcript || '').trim();
            if (!rawTranscript) continue;

            const now = Date.now();
            const normalized = rawTranscript.toLowerCase().replace(/\s+/g, ' ').trim();

            if (
              lastProcessedTranscriptRef.current.text === normalized &&
              now - lastProcessedTranscriptRef.current.at < 1500
            ) {
              continue;
            }

            const wakeMatch = WAKE_WORD_REGEX.exec(normalized);
            const ttsActive = isSpeakingAloud();

            // Ignore self-echo while EduCare is speaking unless the student explicitly interrupts with "Hey AI" / "Hi AI"
            if (!wakeMatch && (now < ignoreResultsUntilRef.current || ttsActive)) {
              continue;
            }

            lastProcessedTranscriptRef.current = { text: normalized, at: now };
            setLastHeard(rawTranscript);

            if (wakeMatch) {
              const trailing = normalized
                .slice(wakeMatch.index + wakeMatch[0].length)
                .replace(/^[\s,.:;!?-]+/, '')
                .trim();

              stopSpeaking();
              playWakeChime();

              if (trailing.length >= 2) {
                clearArmTimer();
                armedRef.current = false;
                setListeningState('listening');
                setEchoGuard(1500);
                onCommandRef.current(trailing);
              } else {
                armForCommand(15000);
                setEchoGuard(2600);
                onWakeOnlyRef.current?.(setEchoGuard);
              }
              continue;
            }

            if (armedRef.current) {
              clearArmTimer();
              armedRef.current = false;
              setListeningState('listening');
              setEchoGuard(1500);
              onCommandRef.current(normalized);
              continue;
            }

            const matchedDirect = directCommandPatternsRef.current?.some((re) =>
              re.test(normalized)
            );
            if (matchedDirect) {
              playWakeChime();
              setEchoGuard(1600);
              onCommandRef.current(normalized);
            }
          }
        };

        recognition.onerror = (event) => {
          if (disposed) return;
          isRunningRef.current = false;
          const err = event?.error || '';
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            blockedByPermissionRef.current = true;
            setListeningState('needs-gesture');
          } else if (err === 'audio-capture') {
            setListeningState('needs-gesture');
          }
        };

        recognition.onend = () => {
          isRunningRef.current = false;
          if (disposed || !enabledRef.current || blockedByPermissionRef.current) return;
          if (restartTimerRef.current !== null) {
            window.clearTimeout(restartTimerRef.current);
          }
          restartTimerRef.current = window.setTimeout(() => {
            startRecognition();
          }, 280);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch {
        isRunningRef.current = false;
        setListeningState('needs-gesture');
      }
    };

    startRecognition();

    const resumeOnAnyInteraction = () => {
      if (disposed || !enabledRef.current) return;
      if (!isRunningRef.current) {
        blockedByPermissionRef.current = false;
        startRecognition();
      }
    };

    window.addEventListener('pointerdown', resumeOnAnyInteraction, { passive: true });
    window.addEventListener('keydown', resumeOnAnyInteraction, { passive: true });

    return () => {
      disposed = true;
      clearArmTimer();
      window.removeEventListener('pointerdown', resumeOnAnyInteraction);
      window.removeEventListener('keydown', resumeOnAnyInteraction);
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort?.();
          recognitionRef.current.stop();
        } catch {
          // Ignore cleanup stop errors
        }
        recognitionRef.current = null;
      }
      isRunningRef.current = false;
    };
  }, [enabled, language, armForCommand, clearArmTimer, setEchoGuard]);

  return {
    listeningState,
    lastHeard,
    armForReply,
    disarmReply,
    setEchoGuard,
  };
}
