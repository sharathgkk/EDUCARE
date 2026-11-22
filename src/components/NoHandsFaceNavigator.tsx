import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import {
  AlertTriangle,
  ArrowDownUp,
  Camera,
  CameraOff,
  CheckCircle2,
  Crosshair,
  Eye,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { playCalibrationTone } from '../utils/speech';

interface FaceCalibration {
  centerX: number;
  centerY: number;
  calibrated: boolean;
}

interface FacePrefs {
  sensitivity: number;
  smoothing: number;
  nodConfirmEnabled: boolean;
}

type BlinkPhase = 'ready' | 'first-blink' | 'clicked' | 'cooldown';
type NodStage = 'idle' | 'down-tilted' | 'confirmed';

const CALIBRATION_STORAGE_KEY = 'educare_face_calibration_v1';
const PREFS_STORAGE_KEY = 'educare_face_prefs_v1';

const DEFAULT_CALIBRATION: FaceCalibration = {
  centerX: 0,
  centerY: 0.28,
  calibrated: false,
};

const DEFAULT_PREFS: FacePrefs = {
  sensitivity: 1.5,
  smoothing: 0.65,
  nodConfirmEnabled: true,
};

const BLINK_ENGAGE_AVG = 0.48;
const BLINK_ENGAGE_MIN_EYE = 0.34;
const BLINK_RELEASE_AVG = 0.28;
const EAR_ENGAGE_THRESHOLD = 0.2;
const EAR_RELEASE_THRESHOLD = 0.23;
const MIN_DELIBERATE_BLINK_MS = 185;
const MAX_DELIBERATE_BLINK_MS = 950;
const DOUBLE_BLINK_WINDOW_MS = 1300;
const BLINK_CLICK_COOLDOWN_MS = 1200;
const BLINK_INDICATOR_FLASH_MS = 550;

// Subtle downward-then-upward head tilt thresholds for "Nod to Confirm"
const NOD_DOWN_THRESHOLD = 0.032;
const NOD_RETURN_THRESHOLD = 0.015;
const NOD_MIN_DURATION_MS = 130;
const NOD_MAX_DURATION_MS = 1400;
const NOD_COOLDOWN_MS = 1600;

const CALIBRATION_FRAMES_TARGET = 15;

// Key facial tracking point indices (nose tip, nose bridge, eye corners, eyebrows, temples, chin, mouth)
const TRACKING_POINT_INDICES = [
  1, 4, 10, 33, 61, 133, 152, 159, 145, 168, 234, 263, 291, 362, 386, 374, 454,
];

function readSavedCalibration(): FaceCalibration {
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return DEFAULT_CALIBRATION;
    const parsed = JSON.parse(raw) as Partial<FaceCalibration>;
    if (
      typeof parsed.centerX === 'number' &&
      Number.isFinite(parsed.centerX) &&
      typeof parsed.centerY === 'number' &&
      Number.isFinite(parsed.centerY)
    ) {
      return {
        centerX: Math.max(-0.8, Math.min(0.8, parsed.centerX)),
        centerY: Math.max(-0.5, Math.min(0.9, parsed.centerY)),
        calibrated: Boolean(parsed.calibrated),
      };
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_CALIBRATION;
}

function readSavedPrefs(): FacePrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<FacePrefs>;
    const sensitivity =
      typeof parsed.sensitivity === 'number' && Number.isFinite(parsed.sensitivity)
        ? Math.max(0.6, Math.min(3.0, parsed.sensitivity))
        : DEFAULT_PREFS.sensitivity;
    const smoothing =
      typeof parsed.smoothing === 'number' && Number.isFinite(parsed.smoothing)
        ? Math.max(0.15, Math.min(0.85, parsed.smoothing))
        : DEFAULT_PREFS.smoothing;
    const nodConfirmEnabled =
      typeof parsed.nodConfirmEnabled === 'boolean'
        ? parsed.nodConfirmEnabled
        : DEFAULT_PREFS.nodConfirmEnabled;
    return { sensitivity, smoothing, nodConfirmEnabled };
  } catch {
    return DEFAULT_PREFS;
  }
}

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function computeEyeAspectRatio(
  landmarks: NormalizedLandmark[],
  outerIdx: number,
  innerIdx: number,
  topAIdx: number,
  topBIdx: number,
  bottomAIdx: number,
  bottomBIdx: number
): number {
  const outer = landmarks[outerIdx];
  const inner = landmarks[innerIdx];
  const topA = landmarks[topAIdx];
  const topB = landmarks[topBIdx];
  const bottomA = landmarks[bottomAIdx];
  const bottomB = landmarks[bottomBIdx];
  if (!outer || !inner || !topA || !topB || !bottomA || !bottomB) return 0.32;

  const horiz = Math.max(0.004, Math.hypot(inner.x - outer.x, inner.y - outer.y));
  const vertA = Math.hypot(topA.x - bottomA.x, topA.y - bottomA.y);
  const vertB = Math.hypot(topB.x - bottomB.x, topB.y - bottomB.y);
  return (vertA + vertB) / (2 * horiz);
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

function isElementVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findConfirmButtonInContainer(root: ParentNode): HTMLElement | null {
  const tagged = root.querySelector<HTMLElement>(
    '[data-nod-confirm="true"]:not([disabled])'
  );
  if (tagged && isElementVisible(tagged)) return tagged;

  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [role="button"]:not([aria-disabled="true"])'
    )
  ).filter(isElementVisible);

  const confirmTextMatch = candidates.find((btn) =>
    /^(?:yes\b|confirm\b|ok\b|okay\b|accept\b|agree\b|continue\b|allow\b|submit\b|done\b|close\b)/i.test(
      (btn.getAttribute('aria-label') || btn.textContent || '').trim()
    )
  );
  if (confirmTextMatch) return confirmTextMatch;

  const submitBtn = candidates.find((btn) => btn.getAttribute('type') === 'submit');
  return submitBtn || null;
}

function resolveNodConfirmTarget(pointerTarget: HTMLElement | null): {
  target: HTMLElement | null;
  label: string;
  source: 'dialog' | 'prompt' | 'pointer' | 'none';
} {
  // 1. Check active modal/interactive dialogues first (front-most last in DOM)
  const dialogs = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]')
  ).filter(isElementVisible);

  for (let i = dialogs.length - 1; i >= 0; i -= 1) {
    const btn = findConfirmButtonInContainer(dialogs[i]);
    if (btn) {
      const label =
        btn.getAttribute('aria-label') ||
        btn.textContent?.replace(/\s+/g, ' ').trim().slice(0, 32) ||
        'Confirm';
      return { target: btn, label, source: 'dialog' };
    }
  }

  // 2. Check explicit confirm prompt buttons or active focused button
  const pageTagged = findConfirmButtonInContainer(document);
  if (pageTagged) {
    const label =
      pageTagged.getAttribute('aria-label') ||
      pageTagged.textContent?.replace(/\s+/g, ' ').trim().slice(0, 32) ||
      'Confirm';
    return { target: pageTagged, label, source: 'prompt' };
  }

  const activeEl = document.activeElement;
  if (
    activeEl instanceof HTMLElement &&
    activeEl !== document.body &&
    !activeEl.hasAttribute('disabled') &&
    isElementVisible(activeEl) &&
    activeEl.matches('button, a[href], [role="button"], input[type="submit"]')
  ) {
    const label =
      activeEl.getAttribute('aria-label') ||
      activeEl.textContent?.replace(/\s+/g, ' ').trim().slice(0, 32) ||
      'Confirm';
    return { target: activeEl, label, source: 'prompt' };
  }

  // 3. Fallback: hovered pointer button/control
  if (pointerTarget && isElementVisible(pointerTarget)) {
    const label =
      pointerTarget.getAttribute('aria-label') ||
      pointerTarget.textContent?.replace(/\s+/g, ' ').trim().slice(0, 32) ||
      'Confirm';
    return { target: pointerTarget, label, source: 'pointer' };
  }

  return { target: null, label: '', source: 'none' };
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
    return 'No camera detected. Connect a webcam and click Start Camera to retry.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera is currently in use by another application or browser tab. Close the other stream and retry.';
  }
  if (name === 'OverconstrainedError') {
    return 'Requested camera resolution is unsupported. Reconnect your camera and retry.';
  }
  return (
    domErr?.message ||
    'Unable to access webcam or initialize on-device Face Landmarker. Check permissions and try again.'
  );
}

export const NoHandsFaceNavigator: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerElRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef<boolean>(false);

  const lastVideoTimeRef = useRef<number>(-1);
  const lastDetectTsRef = useRef<number>(0);

  // Smoothed normalized viewport coordinates [0..1]
  const smoothPosRef = useRef<{ x: number; y: number; initialized: boolean }>({
    x: 0.5,
    y: 0.5,
    initialized: false,
  });

  // Head-pose calibration & preference refs for rAF loop
  const [calibration, setCalibration] = useState<FaceCalibration>(readSavedCalibration);
  const calibrationRef = useRef<FaceCalibration>(calibration);
  calibrationRef.current = calibration;

  const [prefs, setPrefs] = useState<FacePrefs>(readSavedPrefs);
  const prefsRef = useRef<FacePrefs>(prefs);
  prefsRef.current = prefs;

  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const isCalibratingRef = useRef<boolean>(false);
  isCalibratingRef.current = isCalibrating;
  const calibrationSamplesRef = useRef<Array<{ x: number; y: number }>>([]);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);

  // Blink detection state refs
  const blinkClosedRef = useRef<boolean>(false);
  const blinkStartAtRef = useRef<number>(0);
  const blinkHoldActiveRef = useRef<boolean>(false);
  const blinkDetectedFlashRef = useRef<boolean>(false);
  const firstBlinkAtRef = useRef<number | null>(null);
  const cooldownUntilRef = useRef<number>(0);
  const firstBlinkExpireTimerRef = useRef<number | null>(null);
  const cooldownStageTimerRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);
  const blinkFlashTimerRef = useRef<number | null>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const missingFaceFramesRef = useRef<number>(0);

  // Nod-to-confirm detection state refs
  const nodBaselinePitchRef = useRef<number | null>(null);
  const nodPhaseRef = useRef<'idle' | 'down-tilted'>('idle');
  const nodStartAtRef = useRef<number>(0);
  const nodPeakDeltaRef = useRef<number>(0);
  const nodCooldownUntilRef = useRef<number>(0);
  const nodBadgeTimerRef = useRef<number | null>(null);

  // UI state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const cameraActiveRef = useRef<boolean>(false);
  cameraActiveRef.current = cameraActive;
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const isInitializingRef = useRef<boolean>(false);
  isInitializingRef.current = isInitializing;
  const [minimized, setMinimized] = useState<boolean>(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [blinkHoldActive, setBlinkHoldActive] = useState<boolean>(false);
  const [blinkDetectedFlash, setBlinkDetectedFlash] = useState<boolean>(false);
  const [blinkPhase, setBlinkPhase] = useState<BlinkPhase>('ready');
  const [nodStage, setNodStage] = useState<NodStage>('idle');
  const nodStageRef = useRef<NodStage>('idle');
  const [clickPulseActive, setClickPulseActive] = useState<boolean>(false);
  const clickPulseActiveRef = useRef<boolean>(false);
  const [pointerVisible, setPointerVisible] = useState<boolean>(false);
  const [hoverLabel, setHoverLabel] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>(
    'Ready — click Start Camera for hands-free face, double-blink & nod-to-confirm control.'
  );
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Built-in interactive Nod-to-Confirm practice/verification prompt
  const [showNodPracticeModal, setShowNodPracticeModal] = useState<boolean>(false);
  const [nodPracticeConfirmed, setNodPracticeConfirmed] = useState<boolean>(false);

  const saveCalibration = useCallback((next: FaceCalibration) => {
    calibrationRef.current = next;
    setCalibration(next);
    try {
      window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const updatePrefs = useCallback((partial: Partial<FacePrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      prefsRef.current = next;
      try {
        window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const clearTimers = useCallback(() => {
    if (firstBlinkExpireTimerRef.current !== null) {
      window.clearTimeout(firstBlinkExpireTimerRef.current);
      firstBlinkExpireTimerRef.current = null;
    }
    if (cooldownStageTimerRef.current !== null) {
      window.clearTimeout(cooldownStageTimerRef.current);
      cooldownStageTimerRef.current = null;
    }
    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (blinkFlashTimerRef.current !== null) {
      window.clearTimeout(blinkFlashTimerRef.current);
      blinkFlashTimerRef.current = null;
    }
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    if (nodBadgeTimerRef.current !== null) {
      window.clearTimeout(nodBadgeTimerRef.current);
      nodBadgeTimerRef.current = null;
    }
  }, []);

  const updateBlinkHoldActive = useCallback((active: boolean) => {
    if (blinkHoldActiveRef.current !== active) {
      blinkHoldActiveRef.current = active;
      setBlinkHoldActive(active);
    }
  }, []);

  const triggerBlinkDetectedIndicator = useCallback(() => {
    if (blinkFlashTimerRef.current !== null) {
      window.clearTimeout(blinkFlashTimerRef.current);
    }
    blinkDetectedFlashRef.current = true;
    setBlinkDetectedFlash(true);
    blinkFlashTimerRef.current = window.setTimeout(() => {
      blinkDetectedFlashRef.current = false;
      setBlinkDetectedFlash(false);
      blinkFlashTimerRef.current = null;
    }, BLINK_INDICATOR_FLASH_MS);
  }, []);

  const triggerClickVisualPulse = useCallback(() => {
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
    }
    clickPulseActiveRef.current = true;
    setClickPulseActive(true);
    pulseTimerRef.current = window.setTimeout(() => {
      clickPulseActiveRef.current = false;
      setClickPulseActive(false);
      pulseTimerRef.current = null;
    }, 420);
  }, []);

  const updateNodStage = useCallback((next: NodStage) => {
    if (nodStageRef.current !== next) {
      nodStageRef.current = next;
      setNodStage(next);
    }
  }, []);

  const executeNodConfirm = useCallback(
    (pointerTarget: HTMLElement | null) => {
      const nowMs = Date.now();
      playCalibrationTone('lock');
      triggerClickVisualPulse();
      updateNodStage('confirmed');

      if (nodBadgeTimerRef.current !== null) {
        window.clearTimeout(nodBadgeTimerRef.current);
      }
      nodBadgeTimerRef.current = window.setTimeout(() => {
        nodBadgeTimerRef.current = null;
        if (nodStageRef.current === 'confirmed') {
          updateNodStage('idle');
        }
      }, 1300);

      // 1. Broadcast cancelable custom event for any listening interactive dialogue
      const nodEvent = new CustomEvent('educare:nod-confirm', {
        cancelable: true,
        detail: { timestamp: nowMs },
      });
      const notCancelled = window.dispatchEvent(nodEvent);
      if (!notCancelled) {
        setStatusMsg('Nod detected -> Confirmed "Yes" in active dialogue.');
        return;
      }

      // 2. Fallback: click confirm button inside open modal/prompt or hovered control
      const { target, label, source } = resolveNodConfirmTarget(pointerTarget);
      if (target) {
        target.focus?.();
        target.click();
        setStatusMsg(
          source === 'dialog' || source === 'prompt'
            ? `Nod confirmed: "${label}"`
            : `Nod confirmed Yes on "${label}"`
        );
      } else {
        setStatusMsg('Head nod detected (Yes/Confirm) — open a dialogue or prompt to confirm.');
      }
    },
    [triggerClickVisualPulse, updateNodStage]
  );

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    clearTimers();
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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
    blinkClosedRef.current = false;
    blinkHoldActiveRef.current = false;
    blinkDetectedFlashRef.current = false;
    firstBlinkAtRef.current = null;
    cooldownUntilRef.current = 0;
    nodBaselinePitchRef.current = null;
    nodPhaseRef.current = 'idle';
    nodPeakDeltaRef.current = 0;
    nodCooldownUntilRef.current = 0;
    updateNodStage('idle');
    smoothPosRef.current.initialized = false;
    lastVideoTimeRef.current = -1;
    calibrationSamplesRef.current = [];
    missingFaceFramesRef.current = 0;
    isCalibratingRef.current = false;
    setIsCalibrating(false);
    setCalibrationProgress(0);
    setBlinkHoldActive(false);
    setBlinkDetectedFlash(false);
    setBlinkPhase('ready');
    clickPulseActiveRef.current = false;
    setClickPulseActive(false);
    setFaceDetected(false);
    setPointerVisible(false);
    setHoverLabel('');
    cameraActiveRef.current = false;
    setCameraActive(false);
    isInitializingRef.current = false;
    setIsInitializing(false);
    setStatusMsg('Camera stopped.');
  }, [clearTimers, updateNodStage]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          // Ignore close errors
        }
        landmarkerRef.current = null;
      }
    };
  }, [stopCamera]);

  const drawFaceOverlay = useCallback(
    (
      landmarks: NormalizedLandmark[] | null,
      eyesClosed: boolean,
      phase: BlinkPhase,
      calibratingNow: boolean,
      nodNow: NodStage
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

      // Subtle center guide crosshair during calibration
      if (calibratingNow) {
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(w / 2 - 12, h / 2);
        ctx.lineTo(w / 2 + 12, h / 2);
        ctx.moveTo(w / 2, h / 2 - 12);
        ctx.lineTo(w / 2, h / 2 + 12);
        ctx.stroke();
        ctx.restore();
      }

      if (!landmarks || landmarks.length < 468) return;

      const drawConnections = (
        connections: Array<{ start: number; end: number }>,
        strokeStyle: string,
        lineWidth: number
      ) => {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        for (const conn of connections) {
          const a = landmarks[conn.start];
          const b = landmarks[conn.end];
          if (!a || !b) continue;
          ctx.beginPath();
          ctx.moveTo(a.x * w, a.y * h);
          ctx.lineTo(b.x * w, b.y * h);
          ctx.stroke();
        }
      };

      ctx.save();
      const ovalColor =
        nodNow === 'confirmed'
          ? '#10B981'
          : nodNow === 'down-tilted'
            ? '#FACC15'
            : 'rgba(20, 184, 166, 0.5)';
      drawConnections(
        FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
        ovalColor,
        nodNow === 'idle' ? 1.5 : 2.3
      );
      drawConnections(
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
        'rgba(56, 189, 248, 0.45)',
        1.2
      );
      drawConnections(
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
        'rgba(56, 189, 248, 0.45)',
        1.2
      );

      const eyeColor =
        phase === 'clicked' || nodNow === 'confirmed'
          ? '#10B981'
          : eyesClosed || phase === 'first-blink'
            ? '#FACC15'
            : '#38BDF8';
      drawConnections(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, eyeColor, eyesClosed ? 2.6 : 1.8);
      drawConnections(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, eyeColor, eyesClosed ? 2.6 : 1.8);

      // Highlight key face tracking points (eyes, nose tip, cheeks, forehead, chin)
      for (const idx of TRACKING_POINT_INDICES) {
        const pt = landmarks[idx];
        if (!pt) continue;
        const isNoseTip = idx === 1;
        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, isNoseTip ? 4.8 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isNoseTip ? '#10B981' : '#F8FAFC';
        ctx.fill();
        if (isNoseTip) {
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#0F172A';
          ctx.stroke();
        }
      }
      ctx.restore();
    },
    []
  );

  const ensureFaceLandmarker = useCallback(async (): Promise<FaceLandmarker> => {
    if (landmarkerRef.current) return landmarkerRef.current;

    const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
    const createWithDelegate = async (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/models/face_landmarker.task',
          delegate,
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
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
      let leftBlinkScore = 0;
      let rightBlinkScore = 0;
      let hasBlendshapes = false;

      try {
        const result = landmarker.detectForVideo(video, ts);
        landmarks = result?.faceLandmarks?.[0] ?? null;
        const categories = result?.faceBlendshapes?.[0]?.categories;
        if (categories && categories.length > 0) {
          hasBlendshapes = true;
          for (const cat of categories) {
            if (cat.categoryName === 'eyeBlinkLeft') leftBlinkScore = cat.score;
            if (cat.categoryName === 'eyeBlinkRight') rightBlinkScore = cat.score;
          }
        }
      } catch {
        landmarks = null;
      }

      if (!landmarks || landmarks.length < 468) {
        missingFaceFramesRef.current += 1;
        setFaceDetected(false);
        updateBlinkHoldActive(false);
        blinkClosedRef.current = false;
        nodPhaseRef.current = 'idle';
        if (nodStageRef.current !== 'confirmed') {
          updateNodStage('idle');
        }
        setPointerVisible(false);
        setHoverLabel('');
        drawFaceOverlay(null, false, 'ready', isCalibratingRef.current, nodStageRef.current);

        if (missingFaceFramesRef.current === 45) {
          setStatusMsg('No face detected — face your webcam with clear front lighting.');
        }
      } else {
        if (missingFaceFramesRef.current >= 45) {
          setStatusMsg(
            'Face locked — move head to steer, blink twice to click, nod to confirm.'
          );
        }
        missingFaceFramesRef.current = 0;
        setFaceDetected(true);

        // Compute head yaw & pitch from normalized facial geometry (mirrored for intuitive screen motion)
        const noseTip = landmarks[1];
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        const forehead = landmarks[10];
        const chin = landmarks[152];
        const leftEyeOuter = landmarks[33];
        const rightEyeOuter = landmarks[263];

        const faceWidth = Math.max(
          0.08,
          Math.hypot(rightCheek.x - leftCheek.x, rightCheek.y - leftCheek.y)
        );
        const faceHeight = Math.max(
          0.1,
          Math.hypot(chin.x - forehead.x, chin.y - forehead.y)
        );

        const mirroredNoseX = clamp01(1 - noseTip.x);
        const mirroredCheekMidX = clamp01(1 - (leftCheek.x + rightCheek.x) / 2);
        const eyeMidY = (leftEyeOuter.y + rightEyeOuter.y) / 2;

        // Pure rotational pitch ratio (downward tilt increases relPitch)
        const relPitch = (noseTip.y - eyeMidY) / faceHeight;

        // Combined head turn + natural head position for screen pointer
        const rawHeadX =
          (mirroredNoseX - 0.5) * 0.45 + ((mirroredNoseX - mirroredCheekMidX) / faceWidth) * 1.15;
        const rawHeadY = (noseTip.y - 0.5) * 0.45 + relPitch * 1.25;

        // Neutral center calibration sequence (averages 15 clean frames)
        if (isCalibratingRef.current) {
          calibrationSamplesRef.current.push({ x: rawHeadX, y: rawHeadY });
          const count = calibrationSamplesRef.current.length;
          const pct = Math.min(100, Math.round((count / CALIBRATION_FRAMES_TARGET) * 100));
          setCalibrationProgress(pct);

          if (count >= CALIBRATION_FRAMES_TARGET) {
            const sum = calibrationSamplesRef.current.reduce(
              (acc, s) => ({ x: acc.x + s.x, y: acc.y + s.y }),
              { x: 0, y: 0 }
            );
            const avgX = sum.x / count;
            const avgY = sum.y / count;
            saveCalibration({ centerX: avgX, centerY: avgY, calibrated: true });
            calibrationSamplesRef.current = [];
            isCalibratingRef.current = false;
            setIsCalibrating(false);
            setCalibrationProgress(100);
            nodBaselinePitchRef.current = relPitch;
            nodPhaseRef.current = 'idle';
            smoothPosRef.current = { x: 0.5, y: 0.5, initialized: true };
            setStatusMsg(
              'Center calibrated! Move head to steer, blink twice to click, nod to confirm.'
            );
          }
        }

        // Blink evaluation: blendshapes primary + Eye Aspect Ratio (EAR) fallback
        const rightEar = computeEyeAspectRatio(landmarks, 33, 133, 159, 158, 145, 153);
        const leftEar = computeEyeAspectRatio(landmarks, 263, 362, 386, 385, 374, 380);
        const avgEar = (rightEar + leftEar) / 2;

        const avgBlink = (leftBlinkScore + rightBlinkScore) / 2;
        const minBlink = Math.min(leftBlinkScore, rightBlinkScore);

        const wasClosed = blinkClosedRef.current;
        const isClosedNow = wasClosed
          ? hasBlendshapes
            ? avgBlink > BLINK_RELEASE_AVG
            : avgEar < EAR_RELEASE_THRESHOLD
          : hasBlendshapes
            ? (avgBlink >= BLINK_ENGAGE_AVG && minBlink >= BLINK_ENGAGE_MIN_EYE) ||
              avgEar <= EAR_ENGAGE_THRESHOLD
            : avgEar <= EAR_ENGAGE_THRESHOLD;

        blinkClosedRef.current = isClosedNow;

        const cal = calibrationRef.current;
        const currentPrefs = prefsRef.current;
        const gainX = currentPrefs.sensitivity * 2.1;
        const gainY = currentPrefs.sensitivity * 2.45;

        const targetNormX = clamp01(0.5 + (rawHeadX - cal.centerX) * gainX);
        const targetNormY = clamp01(0.5 + (rawHeadY - cal.centerY) * gainY);

        // Exponential smoothing with jitter deadzone & blink/nod stabilization damping
        if (!smoothPosRef.current.initialized) {
          smoothPosRef.current = { x: targetNormX, y: targetNormY, initialized: true };
        } else {
          const dx = targetNormX - smoothPosRef.current.x;
          const dy = targetNormY - smoothPosRef.current.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.0022) {
            const baseAlpha = 0.6 - currentPrefs.smoothing * 0.52;
            const alpha =
              isClosedNow || nodPhaseRef.current === 'down-tilted' ? baseAlpha * 0.25 : baseAlpha;
            smoothPosRef.current.x += dx * alpha;
            smoothPosRef.current.y += dy * alpha;
          }
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
        const inCooldownNow = nowMs < cooldownUntilRef.current;

        // "Nod to confirm" detection: subtle downward-then-upward head tilt
        if (currentPrefs.nodConfirmEnabled && !isCalibratingRef.current && !isClosedNow) {
          if (nodBaselinePitchRef.current === null) {
            nodBaselinePitchRef.current = relPitch;
          }

          if (nowMs >= nodCooldownUntilRef.current) {
            const baseline = nodBaselinePitchRef.current;
            const delta = relPitch - baseline;

            if (nodPhaseRef.current === 'idle') {
              // Smoothly adapt resting posture baseline when not nodding
              nodBaselinePitchRef.current = baseline + (relPitch - baseline) * 0.04;
              if (delta >= NOD_DOWN_THRESHOLD) {
                nodPhaseRef.current = 'down-tilted';
                nodStartAtRef.current = nowMs;
                nodPeakDeltaRef.current = delta;
                updateNodStage('down-tilted');
              }
            } else if (nodPhaseRef.current === 'down-tilted') {
              nodPeakDeltaRef.current = Math.max(nodPeakDeltaRef.current, delta);
              const nodElapsed = nowMs - nodStartAtRef.current;

              if (nodElapsed > NOD_MAX_DURATION_MS) {
                // Held downward (e.g., looking at lower screen) rather than a nod — reset gracefully
                nodPhaseRef.current = 'idle';
                nodPeakDeltaRef.current = 0;
                nodBaselinePitchRef.current = relPitch;
                updateNodStage('idle');
              } else if (
                delta <= Math.min(NOD_RETURN_THRESHOLD, nodPeakDeltaRef.current * 0.48)
              ) {
                if (nodElapsed >= NOD_MIN_DURATION_MS) {
                  nodPhaseRef.current = 'idle';
                  nodPeakDeltaRef.current = 0;
                  nodCooldownUntilRef.current = nowMs + NOD_COOLDOWN_MS;
                  executeNodConfirm(clickable);
                } else {
                  nodPhaseRef.current = 'idle';
                  nodPeakDeltaRef.current = 0;
                  updateNodStage('idle');
                }
              }
            }
          }
        } else {
          nodPhaseRef.current = 'idle';
          nodPeakDeltaRef.current = 0;
          if (nodStageRef.current === 'down-tilted') {
            updateNodStage('idle');
          }
        }

        // Detect deliberate double-blink click with twitch-filtering hold duration & cooldown guard
        let holdReadyNow = false;
        if (!wasClosed && isClosedNow) {
          blinkStartAtRef.current = nowMs;
          updateBlinkHoldActive(false);
        } else if (isClosedNow) {
          const heldMs = nowMs - blinkStartAtRef.current;
          holdReadyNow =
            !isCalibratingRef.current &&
            !inCooldownNow &&
            heldMs >= MIN_DELIBERATE_BLINK_MS &&
            heldMs <= MAX_DELIBERATE_BLINK_MS;
          updateBlinkHoldActive(holdReadyNow);
        } else {
          updateBlinkHoldActive(false);
          if (wasClosed && !isCalibratingRef.current) {
            const blinkDuration = nowMs - blinkStartAtRef.current;
            if (
              !inCooldownNow &&
              blinkDuration >= MIN_DELIBERATE_BLINK_MS &&
              blinkDuration <= MAX_DELIBERATE_BLINK_MS
            ) {
              triggerBlinkDetectedIndicator();
              const prevBlinkAt = firstBlinkAtRef.current;
              if (
                prevBlinkAt !== null &&
                nowMs - prevBlinkAt >= 90 &&
                nowMs - prevBlinkAt <= DOUBLE_BLINK_WINDOW_MS
              ) {
                // Confirmed Double-Blink Click!
                firstBlinkAtRef.current = null;
                if (firstBlinkExpireTimerRef.current !== null) {
                  window.clearTimeout(firstBlinkExpireTimerRef.current);
                  firstBlinkExpireTimerRef.current = null;
                }
                cooldownUntilRef.current = nowMs + BLINK_CLICK_COOLDOWN_MS;
                setBlinkPhase('clicked');
                triggerClickVisualPulse();

                if (clickable) {
                  clickable.focus?.();
                  clickable.click();
                  setStatusMsg(
                    label ? `Double-blink clicked: "${label}"` : 'Double-blink click triggered!'
                  );
                } else {
                  setStatusMsg(
                    'Double-blink detected (aim pointer over a button or link to click).'
                  );
                }

                if (cooldownTimerRef.current !== null) {
                  window.clearTimeout(cooldownTimerRef.current);
                }
                cooldownTimerRef.current = window.setTimeout(() => {
                  setBlinkPhase((cur) => (cur === 'clicked' || cur === 'cooldown' ? 'ready' : cur));
                  cooldownTimerRef.current = null;
                }, BLINK_CLICK_COOLDOWN_MS);

                if (cooldownStageTimerRef.current !== null) {
                  window.clearTimeout(cooldownStageTimerRef.current);
                }
                cooldownStageTimerRef.current = window.setTimeout(() => {
                  cooldownStageTimerRef.current = null;
                  if (runningRef.current && Date.now() < cooldownUntilRef.current) {
                    setBlinkPhase('cooldown');
                  }
                }, 380);
              } else {
                // First deliberate blink registered; wait for second blink
                firstBlinkAtRef.current = nowMs;
                setBlinkPhase('first-blink');
                setStatusMsg('Blink 1/2 detected — blink once more within 1.3s to click!');
                if (firstBlinkExpireTimerRef.current !== null) {
                  window.clearTimeout(firstBlinkExpireTimerRef.current);
                }
                firstBlinkExpireTimerRef.current = window.setTimeout(() => {
                  firstBlinkAtRef.current = null;
                  firstBlinkExpireTimerRef.current = null;
                  if (runningRef.current && Date.now() >= cooldownUntilRef.current) {
                    setBlinkPhase('ready');
                    setStatusMsg(
                      'Face tracked — move head to steer, blink twice to click, nod to confirm.'
                    );
                  }
                }, DOUBLE_BLINK_WINDOW_MS);
              }
            }
          }
        }

        const currentPhase: BlinkPhase = inCooldownNow
          ? clickPulseActiveRef.current
            ? 'clicked'
            : 'cooldown'
          : firstBlinkAtRef.current !== null
            ? 'first-blink'
            : 'ready';
        drawFaceOverlay(
          landmarks,
          holdReadyNow || blinkDetectedFlashRef.current,
          currentPhase,
          isCalibratingRef.current,
          nodStageRef.current
        );
      }
    }

    rafRef.current = window.requestAnimationFrame(processFrame);
  }, [
    drawFaceOverlay,
    executeNodConfirm,
    saveCalibration,
    triggerBlinkDetectedIndicator,
    triggerClickVisualPulse,
    updateBlinkHoldActive,
    updateNodStage,
  ]);

  const startCamera = useCallback(async () => {
    if (cameraActiveRef.current || isInitializingRef.current) return;
    setErrorMsg('');
    isInitializingRef.current = true;
    setIsInitializing(true);
    setStatusMsg('Requesting webcam permission and loading on-device Face Landmarker...');

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
      await ensureFaceLandmarker();

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      runningRef.current = true;
      cameraActiveRef.current = true;
      setCameraActive(true);
      isInitializingRef.current = false;
      setIsInitializing(false);
      setStatusMsg(
        'Face tracking active — steer with head, blink twice to click, nod down-up to confirm.'
      );
      rafRef.current = window.requestAnimationFrame(processFrame);
    } catch (err: unknown) {
      stopCamera();
      const friendly = classifyCameraError(err);
      setErrorMsg(friendly);
      setStatusMsg('Camera or Face Landmarker unavailable.');
    }
  }, [ensureFaceLandmarker, processFrame, stopCamera]);

  const handleCalibrateCenter = () => {
    if (!cameraActiveRef.current) {
      setErrorMsg('Start the camera first, then look straight at the screen and click Calibrate.');
      return;
    }
    setErrorMsg('');
    setMinimized(false);
    calibrationSamplesRef.current = [];
    setCalibrationProgress(0);
    isCalibratingRef.current = true;
    setIsCalibrating(true);
    setStatusMsg('Calibrating neutral head center... Look comfortably at the screen.');
  };

  const handleReset = () => {
    calibrationSamplesRef.current = [];
    isCalibratingRef.current = false;
    setIsCalibrating(false);
    setCalibrationProgress(0);
    nodBaselinePitchRef.current = null;
    nodPhaseRef.current = 'idle';
    updateNodStage('idle');
    saveCalibration(DEFAULT_CALIBRATION);
    updatePrefs(DEFAULT_PREFS);
    setStatusMsg('Reset head center calibration, sensitivity, smoothing, and nod confirm.');
  };

  const statusPill = (() => {
    if (!cameraActive) {
      return {
        text: isInitializing ? 'Starting Camera...' : 'Camera Off',
        cls: 'bg-slate-800 text-slate-200 border border-slate-600',
      };
    }
    if (isCalibrating) {
      return {
        text: `Calibrating (${calibrationProgress}%)`,
        cls: 'bg-amber-400 text-slate-950',
      };
    }
    if (!faceDetected) {
      return {
        text: 'No Face Detected',
        cls: 'bg-rose-500 text-white',
      };
    }
    if (nodStage === 'confirmed') {
      return {
        text: 'NOD CONFIRMED (YES)',
        cls: 'bg-emerald-500 text-slate-950',
      };
    }
    if (nodStage === 'down-tilted') {
      return {
        text: 'Nod Detected — Lift Up',
        cls: 'bg-amber-400 text-slate-950',
      };
    }
    if (blinkPhase === 'clicked') {
      return {
        text: 'DOUBLE-BLINK CLICK!',
        cls: 'bg-emerald-500 text-slate-950',
      };
    }
    if (blinkPhase === 'cooldown') {
      return {
        text: 'Cooldown Guard',
        cls: 'bg-slate-950/85 text-amber-300 border border-amber-400/50',
      };
    }
    if (blinkPhase === 'first-blink') {
      return {
        text: 'Blink 1/2 — Blink Again!',
        cls: 'bg-amber-400 text-slate-950',
      };
    }
    return {
      text: blinkHoldActive
        ? 'Blink Hold Ready'
        : blinkDetectedFlash
          ? 'Blink Detected'
          : 'Face Tracked • Ready',
      cls: blinkHoldActive || blinkDetectedFlash
        ? 'bg-amber-400 text-slate-950'
        : 'bg-slate-950/80 text-emerald-300 border border-emerald-400/50',
    };
  })();

  return (
    <>
      {/* Large Hands-Free Head-Controlled Pointer */}
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
            clickPulseActive || blinkHoldActive ? 'scale-90' : 'scale-100'
          }`}
        >
          <div
            className={`relative w-14 h-14 rounded-full border-4 shadow-xl flex items-center justify-center transition-colors ${
              clickPulseActive || nodStage === 'confirmed'
                ? 'border-emerald-400 bg-emerald-400/35 ring-4 ring-emerald-300/70'
                : blinkHoldActive ||
                    blinkDetectedFlash ||
                    blinkPhase === 'first-blink' ||
                    nodStage === 'down-tilted'
                  ? 'border-amber-400 bg-amber-400/30 ring-4 ring-amber-300/60'
                  : hoverLabel
                    ? 'border-[#159B83] bg-emerald-400/25 ring-2 ring-white/85'
                    : 'border-teal-400 bg-teal-400/15 ring-2 ring-white/75'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full shadow-xs ${
                clickPulseActive || nodStage === 'confirmed'
                  ? 'bg-emerald-500'
                  : blinkHoldActive ||
                      blinkDetectedFlash ||
                      blinkPhase === 'first-blink' ||
                      nodStage === 'down-tilted'
                    ? 'bg-amber-400'
                    : hoverLabel
                      ? 'bg-[#159B83]'
                      : 'bg-teal-400'
              }`}
            />
            {(blinkHoldActive || blinkDetectedFlash) && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-950 flex items-center justify-center shadow-sm">
                <Eye className="w-2.5 h-2.5 text-slate-950" />
              </span>
            )}
          </div>

          {(hoverLabel || blinkPhase !== 'ready' || nodStage !== 'idle' || isCalibrating) && (
            <span className="mt-1.5 px-2.5 py-0.5 rounded-md bg-slate-950/90 text-white text-[11px] font-semibold whitespace-nowrap shadow-md border border-white/20">
              {isCalibrating
                ? 'Hold Neutral Center...'
                : nodStage === 'confirmed'
                  ? 'Nod Confirmed: Yes!'
                  : nodStage === 'down-tilted'
                    ? 'Lift Head to Confirm Yes'
                    : blinkPhase === 'first-blink'
                      ? 'Blink Again to Click (1/2)'
                      : blinkPhase === 'clicked'
                        ? 'Double-Blink Clicked!'
                        : blinkPhase === 'cooldown'
                          ? 'Click Cooldown'
                          : `2-Blink: ${hoverLabel}`}
            </span>
          )}
        </div>
      </div>

      {/* Interactive Nod-to-Confirm Practice / Verification Modal */}
      {showNodPracticeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="nod-practice-heading"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#159B83] dark:border-emerald-500 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-[#0F6E5D] dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <ArrowDownUp className="w-4 h-4" aria-hidden="true" />
              <span>Interactive Nod-to-Confirm Prompt</span>
            </div>
            <h3
              id="nod-practice-heading"
              className="text-xl font-bold text-[#153B70] dark:text-slate-100"
            >
              {nodPracticeConfirmed ? 'Confirmed: Yes!' : 'Do you want to confirm this action?'}
            </h3>
            <p className="text-sm text-[#44566C] dark:text-slate-300 leading-relaxed">
              {nodPracticeConfirmed
                ? 'Your downward-then-upward head nod triggered Yes / Confirm cleanly.'
                : 'Make a subtle downward-then-upward head tilt (nod) to automatically trigger Yes / Confirm, or select Cancel.'}
            </p>
            {nodPracticeConfirmed && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-sm font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Yes / Confirm action completed via Nod Gesture.</span>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowNodPracticeModal(false);
                  setNodPracticeConfirmed(false);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-200 text-sm font-semibold cursor-pointer"
              >
                {nodPracticeConfirmed ? 'Close' : 'Cancel'}
              </button>
              {!nodPracticeConfirmed && (
                <button
                  type="button"
                  data-nod-confirm="true"
                  onClick={() => setNodPracticeConfirmed(true)}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Yes, Confirm</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compact Top-Right Face & Blink Navigation Dock */}
      <aside
        aria-label="Look Ma No Hands Face Navigation Dock"
        className="fixed top-3 right-3 z-[60] w-[276px] sm:w-[312px] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-2 border-[#159B83] dark:border-emerald-500 shadow-xl overflow-hidden text-xs"
      >
        <div className="px-3 py-2 bg-[#0F6E5D] dark:bg-slate-800 text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Eye className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />
            <span className="font-bold truncate">Face &amp; Blink Cursor</span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                blinkDetectedFlash || blinkHoldActive
                  ? 'bg-amber-300 ring-2 ring-amber-200/80 animate-ping'
                  : cameraActive
                    ? faceDetected
                      ? 'bg-emerald-300 animate-pulse'
                      : 'bg-amber-300'
                    : 'bg-slate-400'
              }`}
            />
            {(blinkDetectedFlash || blinkHoldActive) && (
              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-extrabold uppercase tracking-wide shrink-0">
                Blink
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-semibold text-emerald-200 inline-flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
              <span>On-Device</span>
            </span>
            <button
              type="button"
              onClick={() => setMinimized((m) => !m)}
              aria-label={minimized ? 'Expand face navigation panel' : 'Minimize face navigation panel'}
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

        {/* Camera Feed + Face Tracking Points Overlay */}
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
            aria-label="On-device webcam face and blink navigation preview"
            className="w-full h-full object-cover -scale-x-100"
          />
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100"
          />

          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 bg-slate-950/85 text-slate-200 gap-1.5">
              <Camera className="w-6 h-6 text-emerald-400" aria-hidden="true" />
              <p className="font-semibold text-xs">Hands-Free Head, Blink &amp; Nod Control</p>
              <p className="text-[11px] text-slate-400 leading-snug">
                Move head to steer, blink twice to click, or nod down-up to confirm dialogues.
              </p>
            </div>
          )}

          {/* Top Status Indicator Pill */}
          <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusPill.cls}`}>
              {statusPill.text}
            </span>
            {calibration.calibrated && cameraActive && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-950/80 text-emerald-300 text-[10px] font-semibold border border-emerald-500/40">
                Calibrated
              </span>
            )}
          </div>

          {/* Small Visual Blink Indicator Badge */}
          {cameraActive && (blinkHoldActive || blinkDetectedFlash) && (
            <div className="absolute bottom-1.5 right-1.5 pointer-events-none">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 shadow-md border ${
                  blinkDetectedFlash
                    ? 'bg-emerald-500 text-slate-950 border-emerald-200'
                    : 'bg-amber-400 text-slate-950 border-amber-200'
                }`}
              >
                <Eye className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>{blinkDetectedFlash ? 'Blink Detected' : 'Hold Ready'}</span>
              </span>
            </div>
          )}
        </div>

        {/* Controls, Sliders & Status */}
        <div className="p-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={cameraActive || isInitializing}
              className="flex-1 min-h-[34px] px-2.5 py-1.5 rounded-lg bg-[#159B83] hover:bg-[#11836E] disabled:opacity-50 text-white font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
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
              onClick={handleCalibrateCenter}
              disabled={isCalibrating}
              className={`flex-1 min-h-[32px] px-2.5 py-1 rounded-lg border font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isCalibrating
                  ? 'bg-amber-100 dark:bg-amber-950/70 border-amber-400 text-amber-900 dark:text-amber-200'
                  : 'bg-[#F0FDF9] dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 text-[#0F6E5D] dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{isCalibrating ? `Calibrating ${calibrationProgress}%` : 'Calibrate Center'}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              title="Reset head calibration, sensitivity, and smoothing"
              className="min-h-[32px] px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          {/* Nod-to-Confirm Control + Practice Prompt */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-pressed={prefs.nodConfirmEnabled}
              onClick={() => updatePrefs({ nodConfirmEnabled: !prefs.nodConfirmEnabled })}
              className={`flex-1 min-h-[30px] px-2 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer ${
                prefs.nodConfirmEnabled
                  ? 'bg-[#E8F7F4] dark:bg-emerald-950/60 border-[#159B83] text-[#0F6E5D] dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <ArrowDownUp className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Nod Confirm: {prefs.nodConfirmEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNodPracticeConfirmed(false);
                setShowNodPracticeModal(true);
              }}
              className="min-h-[30px] px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
            >
              Test Prompt
            </button>
          </div>

          {/* Sensitivity & Smoothing Controls */}
          <div className="p-2 rounded-lg bg-[#F8FAFD] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#0F6E5D] dark:text-emerald-300">
              <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
              <span>Head Pointer Tuning</span>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] font-semibold text-[#16253B] dark:text-slate-200">
                <label htmlFor="face-sensitivity-slider">Sensitivity</label>
                <span className="font-mono">{prefs.sensitivity.toFixed(1)}x</span>
              </div>
              <input
                id="face-sensitivity-slider"
                type="range"
                min={0.6}
                max={3.0}
                step={0.1}
                value={prefs.sensitivity}
                onChange={(e) => updatePrefs({ sensitivity: Number(e.target.value) })}
                className="w-full accent-[#159B83] cursor-pointer h-1.5"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] font-semibold text-[#16253B] dark:text-slate-200">
                <label htmlFor="face-smoothing-slider">Smoothing</label>
                <span className="font-mono">{Math.round(prefs.smoothing * 100)}%</span>
              </div>
              <input
                id="face-smoothing-slider"
                type="range"
                min={0.15}
                max={0.85}
                step={0.05}
                value={prefs.smoothing}
                onChange={(e) => updatePrefs({ smoothing: Number(e.target.value) })}
                className="w-full accent-[#159B83] cursor-pointer h-1.5"
              />
            </div>
          </div>

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

          <p className="text-[10px] text-[#52657C] dark:text-slate-400 leading-tight">
            100% on-device MediaPipe Face Landmarker — no video frames ever leave your browser.
          </p>
        </div>
      </aside>
    </>
  );
};
