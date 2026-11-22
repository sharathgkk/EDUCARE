import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Crosshair,
  Hand,
  Maximize2,
  Mic,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { BlindVoiceState } from '../hooks/useBlindWakeWord';
import { isSpeakingAloud, playCalibrationTone } from '../utils/speech';

interface CalibrationBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type CalibrationStep =
  | 'idle'
  | 'position-check'
  | 'top-left'
  | 'bottom-right'
  | 'pinch-verify'
  | 'complete';

export type HandPositionQuality =
  | 'missing'
  | 'too-far'
  | 'too-close'
  | 'off-center'
  | 'optimal';

export type OcdHandVoiceAction =
  | 'start-camera'
  | 'stop-camera'
  | 'calibrate'
  | 'cancel-calibration'
  | 'reset-calibration'
  | 'repeat-calibration-cue'
  | 'skip-calibration-step'
  | 'minimize'
  | 'expand';

interface OcdHandNavigatorProps {
  voiceCommand?: { id: number; action: OcdHandVoiceAction } | null;
  onVoiceFeedback?: (spokenMessage: string, options?: { interrupt?: boolean }) => void;
  voiceState?: BlindVoiceState;
}

const DEFAULT_CALIBRATION: CalibrationBox = {
  minX: 0.16,
  maxX: 0.84,
  minY: 0.16,
  maxY: 0.84,
};

const CALIBRATION_STORAGE_KEY = 'educare_hand_calibration_v1';
const PINCH_ENGAGE_RATIO = 0.35;
const PINCH_RELEASE_RATIO = 0.47;
const PINCH_COOLDOWN_MS = 700;
const POSITION_HOLD_MS = 1200;
const PALM_SCALE_MIN = 0.095;
const PALM_SCALE_MAX = 0.35;

const WIZARD_STEP_META: Array<{ id: Exclude<CalibrationStep, 'idle' | 'complete'>; label: string }> = [
  { id: 'position-check', label: '1. Position' },
  { id: 'top-left', label: '2. Top-Left' },
  { id: 'bottom-right', label: '3. Bottom-Right' },
  { id: 'pinch-verify', label: '4. Verify' },
];

const POSITION_FEEDBACK_META: Record<
  HandPositionQuality,
  { badge: string; hint: string; audioCue: string }
> = {
  missing: {
    badge: 'No Hand Detected',
    hint: 'Raise one open hand in front of your camera.',
    audioCue: 'No hand detected yet. Raise one hand in front of your webcam with clear lighting.',
  },
  'too-far': {
    badge: 'Too Far',
    hint: 'Move your hand closer to the webcam.',
    audioCue: 'Your hand is too far away. Move your hand a little closer to the camera.',
  },
  'too-close': {
    badge: 'Too Close',
    hint: 'Move your hand slightly farther back.',
    audioCue: 'Your hand is too close. Move your hand slightly farther back from the camera.',
  },
  'off-center': {
    badge: 'Off-Center',
    hint: 'Center your hand inside the green camera guide.',
    audioCue: 'Your hand is near the edge. Center your hand inside the camera frame.',
  },
  optimal: {
    badge: 'Optimal Position',
    hint: 'Great framing! Hold steady to lock position...',
    audioCue: 'Great hand position. Hold steady for one second to lock.',
  },
};

function getWizardStepInstruction(step: CalibrationStep): string {
  switch (step) {
    case 'position-check':
      return 'Calibration Wizard Step 1 of 4: Hold one open hand centered in front of your camera at a comfortable distance until position locks.';
    case 'top-left':
      return 'Calibration Wizard Step 2 of 4: Move your index finger near the top-left target corner and pinch thumb and index finger.';
    case 'bottom-right':
      return 'Calibration Wizard Step 3 of 4: Move your index finger near the bottom-right target corner and pinch to set your reach zone.';
    case 'pinch-verify':
      return 'Calibration Wizard Step 4 of 4: Move your calibrated pointer and perform one quick pinch anywhere to verify your click response.';
    case 'complete':
      return 'Hand-tracking calibration wizard complete! Your optimal hand position, custom reach zone, and pinch click are active.';
    default:
      return 'Hand tracking is ready. Say "Hey AI calibration wizard" anytime to run guided calibration.';
  }
}

function readSavedCalibration(): CalibrationBox {
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return DEFAULT_CALIBRATION;
    const parsed = JSON.parse(raw) as Partial<CalibrationBox>;
    if (
      typeof parsed.minX === 'number' &&
      typeof parsed.maxX === 'number' &&
      typeof parsed.minY === 'number' &&
      typeof parsed.maxY === 'number' &&
      parsed.maxX - parsed.minX >= 0.12 &&
      parsed.maxY - parsed.minY >= 0.12
    ) {
      return {
        minX: Math.max(0.02, Math.min(0.85, parsed.minX)),
        maxX: Math.min(0.98, Math.max(0.15, parsed.maxX)),
        minY: Math.max(0.02, Math.min(0.85, parsed.minY)),
        maxY: Math.min(0.98, Math.max(0.15, parsed.maxY)),
      };
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_CALIBRATION;
}

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function findClickableTarget(el: Element | null): HTMLElement | null {
  if (!el) return null;
  const clickable = el.closest(
    'button, a[href], input, select, textarea, label, [role="button"], [role="tab"], [role="option"]'
  );
  if (clickable instanceof HTMLElement && !clickable.hasAttribute('disabled')) {
    return clickable;
  }
  return el instanceof HTMLElement ? el : null;
}

function classifyCameraError(err: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Webcam access requires a secure HTTPS connection or localhost.';
  }
  const domErr = err as { name?: string; message?: string } | null;
  const name = domErr?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission denied. Allow webcam access in your browser address bar, then click Start Camera.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera detected. Connect a webcam and click Start Camera to try again.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera is currently in use by another app or browser tab. Close the other camera stream and retry.';
  }
  if (name === 'OverconstrainedError') {
    return 'Requested camera resolution is unsupported. Please reconnect your webcam and retry.';
  }
  return domErr?.message || 'Unable to start webcam. Check browser camera permissions and try again.';
}

export const OcdHandNavigator: React.FC<OcdHandNavigatorProps> = ({
  voiceCommand = null,
  onVoiceFeedback,
  voiceState = 'listening',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerElRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef<boolean>(false);
  const onVoiceFeedbackRef = useRef<
    ((spokenMessage: string, options?: { interrupt?: boolean }) => void) | undefined
  >(onVoiceFeedback);
  onVoiceFeedbackRef.current = onVoiceFeedback;
  const lastProcessedVoiceCmdIdRef = useRef<number>(0);

  const lastVideoTimeRef = useRef<number>(-1);
  const lastDetectTsRef = useRef<number>(0);

  // Smoothed normalized viewport coordinates [0..1]
  const smoothPosRef = useRef<{ x: number; y: number; initialized: boolean }>({
    x: 0.5,
    y: 0.5,
    initialized: false,
  });

  // Pinch + cooldown + pulse + wizard timers
  const pinchedRef = useRef<boolean>(false);
  const lastPinchClickAtRef = useRef<number>(0);
  const cooldownTimerRef = useRef<number | null>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const wizardCompleteTimerRef = useRef<number | null>(null);

  // Calibration state + refs for rAF loop access
  const [calibration, setCalibration] = useState<CalibrationBox>(readSavedCalibration);
  const calibrationRef = useRef<CalibrationBox>(calibration);
  calibrationRef.current = calibration;

  const [calibrationStep, setCalibrationStep] = useState<CalibrationStep>('idle');
  const calibrationStepRef = useRef<CalibrationStep>('idle');
  calibrationStepRef.current = calibrationStep;
  const pendingTopLeftRef = useRef<{ x: number; y: number } | null>(null);
  const pendingVoiceCalibrateRef = useRef<boolean>(false);

  // Positioning diagnostics & throttled audio coaching refs
  const [positionQuality, setPositionQuality] = useState<HandPositionQuality>('missing');
  const positionQualityRef = useRef<HandPositionQuality>('missing');
  const [positionProgress, setPositionProgress] = useState<number>(0);
  const positionProgressRef = useRef<number>(0);
  const positionHoldStartRef = useRef<number | null>(null);
  const lastAudioCueAtRef = useRef<number>(0);
  const lastAudioCueKindRef = useRef<string>('');

  // UI state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const cameraActiveRef = useRef<boolean>(false);
  cameraActiveRef.current = cameraActive;
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const isInitializingRef = useRef<boolean>(false);
  isInitializingRef.current = isInitializing;
  const [minimized, setMinimized] = useState<boolean>(false);
  const [handDetected, setHandDetected] = useState<boolean>(false);
  const [isPinched, setIsPinched] = useState<boolean>(false);
  const [inCooldown, setInCooldown] = useState<boolean>(false);
  const [clickPulseActive, setClickPulseActive] = useState<boolean>(false);
  const [pointerVisible, setPointerVisible] = useState<boolean>(false);
  const [hoverLabel, setHoverLabel] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>(
    'Ready — say "Hey AI start camera" or "Hey AI calibration wizard".'
  );
  const [errorMsg, setErrorMsg] = useState<string>('');

  const clearWizardTimers = useCallback(() => {
    if (wizardCompleteTimerRef.current !== null) {
      window.clearTimeout(wizardCompleteTimerRef.current);
      wizardCompleteTimerRef.current = null;
    }
  }, []);

  const syncPositionState = useCallback((quality: HandPositionQuality, progress: number) => {
    if (positionQualityRef.current !== quality) {
      positionQualityRef.current = quality;
      setPositionQuality(quality);
    }
    const rounded = Math.min(100, Math.max(0, Math.round(progress / 5) * 5));
    if (positionProgressRef.current !== rounded) {
      positionProgressRef.current = rounded;
      setPositionProgress(rounded);
    }
  }, []);

  const emitCoachingCue = useCallback((cueKey: string, spokenMessage: string) => {
    if (isSpeakingAloud()) return;
    const now = Date.now();
    const minCooldown = cueKey !== lastAudioCueKindRef.current ? 2600 : 4600;
    if (now - lastAudioCueAtRef.current < minCooldown) return;
    lastAudioCueAtRef.current = now;
    lastAudioCueKindRef.current = cueKey;
    onVoiceFeedbackRef.current?.(spokenMessage, { interrupt: false });
  }, []);

  const speakStepTransition = useCallback((stepKey: string, spokenMessage: string) => {
    lastAudioCueAtRef.current = Date.now();
    lastAudioCueKindRef.current = stepKey;
    onVoiceFeedbackRef.current?.(spokenMessage, { interrupt: true });
  }, []);

  const updateCalibration = useCallback((next: CalibrationBox) => {
    calibrationRef.current = next;
    setCalibration(next);
    try {
      window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const triggerClickVisualPulse = useCallback(() => {
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
    }
    setClickPulseActive(true);
    pulseTimerRef.current = window.setTimeout(() => {
      setClickPulseActive(false);
      pulseTimerRef.current = null;
    }, 380);
  }, []);

  const beginWizardSequence = useCallback(
    (prefixMessage?: string) => {
      clearWizardTimers();
      setErrorMsg('');
      setMinimized(false);
      pendingTopLeftRef.current = null;
      positionHoldStartRef.current = null;
      syncPositionState('missing', 0);
      setCalibrationStep('position-check');
      calibrationStepRef.current = 'position-check';
      playCalibrationTone('step');
      const baseInstruction = getWizardStepInstruction('position-check');
      const fullMsg = prefixMessage ? `${prefixMessage} ${baseInstruction}` : baseInstruction;
      setStatusMsg('Wizard Step 1/4: Center one hand at a comfortable distance from the camera.');
      speakStepTransition('step-position-check', fullMsg);
    },
    [clearWizardTimers, speakStepTransition, syncPositionState]
  );

  const finishWizard = useCallback(() => {
    clearWizardTimers();
    playCalibrationTone('complete');
    setCalibrationStep('complete');
    calibrationStepRef.current = 'complete';
    pendingTopLeftRef.current = null;
    positionHoldStartRef.current = null;
    syncPositionState('optimal', 100);
    setStatusMsg('Calibration Wizard complete! Custom reach zone & pinch click active.');
    speakStepTransition('step-complete', getWizardStepInstruction('complete'));
    wizardCompleteTimerRef.current = window.setTimeout(() => {
      wizardCompleteTimerRef.current = null;
      if (calibrationStepRef.current === 'complete') {
        setCalibrationStep('idle');
        calibrationStepRef.current = 'idle';
      }
    }, 3200);
  }, [clearWizardTimers, speakStepTransition, syncPositionState]);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    clearWizardTimers();
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    pinchedRef.current = false;
    smoothPosRef.current.initialized = false;
    lastVideoTimeRef.current = -1;
    pendingVoiceCalibrateRef.current = false;
    pendingTopLeftRef.current = null;
    positionHoldStartRef.current = null;
    syncPositionState('missing', 0);
    setIsPinched(false);
    setInCooldown(false);
    setClickPulseActive(false);
    setHandDetected(false);
    setPointerVisible(false);
    setHoverLabel('');
    setCalibrationStep('idle');
    calibrationStepRef.current = 'idle';
    cameraActiveRef.current = false;
    setCameraActive(false);
    isInitializingRef.current = false;
    setIsInitializing(false);
    setStatusMsg('Camera stopped.');
  }, [clearWizardTimers, syncPositionState]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          // Ignore close error
        }
        landmarkerRef.current = null;
      }
    };
  }, [stopCamera]);

  const drawLandmarksOnCanvas = useCallback(
    (
      landmarks: NormalizedLandmark[] | null,
      pinchingNow: boolean,
      cal: CalibrationBox,
      step: CalibrationStep,
      posQuality: HandPositionQuality,
      nowPerf: number
    ) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const w = video.videoWidth || 320;
      const h = video.videoHeight || 240;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      ctx.save();

      // Wizard Step 1: Center safe-zone guide frame (no text on canvas because canvas is mirrored)
      if (step === 'position-check') {
        const guideLeft = 0.16 * w;
        const guideTop = 0.16 * h;
        const guideW = 0.68 * w;
        const guideH = 0.68 * h;
        ctx.strokeStyle =
          posQuality === 'optimal'
            ? 'rgba(16, 185, 129, 0.92)'
            : posQuality === 'missing'
              ? 'rgba(248, 113, 113, 0.85)'
              : 'rgba(250, 204, 21, 0.9)';
        ctx.lineWidth = posQuality === 'optimal' ? 3 : 2;
        ctx.setLineDash(posQuality === 'optimal' ? [] : [6, 5]);
        ctx.strokeRect(guideLeft, guideTop, guideW, guideH);

        // Center target ring
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 18, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Active or verifying reach zone rectangle (canvas is mirrored via CSS -scale-x-100)
        const boxLeft = (1 - cal.maxX) * w;
        const boxWidth = (cal.maxX - cal.minX) * w;
        const boxTop = cal.minY * h;
        const boxHeight = (cal.maxY - cal.minY) * h;

        ctx.strokeStyle =
          step === 'pinch-verify' || step === 'complete'
            ? 'rgba(16, 185, 129, 0.88)'
            : 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = step === 'pinch-verify' || step === 'complete' ? 2.5 : 1.5;
        ctx.setLineDash(step === 'pinch-verify' || step === 'complete' ? [] : [5, 4]);
        ctx.strokeRect(boxLeft, boxTop, boxWidth, boxHeight);
      }

      // Wizard Step 2 & 3 target corner crosshairs (remember mirroredX maps to raw (1 - mirroredX) * w)
      if (step === 'top-left' || step === 'bottom-right') {
        const pulseRadius = 14 + Math.sin(nowPerf / 180) * 4;
        const targetMirroredX = step === 'top-left' ? 0.18 : 0.82;
        const targetMirroredY = step === 'top-left' ? 0.2 : 0.8;
        const tx = (1 - targetMirroredX) * w;
        const ty = targetMirroredY * h;

        ctx.setLineDash([]);
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(tx, ty, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tx - 10, ty);
        ctx.lineTo(tx + 10, ty);
        ctx.moveTo(tx, ty - 10);
        ctx.lineTo(tx, ty + 10);
        ctx.stroke();
      }

      if (pendingTopLeftRef.current) {
        const tlRawX = (1 - pendingTopLeftRef.current.x) * w;
        const tlRawY = pendingTopLeftRef.current.y * h;
        ctx.setLineDash([]);
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(tlRawX, tlRawY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (!landmarks || landmarks.length === 0) return;

      ctx.save();
      ctx.strokeStyle = pinchingNow ? '#10B981' : '#38BDF8';
      ctx.lineWidth = 2.2;
      for (const conn of HandLandmarker.HAND_CONNECTIONS) {
        const a = landmarks[conn.start];
        const b = landmarks[conn.end];
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
      }

      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const isThumbTip = i === 4;
        const isIndexTip = i === 8;
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, isIndexTip ? 6.5 : isThumbTip ? 5.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isIndexTip
          ? pinchingNow
            ? '#10B981'
            : '#FACC15'
          : isThumbTip
            ? '#FB7185'
            : '#FFFFFF';
        ctx.fill();
        if (isIndexTip || isThumbTip) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#0F172A';
          ctx.stroke();
        }
      }

      const thumb = landmarks[4];
      const index = landmarks[8];
      if (thumb && index && pinchingNow) {
        ctx.beginPath();
        ctx.moveTo(thumb.x * w, thumb.y * h);
        ctx.lineTo(index.x * w, index.y * h);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        const midX = ((thumb.x + index.x) / 2) * w;
        const midY = ((thumb.y + index.y) / 2) * h;
        ctx.beginPath();
        ctx.arc(midX, midY, 12, 0, Math.PI * 2);
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    },
    []
  );

  const ensureHandLandmarker = useCallback(async (): Promise<HandLandmarker> => {
    if (landmarkerRef.current) return landmarkerRef.current;

    const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
    const createWithDelegate = async (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/models/hand_landmarker.task',
          delegate,
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });

    try {
      const gpuLandmarker = await createWithDelegate('GPU');
      landmarkerRef.current = gpuLandmarker;
      return gpuLandmarker;
    } catch {
      const cpuLandmarker = await createWithDelegate('CPU');
      landmarkerRef.current = cpuLandmarker;
      return cpuLandmarker;
    }
  }, []);

  const processFrame = useCallback(() => {
    if (!runningRef.current) return;

    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) {
      rafRef.current = window.requestAnimationFrame(processFrame);
      return;
    }

    if (
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      video.currentTime !== lastVideoTimeRef.current
    ) {
      lastVideoTimeRef.current = video.currentTime;
      const nowPerf = performance.now();
      const ts = Math.max(nowPerf, lastDetectTsRef.current + 1);
      lastDetectTsRef.current = ts;

      let landmarks: NormalizedLandmark[] | null = null;
      try {
        const result = landmarker.detectForVideo(video, ts);
        landmarks = result?.landmarks?.[0] ?? null;
      } catch {
        landmarks = null;
      }

      const activeStep = calibrationStepRef.current;

      if (!landmarks || landmarks.length < 21) {
        setHandDetected(false);
        pinchedRef.current = false;
        setIsPinched(false);
        setPointerVisible(false);
        setHoverLabel('');
        positionHoldStartRef.current = null;
        syncPositionState('missing', 0);

        if (activeStep === 'position-check') {
          emitCoachingCue('missing-hand-pos', POSITION_FEEDBACK_META.missing.audioCue);
        } else if (activeStep === 'top-left' || activeStep === 'bottom-right') {
          emitCoachingCue(
            `missing-hand-${activeStep}`,
            `Hand not visible. Hold your hand in view of the camera and pinch near the ${
              activeStep === 'top-left' ? 'top-left' : 'bottom-right'
            } target.`
          );
        } else if (activeStep === 'pinch-verify') {
          emitCoachingCue(
            'missing-hand-verify',
            'Show one hand in front of the camera and perform one pinch to complete verification.'
          );
        }

        drawLandmarksOnCanvas(
          null,
          false,
          calibrationRef.current,
          activeStep,
          'missing',
          nowPerf
        );
      } else {
        setHandDetected(true);

        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleMcp = landmarks[9];

        // Scale-invariant pinch ratio + raw palm scale for distance/framing diagnostics
        const rawPalmScale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y);
        const palmScale = Math.max(0.06, rawPalmScale);
        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        const pinchRatio = pinchDist / palmScale;

        const wasPinched = pinchedRef.current;
        const nowPinched = wasPinched
          ? pinchRatio < PINCH_RELEASE_RATIO
          : pinchRatio < PINCH_ENGAGE_RATIO;
        pinchedRef.current = nowPinched;
        setIsPinched(nowPinched);

        // Mirrored normalized hand fingertip & palm center coordinates (0 = left edge, 1 = right edge)
        const mirroredX = clamp01(1 - indexTip.x);
        const mirroredY = clamp01(indexTip.y);
        const palmCenterX = clamp01(1 - (wrist.x + middleMcp.x) / 2);
        const palmCenterY = clamp01((wrist.y + middleMcp.y) / 2);

        // Real-time positioning quality check
        let detectedQuality: HandPositionQuality = 'optimal';
        if (rawPalmScale < PALM_SCALE_MIN) {
          detectedQuality = 'too-far';
        } else if (rawPalmScale > PALM_SCALE_MAX) {
          detectedQuality = 'too-close';
        } else if (
          palmCenterX < 0.14 ||
          palmCenterX > 0.86 ||
          palmCenterY < 0.14 ||
          palmCenterY > 0.88
        ) {
          detectedQuality = 'off-center';
        }

        const cal = calibrationRef.current;
        drawLandmarksOnCanvas(landmarks, nowPinched, cal, activeStep, detectedQuality, nowPerf);

        // Step 1 of Calibration Wizard: Auto-lock optimal hand position with audio guidance
        if (activeStep === 'position-check') {
          if (detectedQuality === 'optimal') {
            if (positionHoldStartRef.current === null) {
              positionHoldStartRef.current = nowPerf;
              syncPositionState('optimal', 5);
              emitCoachingCue('pos-optimal', POSITION_FEEDBACK_META.optimal.audioCue);
            } else {
              const elapsed = nowPerf - positionHoldStartRef.current;
              const pct = Math.min(100, (elapsed / POSITION_HOLD_MS) * 100);
              syncPositionState('optimal', pct);

              if (elapsed >= POSITION_HOLD_MS) {
                playCalibrationTone('lock');
                positionHoldStartRef.current = null;
                pendingTopLeftRef.current = null;
                setCalibrationStep('top-left');
                calibrationStepRef.current = 'top-left';
                setStatusMsg('Position locked! Wizard Step 2/4: Pinch near comfortable TOP-LEFT.');
                speakStepTransition(
                  'step-top-left',
                  `Hand position locked! ${getWizardStepInstruction('top-left')}`
                );
              }
            }
          } else {
            positionHoldStartRef.current = null;
            syncPositionState(detectedQuality, 0);
            emitCoachingCue(
              `pos-${detectedQuality}`,
              POSITION_FEEDBACK_META[detectedQuality].audioCue
            );
          }
        } else {
          syncPositionState(detectedQuality, 0);
        }

        // Map raw mirrored coordinates into calibrated [0..1] screen range
        const spanX = Math.max(0.12, cal.maxX - cal.minX);
        const spanY = Math.max(0.12, cal.maxY - cal.minY);
        const targetNormX = clamp01((mirroredX - cal.minX) / spanX);
        const targetNormY = clamp01((mirroredY - cal.minY) / spanY);

        // Adaptive exponential smoothing to suppress hand jitter while keeping sweeps responsive
        if (!smoothPosRef.current.initialized) {
          smoothPosRef.current = { x: targetNormX, y: targetNormY, initialized: true };
        } else {
          const dx = targetNormX - smoothPosRef.current.x;
          const dy = targetNormY - smoothPosRef.current.y;
          const dist = Math.hypot(dx, dy);
          const alpha = dist < 0.004 ? 0.1 : dist < 0.02 ? 0.22 : 0.36;
          smoothPosRef.current.x += dx * alpha;
          smoothPosRef.current.y += dy * alpha;
        }

        const viewX = Math.round(smoothPosRef.current.x * window.innerWidth);
        const viewY = Math.round(smoothPosRef.current.y * window.innerHeight);

        if (pointerElRef.current) {
          pointerElRef.current.style.transform = `translate3d(${viewX}px, ${viewY}px, 0)`;
        }
        setPointerVisible(true);

        const rawUnder = document.elementFromPoint(viewX, viewY);
        const clickable = findClickableTarget(rawUnder);
        const label =
          clickable?.getAttribute('aria-label') ||
          clickable?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 28) ||
          '';
        setHoverLabel(clickable ? label : '');

        const nowMs = Date.now();
        const stillCoolingDown = nowMs - lastPinchClickAtRef.current < PINCH_COOLDOWN_MS;
        setInCooldown(stillCoolingDown);

        // Trigger once on pinch engage transition with cooldown guard
        if (!wasPinched && nowPinched && !stillCoolingDown) {
          lastPinchClickAtRef.current = nowMs;
          setInCooldown(true);
          if (cooldownTimerRef.current !== null) {
            window.clearTimeout(cooldownTimerRef.current);
          }
          cooldownTimerRef.current = window.setTimeout(() => {
            setInCooldown(false);
            cooldownTimerRef.current = null;
          }, PINCH_COOLDOWN_MS);

          const stepNow = calibrationStepRef.current;
          if (stepNow === 'position-check') {
            emitCoachingCue(
              'pos-keep-open',
              'Keep your hand open and centered for one second first before pinching.'
            );
          } else if (stepNow === 'top-left') {
            pendingTopLeftRef.current = { x: mirroredX, y: mirroredY };
            playCalibrationTone('step');
            setCalibrationStep('bottom-right');
            calibrationStepRef.current = 'bottom-right';
            setStatusMsg(
              'Top-left corner saved! Wizard Step 3/4: Move finger to BOTTOM-RIGHT & pinch.'
            );
            speakStepTransition(
              'step-bottom-right',
              `Top-left corner saved. ${getWizardStepInstruction('bottom-right')}`
            );
          } else if (stepNow === 'bottom-right') {
            const tl = pendingTopLeftRef.current || { x: 0.18, y: 0.18 };
            const minX = Math.max(0.02, Math.min(tl.x, mirroredX));
            const maxX = Math.min(0.98, Math.max(tl.x, mirroredX));
            const minY = Math.max(0.02, Math.min(tl.y, mirroredY));
            const maxY = Math.min(0.98, Math.max(tl.y, mirroredY));

            if (maxX - minX < 0.14 || maxY - minY < 0.14) {
              playCalibrationTone('warn');
              pendingTopLeftRef.current = null;
              setCalibrationStep('top-left');
              calibrationStepRef.current = 'top-left';
              setStatusMsg(
                'Reach area was too small — reach wider between TOP-LEFT and BOTTOM-RIGHT.'
              );
              speakStepTransition(
                'step-too-small',
                'Reach area was too narrow. Let us repeat Step 2: pinch near a wider top-left corner first.'
              );
            } else {
              updateCalibration({ minX, maxX, minY, maxY });
              pendingTopLeftRef.current = null;
              playCalibrationTone('step');
              setCalibrationStep('pinch-verify');
              calibrationStepRef.current = 'pinch-verify';
              setStatusMsg(
                'Reach zone saved! Wizard Step 4/4: Move pointer & pinch once to confirm.'
              );
              speakStepTransition(
                'step-pinch-verify',
                `Reach zone saved! ${getWizardStepInstruction('pinch-verify')}`
              );
            }
          } else if (stepNow === 'pinch-verify') {
            triggerClickVisualPulse();
            finishWizard();
          } else if (clickable) {
            triggerClickVisualPulse();
            clickable.focus?.();
            clickable.click();
            setStatusMsg(label ? `Pinch clicked: "${label}"` : 'Pinch click triggered.');
          } else {
            triggerClickVisualPulse();
            setStatusMsg('Pinch detected (move pointer over a button or link to click).');
          }
        }
      }
    }

    rafRef.current = window.requestAnimationFrame(processFrame);
  }, [
    drawLandmarksOnCanvas,
    emitCoachingCue,
    finishWizard,
    speakStepTransition,
    syncPositionState,
    triggerClickVisualPulse,
    updateCalibration,
  ]);

  const startCamera = useCallback(
    async (options?: { autoCalibrate?: boolean; fromVoice?: boolean }) => {
      if (cameraActiveRef.current || isInitializingRef.current) return;
      if (options?.autoCalibrate) {
        pendingVoiceCalibrateRef.current = true;
      }
      setErrorMsg('');
      isInitializingRef.current = true;
      setIsInitializing(true);
      setStatusMsg('Requesting webcam permission and loading on-device Hand Landmarker...');

      try {
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          throw new Error('Webcam access requires a secure HTTPS connection or localhost.');
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Your browser does not support webcam access (getUserMedia unavailable).');
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });
        } catch (constraintErr: unknown) {
          const name = (constraintErr as { name?: string })?.name;
          if (name === 'OverconstrainedError') {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } else {
            throw constraintErr;
          }
        }

        streamRef.current = stream;
        await ensureHandLandmarker();

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        runningRef.current = true;
        cameraActiveRef.current = true;
        setCameraActive(true);
        isInitializingRef.current = false;
        setIsInitializing(false);

        const shouldCalibrate = pendingVoiceCalibrateRef.current;
        pendingVoiceCalibrateRef.current = false;

        if (shouldCalibrate) {
          beginWizardSequence('Camera started.');
        } else {
          setStatusMsg('Hand tracking active on-device — point index finger & pinch to click.');
          if (options?.fromVoice) {
            speakStepTransition(
              'camera-started',
              'Hand navigation camera started on-device. Say calibration wizard anytime for guided hand positioning, or pinch thumb and index finger to click.'
            );
          }
        }

        rafRef.current = window.requestAnimationFrame(processFrame);
      } catch (err: unknown) {
        stopCamera();
        const friendly = classifyCameraError(err);
        setErrorMsg(friendly);
        setStatusMsg('Camera unavailable.');
        speakStepTransition('camera-error', friendly);
      }
    },
    [beginWizardSequence, ensureHandLandmarker, processFrame, speakStepTransition, stopCamera]
  );

  const handleStartCalibrationWizard = useCallback(
    (fromVoice = false) => {
      if (!cameraActiveRef.current) {
        if (fromVoice) {
          void startCamera({ autoCalibrate: true, fromVoice: true });
        } else {
          void startCamera({ autoCalibrate: true, fromVoice: false });
        }
        return;
      }
      beginWizardSequence();
    },
    [beginWizardSequence, startCamera]
  );

  const handleCancelCalibration = useCallback(
    (fromVoice = false) => {
      clearWizardTimers();
      pendingTopLeftRef.current = null;
      pendingVoiceCalibrateRef.current = false;
      positionHoldStartRef.current = null;
      syncPositionState('missing', 0);
      setCalibrationStep('idle');
      calibrationStepRef.current = 'idle';
      setStatusMsg('Calibration wizard cancelled.');
      if (fromVoice) {
        speakStepTransition('wizard-cancelled', 'Hand calibration wizard cancelled.');
      }
    },
    [clearWizardTimers, speakStepTransition, syncPositionState]
  );

  const handleSkipWizardStep = useCallback(
    (fromVoice = false) => {
      const stepNow = calibrationStepRef.current;
      if (stepNow === 'position-check') {
        playCalibrationTone('lock');
        positionHoldStartRef.current = null;
        pendingTopLeftRef.current = null;
        setCalibrationStep('top-left');
        calibrationStepRef.current = 'top-left';
        setStatusMsg('Wizard Step 2/4: Move index finger to comfortable TOP-LEFT & pinch.');
        speakStepTransition('step-top-left', getWizardStepInstruction('top-left'));
      } else if (stepNow === 'pinch-verify') {
        finishWizard();
      } else if (fromVoice && stepNow !== 'idle') {
        speakStepTransition(
          'skip-hint',
          `Pinch at the ${
            stepNow === 'top-left' ? 'top-left' : 'bottom-right'
          } corner to capture this bound, or say cancel calibration.`
        );
      }
    },
    [finishWizard, speakStepTransition]
  );

  const handleResetCalibration = useCallback(
    (fromVoice = false) => {
      clearWizardTimers();
      pendingTopLeftRef.current = null;
      positionHoldStartRef.current = null;
      syncPositionState('missing', 0);
      setCalibrationStep('idle');
      calibrationStepRef.current = 'idle';
      updateCalibration(DEFAULT_CALIBRATION);
      setStatusMsg('Calibration reset to default center reach zone.');
      if (fromVoice) {
        speakStepTransition(
          'calibration-reset',
          'Hand calibration reset to default center reach zone.'
        );
      }
    },
    [clearWizardTimers, speakStepTransition, syncPositionState, updateCalibration]
  );

  useEffect(() => {
    if (!voiceCommand || voiceCommand.id === lastProcessedVoiceCmdIdRef.current) return;
    lastProcessedVoiceCmdIdRef.current = voiceCommand.id;

    switch (voiceCommand.action) {
      case 'start-camera':
        if (cameraActiveRef.current) {
          setStatusMsg('Hand navigation camera is already active.');
          speakStepTransition('camera-already-active', 'Hand navigation camera is already active.');
        } else if (isInitializingRef.current) {
          speakStepTransition('camera-starting', 'Hand navigation camera is starting.');
        } else {
          void startCamera({ fromVoice: true });
        }
        break;

      case 'stop-camera':
        if (!cameraActiveRef.current && !isInitializingRef.current) {
          speakStepTransition('camera-already-stopped', 'Hand navigation camera is already stopped.');
        } else {
          stopCamera();
          speakStepTransition('camera-stopped', 'Hand navigation camera stopped.');
        }
        break;

      case 'calibrate':
        if (cameraActiveRef.current) {
          beginWizardSequence();
        } else if (isInitializingRef.current) {
          pendingVoiceCalibrateRef.current = true;
          speakStepTransition(
            'wizard-queued',
            'Camera is starting. The hand-tracking calibration wizard will begin automatically in a moment.'
          );
        } else {
          void startCamera({ autoCalibrate: true, fromVoice: true });
        }
        break;

      case 'repeat-calibration-cue':
        speakStepTransition(
          `repeat-${calibrationStepRef.current}`,
          getWizardStepInstruction(calibrationStepRef.current)
        );
        break;

      case 'skip-calibration-step':
        handleSkipWizardStep(true);
        break;

      case 'cancel-calibration':
        handleCancelCalibration(true);
        break;

      case 'reset-calibration':
        handleResetCalibration(true);
        break;

      case 'minimize':
        setMinimized(true);
        setStatusMsg('Hand navigation preview minimized.');
        speakStepTransition('preview-minimized', 'Minimized hand navigation preview.');
        break;

      case 'expand':
        setMinimized(false);
        setStatusMsg('Hand navigation preview expanded.');
        speakStepTransition('preview-expanded', 'Expanded hand navigation preview.');
        break;
    }
  }, [
    voiceCommand,
    startCamera,
    stopCamera,
    beginWizardSequence,
    handleSkipWizardStep,
    handleCancelCalibration,
    handleResetCalibration,
    speakStepTransition,
  ]);

  const isWizardRunning = calibrationStep !== 'idle' && calibrationStep !== 'complete';
  const posMeta = POSITION_FEEDBACK_META[positionQuality];

  return (
    <>
      {/* Large Floating Hand Pointer (never intercepts elementFromPoint hits) */}
      <div
        ref={pointerElRef}
        aria-hidden="true"
        style={{
          transform: 'translate3d(50vw, 50vh, 0)',
          display: cameraActive && pointerVisible ? 'block' : 'none',
        }}
        className="fixed top-0 left-0 z-[70] pointer-events-none will-change-transform"
      >
        <div
          className={`-translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-transform duration-75 ${
            isPinched || clickPulseActive ? 'scale-90' : 'scale-100'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full border-4 shadow-lg flex items-center justify-center transition-colors ${
              clickPulseActive
                ? 'border-emerald-400 bg-emerald-400/35 ring-4 ring-emerald-300/60'
                : isPinched
                  ? 'border-amber-400 bg-amber-400/30'
                  : hoverLabel
                    ? 'border-[#1D6CE0] bg-sky-400/25 ring-2 ring-white/80'
                    : 'border-sky-500 bg-sky-500/15 ring-2 ring-white/70'
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded-full shadow-xs ${
                isPinched || clickPulseActive
                  ? 'bg-emerald-500'
                  : hoverLabel
                    ? 'bg-[#1D6CE0]'
                    : 'bg-sky-500'
              }`}
            />
          </div>

          {(hoverLabel || calibrationStep !== 'idle' || inCooldown) && (
            <span className="mt-1.5 px-2.5 py-0.5 rounded-md bg-slate-950/90 text-white text-[11px] font-semibold whitespace-nowrap shadow-md border border-white/20">
              {calibrationStep === 'position-check'
                ? posMeta.badge
                : calibrationStep === 'top-left'
                  ? 'Pinch Top-Left'
                  : calibrationStep === 'bottom-right'
                    ? 'Pinch Bottom-Right'
                    : calibrationStep === 'pinch-verify'
                      ? 'Pinch Once to Verify'
                      : calibrationStep === 'complete'
                        ? 'Calibration Complete!'
                        : inCooldown
                          ? 'Clicked (Cooldown)'
                          : `Pinch: ${hoverLabel}`}
            </span>
          )}
        </div>
      </div>

      {/* Compact Top-Right Hand Navigation Dock + Guided Calibration Wizard */}
      <aside
        aria-label="OCD Hand Navigation Camera Dock"
        className="fixed top-3 right-3 z-[60] w-[272px] sm:w-[308px] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-2 border-[#7AA7D9] dark:border-sky-600 shadow-xl overflow-hidden text-xs"
      >
        <div className="px-3 py-2 bg-[#153B70] dark:bg-slate-800 text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Hand className="w-4 h-4 text-sky-300 shrink-0" aria-hidden="true" />
            <span className="font-bold truncate">Hand Navigator</span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                cameraActive
                  ? handDetected
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-300'
                  : 'bg-slate-400'
              }`}
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-semibold text-emerald-300 inline-flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
              <span>Local</span>
            </span>
            <button
              type="button"
              onClick={() => setMinimized((m) => !m)}
              aria-label={minimized ? 'Expand hand navigation panel' : 'Minimize hand navigation panel'}
              className="p-1 rounded-md hover:bg-white/15 text-white cursor-pointer"
            >
              {minimized ? (
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Camera Feed with Landmarks + Wizard Guides Overlay */}
        <div
          className={`relative bg-slate-950 w-full overflow-hidden ${
            minimized ? 'h-0' : 'aspect-[4/3]'
          }`}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="On-device webcam hand navigation preview"
            className="w-full h-full object-cover -scale-x-100"
          />
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100"
          />

          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 bg-slate-950/85 text-slate-200 gap-1.5">
              <Camera className="w-6 h-6 text-sky-400" aria-hidden="true" />
              <p className="font-semibold text-xs">On-Device Hand Navigation</p>
              <p className="text-[11px] text-slate-400 leading-snug">
                Point index finger to move cursor. Pinch thumb &amp; index to click.
              </p>
            </div>
          )}

          {cameraActive && (
            <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  isPinched
                    ? 'bg-emerald-500 text-slate-950'
                    : calibrationStep === 'position-check'
                      ? positionQuality === 'optimal'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-400 text-slate-950'
                      : handDetected
                        ? 'bg-slate-950/80 text-sky-300 border border-sky-400/50'
                        : 'bg-amber-500/90 text-slate-950'
                }`}
              >
                {calibrationStep === 'position-check'
                  ? posMeta.badge
                  : isPinched
                    ? 'PINCH CLICK'
                    : handDetected
                      ? '1 Hand Tracked'
                      : 'Show 1 Hand'}
              </span>
              {inCooldown && (
                <span className="px-1.5 py-0.5 rounded-md bg-slate-950/85 text-amber-300 text-[10px] font-mono">
                  Cooldown
                </span>
              )}
            </div>
          )}

          {/* Bottom live target hint inside camera preview during wizard */}
          {cameraActive && calibrationStep !== 'idle' && (
            <div className="absolute bottom-1.5 left-1.5 right-1.5 pointer-events-none flex justify-center">
              <span className="px-2 py-0.5 rounded-md bg-slate-950/85 text-amber-200 border border-amber-400/50 text-[10px] font-semibold text-center">
                {calibrationStep === 'position-check'
                  ? posMeta.hint
                  : calibrationStep === 'top-left'
                    ? 'Aim near top-left circle & pinch'
                    : calibrationStep === 'bottom-right'
                      ? 'Aim near bottom-right circle & pinch'
                      : calibrationStep === 'pinch-verify'
                        ? 'Do 1 quick pinch to confirm click'
                        : 'Wizard Complete!'}
              </span>
            </div>
          )}
        </div>

        {/* Controls & Wizard Panel */}
        <div className="p-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={cameraActive || isInitializing}
              className="flex-1 min-h-[34px] px-2.5 py-1.5 rounded-lg bg-[#1D6CE0] hover:bg-[#1659BD] disabled:opacity-50 text-white font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{isInitializing ? 'Starting...' : 'Start Camera'}</span>
            </button>

            <button
              type="button"
              onClick={stopCamera}
              disabled={!cameraActive && !isInitializing}
              className="flex-1 min-h-[34px] px-2.5 py-1.5 rounded-lg bg-[#DF922C] hover:bg-[#C67F21] disabled:opacity-50 text-white font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <CameraOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Stop Camera</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={
                calibrationStep === 'idle' || calibrationStep === 'complete'
                  ? () => handleStartCalibrationWizard(false)
                  : () => handleCancelCalibration(false)
              }
              className={`flex-1 min-h-[32px] px-2.5 py-1 rounded-lg border font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isWizardRunning
                  ? 'bg-amber-100 dark:bg-amber-950/70 border-amber-400 text-amber-900 dark:text-amber-200'
                  : 'bg-[#F8FAFD] dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-[#153B70] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{isWizardRunning ? 'Cancel Wizard' : 'Calibration Wizard'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleResetCalibration(false)}
              title="Reset calibration to default zone"
              className="min-h-[32px] px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          {/* Active Calibration Wizard Guidance Card */}
          {calibrationStep !== 'idle' && (
            <div
              role="region"
              aria-label="Hand-Tracking Calibration Wizard"
              className={`p-2.5 rounded-xl border space-y-2 ${
                calibrationStep === 'complete'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-950 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                  {calibrationStep === 'complete' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  )}
                  <span>
                    {calibrationStep === 'complete' ? 'Wizard Complete' : 'Calibration Wizard'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    speakStepTransition(
                      `replay-${calibrationStep}`,
                      getWizardStepInstruction(calibrationStep)
                    )
                  }
                  aria-label="Replay step audio cue"
                  className="px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/70 border border-amber-300/70 dark:border-amber-700 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-white"
                >
                  <Volume2 className="w-3 h-3" aria-hidden="true" />
                  <span>Audio Cue</span>
                </button>
              </div>

              {/* 4-Step Progress Pills */}
              <div className="grid grid-cols-4 gap-1">
                {WIZARD_STEP_META.map((item, idx) => {
                  const stepOrder = WIZARD_STEP_META.findIndex((s) => s.id === calibrationStep);
                  const isDone = calibrationStep === 'complete' || (stepOrder > idx && stepOrder >= 0);
                  const isCurrent = item.id === calibrationStep;
                  return (
                    <div
                      key={item.id}
                      className={`px-1 py-0.5 rounded text-center text-[9px] font-bold truncate ${
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                            ? 'bg-[#1D6CE0] text-white'
                            : 'bg-white/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {item.label}
                    </div>
                  );
                })}
              </div>

              {/* Step 1 Hand Positioning Lock Progress Meter */}
              {calibrationStep === 'position-check' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-semibold">
                    <span>Position Lock: {posMeta.badge}</span>
                    <span className="font-mono">{positionProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-amber-200/80 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${positionProgress}%` }}
                      className={`h-full transition-all duration-100 ${
                        positionQuality === 'optimal' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              <p className="text-[11px] font-medium leading-snug">
                {calibrationStep === 'position-check'
                  ? 'Step 1/4: Hold one open hand centered inside the guide box until position locks.'
                  : calibrationStep === 'top-left'
                    ? 'Step 2/4: Move your index finger near comfortable TOP-LEFT and pinch.'
                    : calibrationStep === 'bottom-right'
                      ? 'Step 3/4: Move your index finger near comfortable BOTTOM-RIGHT and pinch.'
                      : calibrationStep === 'pinch-verify'
                        ? 'Step 4/4: Move your calibrated pointer and pinch once to confirm.'
                        : 'Optimal hand position, custom reach zone, and pinch click are saved.'}
              </p>

              {(calibrationStep === 'position-check' || calibrationStep === 'pinch-verify') && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSkipWizardStep(false)}
                    className="px-2 py-0.5 rounded-md bg-white/85 dark:bg-slate-900/70 border border-amber-300 dark:border-amber-700 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-white"
                  >
                    <SkipForward className="w-3 h-3" aria-hidden="true" />
                    <span>{calibrationStep === 'pinch-verify' ? 'Finish' : 'Next Step'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <p
            role="status"
            aria-live="polite"
            className="text-[11px] text-[#44566C] dark:text-slate-300 leading-snug"
          >
            {statusMsg}
          </p>

          {errorMsg && (
            <div
              role="alert"
              className="p-2 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-[11px] text-red-800 dark:text-red-200 flex items-start gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div
            role="status"
            className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 ${
              voiceState === 'armed'
                ? 'bg-[#1D6CE0] text-white border-[#153B70]'
                : 'bg-[#EEF5FC] dark:bg-slate-800 text-[#153B70] dark:text-sky-200 border-[#B9D3EE] dark:border-slate-700'
            }`}
          >
            <Mic className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="leading-tight">
              {voiceState === 'armed'
                ? 'Listening: "Calibration Wizard", "Start Camera", "Repeat Step"'
                : voiceState === 'needs-gesture'
                  ? 'Tap anywhere once to enable voice mic'
                  : voiceState === 'unsupported'
                    ? 'Voice mic unavailable — 100% on-device tracking'
                    : 'Voice: "Calibration Wizard", "Start Camera", "Stop Camera"'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
