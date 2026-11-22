import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Camera,
  CameraOff,
  Eraser,
  Hand,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Send,
  Smile,
  Sparkles,
  Square,
  UserRound,
  Volume2,
} from 'lucide-react';
import type { LanguageCode, LiveClassSession, UserAccount, UserRole } from '../../types';
import { apiFetch } from '../../services/api';
import {
  getSpeechLang,
  getSpeechRecognitionCtor,
  speakAloud,
  stopSpeaking,
} from '../../utils/speech';
import { triggerHaptic } from '../../utils/haptics';
import {
  InterpreterAvatar,
  tokenizeCaptionToSignActions,
  type InterpreterPersonaId,
  type SignActionCue,
} from '../LiveSignClassroomTools';
import { TutorChatSdk, type TutorConversationTurn } from '../TutorChatSdk';

type TutorMessage = TutorConversationTurn;

interface TutorSectionProps {
  currentUser?: UserAccount;
  liveClasses?: LiveClassSession[];
  language: LanguageCode;
  userRole: UserRole;
  hideSoundControls?: boolean;
  signLanguageMode?: boolean;
  isBlindStudent?: boolean;
  autoPrompt?: { id: number; text: string } | null;
  onTutorAudioStart?: () => void;
  onTutorAudioEnd?: () => void;
}

const SAMPLE_PROMPTS = [
  'Explain Java classes in simple words',
  'How do Python functions work?',
  'Explain linear equations step by step',
  'How can visual notes help with studying?',
];

const TUTOR_SIGN_TILES = [
  { gloss: 'WHAT IS', cue: 'Open palms tilt' },
  { gloss: 'HOW WORK', cue: 'Roll curved hands' },
  { gloss: 'WHY', cue: 'Forehead to Y-hand' },
  { gloss: 'EXPLAIN', cue: 'Alternate F-hands' },
  { gloss: 'STEP BY STEP', cue: 'Stack hands upward' },
  { gloss: 'EXAMPLE', cue: 'Index on flat palm' },
  { gloss: 'JAVA CLASS', cue: 'C-hands form circle' },
  { gloss: 'PYTHON', cue: 'Code + smooth arc' },
  { gloss: 'ALGORITHM', cue: 'Ordered steps forward' },
  { gloss: 'MATH FORMULA', cue: 'Link symbols left-right' },
  { gloss: 'COMPARE', cue: 'Alternating flat palms' },
  { gloss: 'HELP ME', cue: 'Thumb on palm lift' },
];

const DEFAULT_SIGN_STEPS: SignActionCue[] = [
  {
    gloss: 'HELLO',
    motion: 'wave',
    meaning: 'Welcome to your Sign Language AI Tutor!',
    handshape: 'Open flat palm',
    movement: 'Salute gently outward from forehead',
    expression: 'Warm welcoming smile',
  },
  {
    gloss: 'LEARN',
    motion: 'lift',
    meaning: 'Ask any study question using sign tiles, camera, or text.',
    handshape: 'Flat O-hand over open palm',
    movement: 'Lift from open palm up to forehead',
    expression: 'Curious, attentive brows',
  },
  {
    gloss: 'EXPLAIN',
    motion: 'circle',
    meaning: 'I will explain every concept step by step in sign language.',
    handshape: 'Both F-hands facing each other',
    movement: 'Alternate forward and back smoothly',
    expression: 'Clear, open expression',
  },
];

export const TutorSection: React.FC<TutorSectionProps> = ({
  currentUser,
  liveClasses = [],
  language,
  userRole,
  hideSoundControls = false,
  signLanguageMode = false,
  isBlindStudent = false,
  autoPrompt = null,
  onTutorAudioStart,
  onTutorAudioEnd,
}) => {
  const effectiveUser = useMemo<UserAccount>(
    () =>
      currentUser ?? {
        id: `local-${userRole}`,
        name: userRole === 'teacher' ? 'Teacher' : 'Student',
        email: '',
        role: userRole,
        disabilityProfile: signLanguageMode ? 'deaf' : isBlindStudent ? 'blind' : undefined,
        preferredLanguage: language,
      },
    [currentUser, userRole, signLanguageMode, isBlindStudent, language]
  );

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(
    signLanguageMode
      ? 'Welcome! Ask any study question using Sign Language tiles, your Sign Camera, or typing. I will answer in Sign Language actions and clear visual text.'
      : 'Welcome to EduCare AI Tutor! Ask a question by voice or text, or switch channels above to chat live with teachers and classmates.'
  );
  const [signSteps, setSignSteps] = useState<SignActionCue[]>(DEFAULT_SIGN_STEPS);
  const [history, setHistory] = useState<TutorMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeChannelRequest, setActiveChannelRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);

  // Sign Language Tutor interactive controls (for Super-Sonic Hearing students)
  const [signGlossInput, setSignGlossInput] = useState<string[]>([]);
  const [persona, setPersona] = useState<InterpreterPersonaId>('robot');
  const [signPlaying, setSignPlaying] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [activeSignIndex, setActiveSignIndex] = useState(0);

  // Optional Sign Camera input for Sign Language Tutor
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('');
  const [capturedImageBase64, setCapturedImageBase64] = useState<string>('');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const lastAutoPromptIdRef = useRef<number | null>(null);
  const submitQuestionRef = useRef<(promptText: string, captureFromCam?: boolean) => Promise<void>>(
    async () => {}
  );

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const activeSteps = useMemo(() => {
    if (signSteps.length > 0) return signSteps;
    return tokenizeCaptionToSignActions(answer);
  }, [signSteps, answer]);

  useEffect(() => {
    setActiveSignIndex(0);
  }, [activeSteps]);

  useEffect(() => {
    if (!signLanguageMode || !signPlaying || activeSteps.length <= 1) return;
    const intervalMs = slowMode ? 2400 : 1500;
    const timer = window.setInterval(() => {
      setActiveSignIndex((prev) => (prev + 1) % activeSteps.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [signLanguageMode, signPlaying, slowMode, activeSteps.length]);

  const currentSignCue = activeSteps[activeSignIndex] ?? activeSteps[0];

  const handleAddSignGloss = (gloss: string) => {
    setErrorMsg('');
    setSignGlossInput((prev) => {
      const next = [...prev, gloss];
      setQuestion(next.map((g) => g.toLowerCase()).join(' '));
      return next;
    });
  };

  const handleClearSignGloss = () => {
    setSignGlossInput([]);
    setQuestion('');
    setCapturedImageBase64('');
    setCapturedPreview(null);
    setErrorMsg('');
  };

  const startSignCamera = async () => {
    setCameraStatus('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('Camera access is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setCameraStatus('Sign camera active — perform your sign question, then click Capture & Ask.');
    } catch {
      setCameraActive(false);
      setCameraStatus('Camera permission denied or unavailable. Use the Sign Tiles or text input.');
    }
  };

  const stopSignCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStatus('');
  };

  const captureCameraFrame = (): string => {
    if (!cameraActive || !videoRef.current || !canvasRef.current) return capturedImageBase64;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 270;
    const ctx = canvas.getContext('2d');
    if (!ctx) return capturedImageBase64;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    const base64 = dataUrl.split(',')[1] || '';
    setCapturedPreview(dataUrl);
    setCapturedImageBase64(base64);
    return base64;
  };

  const submitQuestion = async (promptText: string, captureFromCam = false) => {
    const clean = promptText.trim();
    const imgBase64 = captureFromCam ? captureCameraFrame() : capturedImageBase64;

    if (!clean && signGlossInput.length === 0 && !imgBase64) {
      setErrorMsg(
        signLanguageMode
          ? 'Please tap sign tiles, capture a sign gesture, or enter a question first.'
          : 'Please enter or speak a question first.'
      );
      return;
    }

    setErrorMsg('');
    setActiveChannelRequest({ id: 'ai-tutor', nonce: Date.now() });
    setIsLoading(true);

    try {
      const res = await apiFetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question: clean,
          language,
          role: userRole,
          mode: signLanguageMode ? 'sign' : 'standard',
          jarvisMode: isBlindStudent && !signLanguageMode,
          history: history.slice(0, 8).map((item) => ({
            question: item.question,
            answer: item.answer,
          })),
          signSequence: signLanguageMode ? signGlossInput : undefined,
          imageBase64: signLanguageMode && imgBase64 ? imgBase64 : undefined,
          mimeType: signLanguageMode && imgBase64 ? 'image/jpeg' : undefined,
        }),
      });

      const data = (await res.json()) as {
        answer?: string;
        signSteps?: SignActionCue[];
        error?: string;
      };

      if (!res.ok || !data.answer) {
        triggerHaptic('error', isBlindStudent);
        const errText = data.error || 'Could not reach the AI Tutor right now.';
        setErrorMsg(errText);
        if (isBlindStudent && !hideSoundControls && !signLanguageMode) {
          onTutorAudioStart?.();
          speakAloud(errText, language, 1, () => {
            onTutorAudioEnd?.();
          });
        }
        return;
      }

      const nextSteps =
        data.signSteps && data.signSteps.length > 0
          ? data.signSteps
          : tokenizeCaptionToSignActions(data.answer);

      setAnswer(data.answer);
      setSignSteps(nextSteps);
      setSignPlaying(true);
      setActiveSignIndex(0);

      const displayQuestion =
        clean ||
        (signGlossInput.length > 0
          ? `Signed: ${signGlossInput.join(' → ')}`
          : 'Sign Language Camera Question');

      setHistory((prev) => [
        {
          id: `msg-${Date.now()}`,
          question: displayQuestion,
          answer: data.answer!,
          signSteps: nextSteps,
          createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 19),
      ]);
      setQuestion('');

      if ((autoSpeak || isBlindStudent) && !hideSoundControls && !signLanguageMode) {
        triggerHaptic('success', isBlindStudent);
        onTutorAudioStart?.();
        speakAloud(data.answer, language, 1, () => {
          onTutorAudioEnd?.();
        });
      }
    } catch {
      triggerHaptic('error', isBlindStudent);
      const netErr = 'Network error while contacting the AI Tutor. Please try again.';
      setErrorMsg(netErr);
      if (isBlindStudent && !hideSoundControls && !signLanguageMode) {
        onTutorAudioStart?.();
        speakAloud(netErr, language, 1, () => {
          onTutorAudioEnd?.();
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceQuestion = () => {
    setErrorMsg('');
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) {
      setErrorMsg('Voice recognition is not supported in this browser. Try typing your question.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = getSpeechLang(language);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      setQuestion(transcript);
      setIsListening(false);
      if (transcript.trim()) {
        void submitQuestion(transcript);
      }
    };
    recognition.onerror = () => {
      setIsListening(false);
      setErrorMsg('Could not capture voice input. Check microphone permission and try again.');
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  submitQuestionRef.current = submitQuestion;

  useEffect(() => {
    if (!autoPrompt || autoPrompt.id === lastAutoPromptIdRef.current) return;
    lastAutoPromptIdRef.current = autoPrompt.id;
    setQuestion(autoPrompt.text);
    void submitQuestionRef.current(autoPrompt.text);
  }, [autoPrompt]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold text-[#153B70] dark:text-slate-100">
              {signLanguageMode
                ? 'AI Personal Learning Tutor (Sign Language Edition)'
                : 'AI Personal Learning Tutor'}
            </h2>
            {signLanguageMode && (
              <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-700 text-xs font-bold text-[#0D9488] dark:text-teal-300 inline-flex items-center gap-1">
                <Hand className="w-3.5 h-3.5" aria-hidden="true" />
                <span>100% Sign &amp; Visual</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#44566C] dark:text-slate-300">
            {signLanguageMode
              ? 'Ask questions using Sign Language tiles, your Sign Camera, or typing — your AI Sign Tutor performs the explanation step-by-step in animated sign language alongside clear visual notes.'
              : hideSoundControls
                ? 'Ask questions about your subjects by typing. Answers are structured clearly for visual reading.'
                : isBlindStudent
                  ? 'Jarvis Audio-to-Audio Tutor is active: speak naturally after each AI question or answer — no button press needed. Say "stop" or "Hey AI open classes" anytime.'
                  : 'Ask questions about your subjects by typing or speaking. Answers are structured clearly for reading aloud.'}
          </p>
        </div>

        {!hideSoundControls && !signLanguageMode && (
          <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#16253B] dark:text-slate-200 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(e) => setAutoSpeak(e.target.checked)}
              className="w-4 h-4 accent-[#159B83]"
            />
            <span>Read answers aloud</span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          {signLanguageMode && (
            <div className="rounded-xl bg-[#F0FDFA]/70 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#0D9488] dark:text-teal-300 inline-flex items-center gap-1.5">
                  <Hand className="w-4 h-4" aria-hidden="true" />
                  <span>Ask in Sign Language (Tap Signs to Build Your Question)</span>
                </span>
                {(signGlossInput.length > 0 || capturedPreview) && (
                  <button
                    type="button"
                    onClick={handleClearSignGloss}
                    className="text-xs font-semibold text-red-600 dark:text-red-400 inline-flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Eraser className="w-3 h-3" aria-hidden="true" />
                    <span>Clear Signs</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {TUTOR_SIGN_TILES.map((tile) => (
                  <button
                    key={tile.gloss}
                    type="button"
                    onClick={() => handleAddSignGloss(tile.gloss)}
                    className="px-2.5 py-1.5 rounded-lg border border-teal-200/80 dark:border-teal-800 bg-white dark:bg-slate-900 hover:border-[#0D9488] text-left transition-colors cursor-pointer"
                  >
                    <span className="block text-[11px] font-bold text-[#153B70] dark:text-slate-100">
                      {tile.gloss}
                    </span>
                    <span className="block text-[10px] text-[#52657C] dark:text-slate-400">
                      {tile.cue}
                    </span>
                  </button>
                ))}
              </div>

              {signGlossInput.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-[#52657C] dark:text-slate-400">
                    Signed Question:
                  </span>
                  {signGlossInput.map((g, idx) => (
                    <span
                      key={`${g}-${idx}`}
                      className="px-2 py-0.5 rounded bg-[#0D9488] text-white text-[11px] font-bold"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Optional Sign Camera Capture */}
              <div className="pt-2 border-t border-teal-200/60 dark:border-teal-800/50 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-300" aria-hidden="true" />
                    <span>Sign Camera (Optional)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {!cameraActive ? (
                      <button
                        type="button"
                        onClick={() => void startSignCamera()}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Turn On Sign Camera</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => void submitQuestion(question, true)}
                          className="min-h-[34px] px-3 py-1 rounded-lg bg-[#1D6CE0] hover:bg-[#1659BD] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isLoading ? 'Signing...' : 'Capture & Ask in Sign'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopSignCamera}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <CameraOff className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Stop</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full max-w-xs aspect-video rounded-lg bg-slate-900 object-cover ${
                    cameraActive ? 'block' : 'hidden'
                  }`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {capturedPreview && (
                  <div className="flex items-center gap-2.5">
                    <img
                      src={capturedPreview}
                      alt="Captured sign question"
                      className="w-20 h-14 rounded-lg object-cover border border-teal-300 dark:border-teal-700"
                    />
                    <span className="text-xs text-[#52657C] dark:text-slate-300">
                      Captured sign frame sent to AI Sign Tutor.
                    </span>
                  </div>
                )}

                {cameraStatus && (
                  <p className="text-xs text-[#52657C] dark:text-slate-400">{cameraStatus}</p>
                )}
              </div>
            </div>
          )}

          {!hideSoundControls && !signLanguageMode && (
            <div className="flex flex-wrap items-center gap-2.5 pb-1 border-b border-slate-100 dark:border-slate-800">
              {!isBlindStudent && (
                <button
                  type="button"
                  onClick={handleVoiceQuestion}
                  disabled={isLoading}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#159B83] hover:bg-[#11836E] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Mic className="w-4 h-4" aria-hidden="true" />
                  <span>{isListening ? 'Listening...' : 'Speak Question'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => speakAloud(answer, language)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#153B70] dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Volume2 className="w-4 h-4" aria-hidden="true" />
                <span>Replay Answer</span>
              </button>

              <button
                type="button"
                onClick={stopSpeaking}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#16253B] dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Stop Audio</span>
              </button>
            </div>
          )}

          {signLanguageMode && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#52657C] dark:text-slate-400">
                Tap sign tiles above or type directly in the chat box below.
              </span>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => void submitQuestion(question)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isLoading ? 'Preparing Sign Answer...' : 'Ask AI Sign Tutor'}</span>
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200"
            >
              {errorMsg}
            </div>
          )}

          <TutorChatSdk
            currentUser={effectiveUser}
            language={language}
            liveClasses={liveClasses}
            aiHistory={history}
            aiLoading={isLoading}
            aiWelcomeText={
              signLanguageMode
                ? 'Welcome! Ask any study question using Sign Language tiles, your Sign Camera, or typing. I will answer in Sign Language actions and clear visual text.'
                : 'Welcome to EduCare AI Tutor! Ask any study question by voice or text, or switch channels above to chat in real time with teachers and classmates.'
            }
            signLanguageMode={signLanguageMode}
            hideSoundControls={hideSoundControls}
            draft={question}
            onDraftChange={setQuestion}
            onSendAiMessage={(text) => submitQuestion(text)}
            onResetAiChat={() => {
              setHistory([]);
              setAnswer(
                signLanguageMode
                  ? 'Welcome! Ask any study question using Sign Language tiles, your Sign Camera, or typing. I will answer in Sign Language actions and clear visual text.'
                  : 'Welcome to EduCare AI Tutor! Ask a question by voice or text, or switch channels above to chat live with teachers and classmates.'
              );
              setSignSteps(DEFAULT_SIGN_STEPS);
              setErrorMsg('');
            }}
            onReplaySignTurn={(turn) => {
              setAnswer(turn.answer);
              if (turn.signSteps) {
                setSignSteps(turn.signSteps);
              }
              setActiveSignIndex(0);
              setSignPlaying(true);
            }}
            activeChannelRequest={activeChannelRequest}
          />
        </section>

        <aside className="lg:col-span-5 space-y-5">
          {signLanguageMode && currentSignCue && (
            <section
              aria-label="AI Sign Language Tutor Stage"
              className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-[#0D9488]/35 dark:border-teal-500/40 p-5 space-y-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D9488] dark:text-teal-300">
                    <Hand className="w-4 h-4" aria-hidden="true" />
                    <span>AI Sign Language Answer</span>
                  </span>
                  <h3 className="text-base font-bold text-[#153B70] dark:text-slate-100 mt-0.5">
                    Step-by-Step Sign Explanation
                  </h3>
                </div>
                <span className="px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[11px] font-bold text-[#0D9488] dark:text-teal-300 tabular-nums">
                  Sign {activeSignIndex + 1} / {activeSteps.length}
                </span>
              </div>

              {/* Persona Switcher */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                {(
                  [
                    { id: 'robot', label: 'Nova', Icon: Bot },
                    { id: 'human', label: 'Maya', Icon: UserRound },
                    { id: 'cartoon', label: 'Pip', Icon: Smile },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPersona(id)}
                    aria-pressed={persona === id}
                    className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      persona === id
                        ? 'bg-white dark:bg-slate-900 text-[#0D9488] dark:text-teal-300 shadow-xs'
                        : 'text-[#52657C] dark:text-slate-400 hover:text-[#153B70] dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Animated Sign Performer */}
              <div className="rounded-xl bg-gradient-to-b from-[#F0FDFA] to-[#EFF6FF] dark:from-slate-800/90 dark:to-slate-900 border border-teal-200/70 dark:border-teal-800/50 p-3 text-center">
                <InterpreterAvatar
                  persona={persona}
                  motion={currentSignCue.motion}
                  playing={signPlaying}
                  slowMode={slowMode}
                />
                <div className="mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-teal-200 dark:border-teal-700">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#0D9488] dark:text-teal-300">
                    Signing:
                  </span>
                  <span className="text-sm font-bold text-[#153B70] dark:text-slate-100">
                    {currentSignCue.gloss}
                  </span>
                </div>
                {currentSignCue.meaning && (
                  <p className="mt-2 text-xs font-medium text-[#16253B] dark:text-slate-200 px-2">
                    {currentSignCue.meaning}
                  </p>
                )}
              </div>

              {/* Handshape / Movement / Facial Cue */}
              <div className="rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-[#52657C] dark:text-slate-400">Handshape:</span>
                  <span className="font-semibold text-[#153B70] dark:text-slate-100 text-right">
                    {currentSignCue.handshape}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-[#52657C] dark:text-slate-400">Movement:</span>
                  <span className="font-medium text-[#16253B] dark:text-slate-200 text-right">
                    {currentSignCue.movement}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-[#52657C] dark:text-slate-400">Expression:</span>
                  <span className="font-medium text-[#16253B] dark:text-slate-200 text-right">
                    {currentSignCue.expression}
                  </span>
                </div>
              </div>

              {/* Sign Gloss Sequence */}
              <div className="flex flex-wrap gap-1.5">
                {activeSteps.map((step, idx) => (
                  <button
                    key={`${step.gloss}-${idx}`}
                    type="button"
                    onClick={() => setActiveSignIndex(idx)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      idx === activeSignIndex
                        ? 'bg-[#0D9488] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-[#153B70] dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {step.gloss}
                  </button>
                ))}
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSignPlaying((p) => !p)}
                  className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {signPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Pause Signs</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Play Signs</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSlowMode((s) => !s)}
                  aria-pressed={slowMode}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                    slowMode
                      ? 'border-[#0D9488] bg-teal-50 dark:bg-teal-950/50 text-[#0D9488] dark:text-teal-300'
                      : 'border-slate-300 dark:border-slate-700 text-[#153B70] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {slowMode ? '0.6x Slow' : '1x Normal'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSignIndex(0);
                    setSignPlaying(true);
                  }}
                  aria-label="Replay sign language explanation"
                  className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[#153B70] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </section>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
            <h3 className="text-base font-bold text-[#153B70] dark:text-slate-100">
              Quick Sample Questions
            </h3>
            <div className="space-y-2">
              {SAMPLE_PROMPTS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setQuestion(sample);
                    void submitQuestion(sample);
                  }}
                  className="w-full text-left min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F8FAFD] dark:bg-slate-800 hover:bg-[#E9F4FF] dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-sm font-medium text-[#153B70] dark:text-slate-200 transition-colors cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {history.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
              <h3 className="text-base font-bold text-[#153B70] dark:text-slate-100">
                Recent Questions
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((item) => (
                  <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => {
                        setQuestion(item.question);
                        setAnswer(item.answer);
                        if (item.signSteps) {
                          setSignSteps(item.signSteps);
                        }
                        setActiveSignIndex(0);
                        setSignPlaying(true);
                      }}
                      className="text-left text-sm font-semibold text-[#1D6CE0] dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      {item.question}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
