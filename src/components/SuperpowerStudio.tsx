import React, { useEffect, useState } from 'react';
import {
  Accessibility,
  Bell,
  BookOpen,
  Bot,
  Camera,
  Captions,
  CheckCircle2,
  Circle,
  Clock,
  Contrast,
  Eye,
  FileCheck2,
  Hand,
  Headphones,
  MessageSquare,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Video,
  Volume2,
} from 'lucide-react';
import type {
  ContrastPreset,
  DisabilityProfile,
  LanguageCode,
  SectionId,
  UserRole,
} from '../types';
import type { BlindVoiceState } from '../hooks/useBlindWakeWord';
import { DISABILITY_SUPPORT_OPTIONS } from '../data/educareData';
import { speakAloud, stopSpeaking } from '../utils/speech';
import { HAPTIC_PATTERN_LABELS, isVibrationSupported } from '../utils/haptics';

interface SuperpowerStudioProps {
  profile: DisabilityProfile;
  userRole: UserRole;
  language: LanguageCode;
  fontSize: number;
  contrast: ContrastPreset;
  voiceStatus: string;
  materialsCount: number;
  assignmentsCount: number;
  resultsCount: number;
  blindVoiceState?: BlindVoiceState;
  blindLastHeard?: string;
  allowedProfiles?: DisabilityProfile[];
  onSelectProfile: (profile: DisabilityProfile) => void;
  onNavigate: (section: SectionId) => void;
  onStartVoiceNav: () => void;
  onReadPage: () => void;
  onChangeFontSize: (size: number) => void;
  onChangeContrast: (preset: ContrastPreset) => void;
}

const CHECKLIST_ITEMS_STUDENT = [
  '1. Read or listen to one study note',
  '2. Ask the AI Tutor one practice question',
  '3. Review assignments or take an exam',
];

const CHECKLIST_ITEMS_TEACHER = [
  '1. Publish structured notes with clear headings',
  '2. Verify live class captions & steady schedule',
  '3. Review student submissions calmly',
];

const QUICK_PHRASES_STUDENT = [
  'I have a question about this topic.',
  'Could you please repeat that part slowly?',
  'I know the answer and would like to share it.',
  'May I type my response in the chat?',
];

const QUICK_PHRASES_TEACHER = [
  'Take all the time you need — typing or speaking are both welcome.',
  'Feel free to use the text chat whenever you prefer.',
  'Great point! Let us go through that step by step.',
  'No rush on this question — extra time is always available.',
];

export const SuperpowerStudio: React.FC<SuperpowerStudioProps> = ({
  profile,
  userRole,
  language,
  fontSize,
  contrast,
  voiceStatus,
  materialsCount,
  assignmentsCount,
  resultsCount,
  blindVoiceState = 'listening',
  blindLastHeard = '',
  allowedProfiles,
  onSelectProfile,
  onNavigate,
  onStartVoiceNav,
  onReadPage,
  onChangeFontSize,
  onChangeContrast,
}) => {
  // Deaf / Silent Movie VIP controls
  const [captionsOn, setCaptionsOn] = useState(true);
  const [captionScale, setCaptionScale] = useState<'normal' | 'large' | 'xl'>('large');
  const [visualFlashOn, setVisualFlashOn] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);

  // Blind / Daredevil controls
  const [audioRate, setAudioRate] = useState<number>(1);

  // OCD / Perfectionist Squad controls
  const [checkedSteps, setCheckedSteps] = useState<boolean[]>([false, false, false]);
  const [timerSeconds, setTimerSeconds] = useState<number>(15 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Stammering / Remix Artist controls
  const [speakDraft, setSpeakDraft] = useState('');
  const [lastSpoken, setLastSpoken] = useState('');

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const triggerVisualFlash = () => {
    if (!visualFlashOn) return;
    setIsFlashing(true);
    window.setTimeout(() => setIsFlashing(false), 900);
  };

  const activeMeta =
    DISABILITY_SUPPORT_OPTIONS.find((opt) => opt.id === profile) ?? DISABILITY_SUPPORT_OPTIONS[0];

  const switcherOptions =
    allowedProfiles && allowedProfiles.length > 0
      ? DISABILITY_SUPPORT_OPTIONS.filter((opt) => allowedProfiles.includes(opt.id))
      : DISABILITY_SUPPORT_OPTIONS;

  const completedSteps = checkedSteps.filter(Boolean).length;
  const checklistItems = userRole === 'teacher' ? CHECKLIST_ITEMS_TEACHER : CHECKLIST_ITEMS_STUDENT;
  const quickPhrases = userRole === 'teacher' ? QUICK_PHRASES_TEACHER : QUICK_PHRASES_STUDENT;

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleSpeakPhrase = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    speakAloud(trimmed, language, audioRate);
    setLastSpoken(trimmed);
  };

  // Distinct visual shell per superpower
  const shellStyles: Record<DisabilityProfile, string> = {
    standard:
      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    deaf:
      'bg-gradient-to-br from-amber-50 via-white to-indigo-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/60 border-amber-300 dark:border-amber-600/60',
    blind:
      'bg-gradient-to-br from-slate-950 via-[#0F1B33] to-slate-900 text-white border-amber-400/70',
    'no-hands':
      'bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/60 border-emerald-300 dark:border-emerald-700',
    ocd:
      'bg-[#EEF5FC] dark:bg-slate-900 border-[#9CC0E8] dark:border-sky-800',
    stammering:
      'bg-gradient-to-br from-violet-50 via-white to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-violet-950/50 border-violet-300 dark:border-violet-700',
  };

  const isDarkCard = profile === 'blind';

  return (
    <section
      aria-label={`${activeMeta.funnyTitle} workspace controls`}
      className={`rounded-2xl border-2 p-5 sm:p-6 space-y-5 transition-all ${shellStyles[profile]} ${
        isFlashing ? 'ring-4 ring-amber-400 ring-offset-2' : ''
      }`}
    >
      {/* Header + Superpower Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                isDarkCard
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-[#153B70] dark:bg-sky-600 text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{userRole === 'teacher' ? 'Teaching Studio' : 'Superpower Studio'}</span>
            </span>
            <span
              className={`text-xs font-semibold ${
                isDarkCard ? 'text-amber-200' : 'text-[#52657C] dark:text-slate-400'
              }`}
            >
              {activeMeta.clearLabel}
            </span>
          </div>
          <h3
            className={`text-xl font-bold ${
              isDarkCard ? 'text-white' : 'text-[#153B70] dark:text-slate-100'
            }`}
          >
            {activeMeta.funnyTitle}
          </h3>
          <p
            className={`text-sm ${
              isDarkCard ? 'text-slate-200' : 'text-[#44566C] dark:text-slate-300'
            }`}
          >
            {activeMeta.tagline}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="shrink-0">
          <label
            htmlFor="studio-power-switch"
            className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${
              isDarkCard ? 'text-amber-200' : 'text-[#52657C] dark:text-slate-400'
            }`}
          >
            {userRole === 'teacher' ? 'Switch Teaching Mode' : 'Switch Superpower'}
          </label>
          <select
            id="studio-power-switch"
            value={profile}
            onChange={(e) => onSelectProfile(e.target.value as DisabilityProfile)}
            className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
              isDarkCard
                ? 'bg-slate-900 border-amber-400 text-amber-100'
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-[#153B70] dark:text-slate-100'
            }`}
          >
            {switcherOptions.map((opt) => (
              <option key={opt.id} value={opt.id} className="text-slate-900">
                {opt.funnyTitle} ({opt.clearLabel})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ================= 1. DEAF: SILENT MOVIE VIP ================= */}
      {profile === 'deaf' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/90 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Live Captions</p>
              <p className="mt-0.5 text-lg font-bold text-amber-700 dark:text-amber-300">
                {captionsOn ? 'ACTIVE' : 'PAUSED'}
              </p>
            </div>
            <div className="rounded-xl bg-white/90 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Visual Alerts</p>
              <p className="mt-0.5 text-lg font-bold text-indigo-700 dark:text-indigo-300">
                {visualFlashOn ? 'Flash Border ON' : 'Muted'}
              </p>
            </div>
            <div className="rounded-xl bg-white/90 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Sign Library</p>
              <p className="mt-0.5 text-lg font-bold text-[#153B70] dark:text-slate-100 tabular-nums">
                6 Guided Signs
              </p>
            </div>
          </div>

          {captionsOn && (
            <div
              aria-live="polite"
              className={`rounded-xl bg-slate-950 text-amber-200 border-2 border-amber-400 px-4 py-3 font-semibold ${
                captionScale === 'xl'
                  ? 'text-xl'
                  : captionScale === 'large'
                    ? 'text-base'
                    : 'text-sm'
              }`}
            >
              <span className="text-[11px] uppercase tracking-wider text-amber-400 block mb-0.5">
                Live Visual Caption Strip
              </span>
              {voiceStatus ||
                (userRole === 'teacher'
                  ? 'Captions enabled: All live class links will highlight visual captions & sign-friendly notes.'
                  : 'Welcome! All audio notices, classes, and lessons are ready in visual text & Sign Language.')}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setCaptionsOn((p) => !p);
                triggerVisualFlash();
              }}
              aria-pressed={captionsOn}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Captions className="w-4 h-4" aria-hidden="true" />
              <span>{captionsOn ? 'Captions: ON' : 'Turn Captions ON'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setVisualFlashOn((p) => !p);
                setIsFlashing(true);
                window.setTimeout(() => setIsFlashing(false), 700);
              }}
              aria-pressed={visualFlashOn}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-amber-400 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-[#153B70] dark:text-amber-200 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              <span>Test Visual Alert Flash</span>
            </button>

            <div className="inline-flex rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              {(['normal', 'large', 'xl'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setCaptionScale(sz)}
                  className={`min-h-[44px] px-3 text-xs font-bold uppercase cursor-pointer ${
                    captionScale === sz
                      ? 'bg-indigo-600 text-white'
                      : 'text-[#153B70] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('sign')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Hand className="w-4 h-4" aria-hidden="true" />
              <span>Open Sign Language Studio</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= 2. BLIND: MASTER OF SHADOWS (HANDS-FREE HEY AI) ================= */}
      {profile === 'blind' && (
        <div className="space-y-4">
          {userRole === 'student' && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3 ${
                blindVoiceState === 'armed'
                  ? 'bg-amber-400 text-slate-950 border-white'
                  : 'bg-slate-950/90 text-white border-amber-400/80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      blindVoiceState === 'armed'
                        ? 'bg-slate-950 animate-ping'
                        : blindVoiceState === 'listening'
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-amber-400'
                    }`}
                  />
                  <Mic className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <h4 className="text-base sm:text-lg font-bold">
                    {blindVoiceState === 'armed'
                      ? 'Hey AI is Armed — Speak Your Command Now'
                      : blindVoiceState === 'needs-gesture'
                        ? 'Touch Anywhere or Press Any Key Once to Enable Always-On Mic'
                        : blindVoiceState === 'unsupported'
                          ? 'Always-On Mic Unavailable in This Browser'
                          : 'Always-On Voice Navigator Active — No Button Needed'}
                  </h4>
                </div>
                {blindLastHeard && (
                  <span
                    className={`text-xs font-mono px-2.5 py-1 rounded-lg ${
                      blindVoiceState === 'armed'
                        ? 'bg-slate-950 text-amber-300'
                        : 'bg-white/10 text-amber-200'
                    }`}
                  >
                    Heard: &ldquo;{blindLastHeard}&rdquo;
                  </span>
                )}
              </div>

              <p
                className={`text-sm leading-relaxed ${
                  blindVoiceState === 'armed' ? 'text-slate-900 font-semibold' : 'text-slate-200'
                }`}
              >
                Just speak naturally starting with <strong>&ldquo;Hey AI&rdquo;</strong> or{' '}
                <strong>&ldquo;Hi AI&rdquo;</strong> to jump anywhere or get instant spoken help:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-semibold">
                {[
                  '"Hey AI open AI tutoring"',
                  '"Hi AI open live classes"',
                  '"Hey AI open study notes"',
                  '"Hey AI open exam"',
                  '"Hi AI check my results"',
                  '"Hey AI read this page"',
                ].map((phrase) => (
                  <div
                    key={phrase}
                    className={`px-3 py-2 rounded-xl border ${
                      blindVoiceState === 'armed'
                        ? 'bg-slate-950/10 border-slate-950/30 text-slate-950'
                        : 'bg-white/10 border-amber-400/30 text-amber-200'
                    }`}
                  >
                    {phrase}
                  </div>
                ))}
              </div>

              <div
                className={`pt-2 border-t text-xs space-y-1.5 ${
                  blindVoiceState === 'armed'
                    ? 'border-slate-950/20 text-slate-900'
                    : 'border-amber-400/30 text-slate-200'
                }`}
              >
                <p className="font-bold">
                  Haptic Vibration Feedback:{' '}
                  {isVibrationSupported()
                    ? 'Active on supported devices'
                    : 'Ready (uses device Vibration API when available)'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(['success', 'navigate', 'error', 'wake'] as const).map((cue) => (
                    <div
                      key={cue}
                      className={`px-2.5 py-1.5 rounded-lg ${
                        blindVoiceState === 'armed' ? 'bg-slate-950/10' : 'bg-white/5'
                      }`}
                    >
                      <span className="font-bold">{HAPTIC_PATTERN_LABELS[cue].title}:</span>{' '}
                      <span>{HAPTIC_PATTERN_LABELS[cue].patternText}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/10 border border-amber-400/40 p-3.5">
              <p className="text-xs font-medium text-amber-200">Text Scale</p>
              <p className="mt-0.5 text-lg font-bold text-white font-mono tabular-nums">
                {fontSize}%
              </p>
            </div>
            <div className="rounded-xl bg-white/10 border border-amber-400/40 p-3.5">
              <p className="text-xs font-medium text-amber-200">Audio Speed</p>
              <p className="mt-0.5 text-lg font-bold text-white font-mono tabular-nums">
                {audioRate}x
              </p>
            </div>
            <div className="rounded-xl bg-white/10 border border-amber-400/40 p-3.5">
              <p className="text-xs font-medium text-amber-200">Contrast Surface</p>
              <p className="mt-0.5 text-lg font-bold text-amber-300 capitalize">
                {contrast.replace(/-/g, ' ')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onReadPage}
              className="min-h-[56px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-base inline-flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Volume2 className="w-5 h-5" aria-hidden="true" />
              <span>Read Entire Screen Aloud</span>
            </button>

            <button
              type="button"
              onClick={() => stopSpeaking()}
              className="min-h-[56px] px-5 py-3 rounded-xl border-2 border-amber-400/70 bg-white/10 hover:bg-white/20 text-white font-bold text-base inline-flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Square className="w-5 h-5" aria-hidden="true" />
              <span>Stop Audio Immediately</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-xl p-1">
              <Headphones className="w-4 h-4 text-amber-300 ml-2" aria-hidden="true" />
              {[0.8, 1, 1.25, 1.5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setAudioRate(r);
                    speakAloud(`Reading speed set to ${r} times.`, language, r);
                  }}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                    audioRate === r ? 'bg-amber-400 text-slate-950' : 'text-white hover:bg-white/15'
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>

            {[120, 135, 150].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => onChangeFontSize(pct)}
                className={`min-h-[42px] px-3.5 rounded-xl text-xs font-mono font-bold border cursor-pointer ${
                  fontSize === pct
                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                    : 'bg-white/10 text-white border-white/25 hover:bg-white/20'
                }`}
              >
                {pct}% Text
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                onChangeContrast(contrast === 'yellow-on-black' ? 'high-contrast-dark' : 'yellow-on-black')
              }
              className="min-h-[42px] px-3.5 rounded-xl bg-yellow-300 hover:bg-yellow-200 text-black text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Contrast className="w-4 h-4" aria-hidden="true" />
              <span>Toggle Yellow / High Contrast</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= 3. NO-HANDS: LOOK MA, NO HANDS! ================= */}
      {profile === 'no-hands' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/90 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Face &amp; Blink Cursor</p>
              <p className="mt-0.5 text-lg font-bold text-[#0F6E5D] dark:text-emerald-400">
                On-Device Ready
              </p>
            </div>
            <div className="rounded-xl bg-white/90 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Click Gesture</p>
              <p className="mt-0.5 text-lg font-bold text-[#153B70] dark:text-slate-100">
                2 Deliberate Blinks
              </p>
            </div>
            <div className="rounded-xl bg-white/90 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Voice Control</p>
              <p className="mt-0.5 text-lg font-bold text-teal-700 dark:text-teal-300">
                1-Tap Launch
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-800 border-2 border-[#159B83] dark:border-emerald-500 p-4 space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0F6E5D] dark:text-emerald-400">
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>Face, Blink &amp; Nod Cursor Dock (Top-Right)</span>
            </div>
            <p className="text-sm text-[#16253B] dark:text-slate-200">
              Click <strong>Start Camera</strong> in the top-right <strong>Face &amp; Blink Cursor</strong>{' '}
              window to steer a large pointer with gentle <strong>head movement</strong>,{' '}
              <strong>blink twice deliberately</strong> to click, and <strong>nod down then up</strong>{' '}
              to confirm Yes during interactive dialogues or prompts.
            </p>
            <p className="text-xs text-[#52657C] dark:text-slate-400">
              Includes neutral head center calibration, sensitivity &amp; smoothing sliders, click
              cooldown guard, nod confirmation toggle, and 100% on-device MediaPipe processing.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartVoiceNav}
            className="w-full min-h-[60px] px-6 py-4 rounded-2xl bg-[#159B83] hover:bg-[#11836E] text-white font-bold text-lg flex items-center justify-center gap-3 shadow-sm cursor-pointer"
          >
            <Mic className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span>Start Voice Command Navigation</span>
          </button>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: 'classes' as SectionId, label: 'Classes', icon: <Video className="w-5 h-5" /> },
              { id: 'materials' as SectionId, label: 'Notes', icon: <BookOpen className="w-5 h-5" /> },
              { id: 'tutor' as SectionId, label: 'AI Tutor', icon: <Bot className="w-5 h-5" /> },
              { id: 'exam' as SectionId, label: 'Exam', icon: <FileCheck2 className="w-5 h-5" /> },
              { id: 'access' as SectionId, label: 'Eye Cam', icon: <Camera className="w-5 h-5" /> },
            ].map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => onNavigate(tile.id)}
                className="min-h-[64px] px-3 py-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-100 font-bold text-sm flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                {tile.icon}
                <span>{tile.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ================= 4. OCD: HIGH-ENERGY FINGERS ================= */}
      {profile === 'ocd' && (
        <div className="space-y-4">
          <div
            role="status"
            aria-live="polite"
            className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3 transition-colors ${
              blindVoiceState === 'armed'
                ? 'bg-[#1D6CE0] text-white border-[#153B70]'
                : 'bg-white dark:bg-slate-800 text-[#16253B] dark:text-slate-100 border-[#7AA7D9] dark:border-sky-600'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    blindVoiceState === 'armed'
                      ? 'bg-amber-300 animate-ping'
                      : blindVoiceState === 'listening'
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-amber-400'
                  }`}
                />
                <Mic className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h4 className="text-base sm:text-lg font-bold">
                  {blindVoiceState === 'armed'
                    ? 'Hey AI is Armed — Speak Camera or Navigation Command'
                    : blindVoiceState === 'needs-gesture'
                      ? 'Tap Anywhere or Press Any Key Once to Enable Always-On Mic'
                      : blindVoiceState === 'unsupported'
                        ? 'Always-On Mic Unavailable in This Browser'
                        : 'Always-On "Hey AI" / "Hi AI" Voice Control Active'}
                </h4>
              </div>
              {blindLastHeard && (
                <span
                  className={`text-xs font-mono px-2.5 py-1 rounded-lg ${
                    blindVoiceState === 'armed'
                      ? 'bg-[#153B70] text-white'
                      : 'bg-[#EEF5FC] dark:bg-slate-900 text-[#153B70] dark:text-sky-300'
                  }`}
                >
                  Heard: &ldquo;{blindLastHeard}&rdquo;
                </span>
              )}
            </div>

            <p
              className={`text-sm leading-relaxed ${
                blindVoiceState === 'armed' ? 'text-blue-50' : 'text-[#44566C] dark:text-slate-300'
              }`}
            >
              Control both the <strong>Hand Navigator</strong> and <strong>all EduCare sections</strong>{' '}
              hands-free using <strong>&ldquo;Hey AI&rdquo;</strong> or <strong>&ldquo;Hi AI&rdquo;</strong>{' '}
              — including Jarvis audio-to-audio AI tutoring and automatic screen reading:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-semibold">
              {[
                '"Hey AI calibration wizard"',
                '"Hey AI start camera"',
                '"Hey AI stop camera"',
                '"Hey AI repeat step"',
                '"Hey AI open AI tutoring"',
                '"Hi AI open live classes"',
              ].map((phrase) => (
                <div
                  key={phrase}
                  className={`px-3 py-2 rounded-xl border ${
                    blindVoiceState === 'armed'
                      ? 'bg-white/15 border-white/30 text-white'
                      : 'bg-[#F4F9FF] dark:bg-slate-900 border-[#B9D3EE] dark:border-slate-700 text-[#153B70] dark:text-sky-200'
                  }`}
                >
                  {phrase}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-800 border-2 border-[#7AA7D9] dark:border-sky-600 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1D6CE0] dark:text-sky-400">
                <Hand className="w-4 h-4" aria-hidden="true" />
                <span>On-Device Webcam Hand Navigator (Top-Right Dock)</span>
              </div>
              <p className="text-sm text-[#16253B] dark:text-slate-200">
                Use the compact <strong>Hand Navigator</strong> window in the top-right corner to
                move a smoothed large pointer with your <strong>index fingertip</strong> and{' '}
                <strong>pinch thumb &amp; index finger</strong> to click anywhere across EduCare.
              </p>
              <p className="text-xs text-[#52657C] dark:text-slate-400">
                Includes voice-activated 4-step Calibration Wizard with real-time positioning audio
                cues, jitter smoothing, pinch cooldown, and 100% on-device MediaPipe tracking.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-[#9CC0E8] dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Routine Progress</p>
              <p className="mt-0.5 text-lg font-bold text-[#153B70] dark:text-sky-300 font-mono tabular-nums">
                {completedSteps} / {checklistItems.length} ({Math.round((completedSteps / checklistItems.length) * 100)}%)
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-[#9CC0E8] dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Calm Focus Timer</p>
              <p className="mt-0.5 text-lg font-bold text-[#1D6CE0] dark:text-sky-400 font-mono tabular-nums">
                {formatTimer(timerSeconds)}
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-[#9CC0E8] dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Visual Surface</p>
              <p className="mt-0.5 text-lg font-bold text-[#159B83] dark:text-emerald-400">
                {contrast === 'soft-blue' ? 'Calm Soft Blue' : 'Customizable'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Orderly Checklist */}
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-[#9CC0E8] dark:border-slate-700 p-4 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#153B70] dark:text-sky-300">
                Predictable Step-by-Step Routine
              </p>
              <div className="space-y-2">
                {checklistItems.map((label, idx) => {
                  const done = checkedSteps[idx];
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setCheckedSteps((prev) => prev.map((v, i) => (i === idx ? !v : v)))
                      }
                      aria-pressed={done}
                      className={`w-full min-h-[42px] px-3 py-2 rounded-lg border text-left text-sm font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                        done
                          ? 'bg-[#E8F7F4] dark:bg-emerald-950/60 border-[#159B83] text-[#0F6E5D] dark:text-emerald-300 line-through'
                          : 'bg-[#F8FAFD] dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-[#16253B] dark:text-slate-200'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-[#159B83]" aria-hidden="true" />
                      ) : (
                        <Circle className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                      )}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calm Timer + Surface Controls */}
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-[#9CC0E8] dark:border-slate-700 p-4 flex flex-col justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#153B70] dark:text-sky-300">
                  Zero-Chaos Focus Pacer
                </p>
                <p className="mt-1 text-xs text-[#52657C] dark:text-slate-400">
                  Gentle 15-minute study block with no loud alarms.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTimerRunning((r) => !r)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {timerRunning ? (
                    <>
                      <Pause className="w-4 h-4" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" aria-hidden="true" />
                      <span>Start 15m</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerSeconds(15 * 60);
                  }}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-[#153B70] dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeContrast(contrast === 'soft-blue' ? 'default' : 'soft-blue')}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#E4EFFB] dark:bg-sky-950/70 border border-[#8EB7E3] dark:border-sky-700 text-[#153B70] dark:text-sky-300 text-xs font-bold cursor-pointer"
                >
                  {contrast === 'soft-blue' ? 'Calm Blue: ON' : 'Enable Calm Soft Blue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 5. STAMMERING: REMIX ARTIST ON THE MIC ================= */}
      {profile === 'stammering' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/90 dark:bg-slate-800 border border-violet-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Speech Assist</p>
              <p className="mt-0.5 text-lg font-bold text-violet-700 dark:text-violet-300">
                Type-to-Speak ON
              </p>
            </div>
            <div className="rounded-xl bg-white/90 dark:bg-slate-800 border border-violet-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Quick Phrases</p>
              <p className="mt-0.5 text-lg font-bold text-[#153B70] dark:text-slate-100 tabular-nums">
                {quickPhrases.length} Instant Buttons
              </p>
            </div>
            <div className="rounded-xl bg-white/90 dark:bg-slate-800 border border-violet-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Pacing Mode</p>
              <p className="mt-0.5 text-lg font-bold text-[#159B83] dark:text-emerald-400">
                Zero-Rush Friendly
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              aria-label="Type anything to speak aloud"
              value={speakDraft}
              onChange={(e) => setSpeakDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSpeakPhrase(speakDraft);
              }}
              placeholder={
                userRole === 'teacher'
                  ? 'Type an encouraging class message to speak aloud...'
                  : 'Type what you want to say in class and let EduCare speak it clearly...'
              }
              className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-violet-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleSpeakPhrase(speakDraft)}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Volume2 className="w-4 h-4" aria-hidden="true" />
              <span>Speak For Me</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickPhrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => handleSpeakPhrase(phrase)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-slate-700 text-xs font-semibold text-[#153B70] dark:text-violet-200 inline-flex items-center gap-1.5 cursor-pointer text-left"
              >
                <MessageSquare className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" aria-hidden="true" />
                <span>{phrase}</span>
              </button>
            ))}
          </div>

          {lastSpoken && (
            <p className="text-xs text-violet-800 dark:text-violet-300 font-medium" aria-live="polite">
              Spoken aloud: &ldquo;{lastSpoken}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* ================= 6. STANDARD: CLASSIC MODE ================= */}
      {profile === 'standard' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#F8FAFD] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Study Notes</p>
              <p className="mt-0.5 text-lg font-bold text-[#153B70] dark:text-slate-100 tabular-nums">
                {materialsCount} Available
              </p>
            </div>
            <BookOpen className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />
          </div>
          <div className="rounded-xl bg-[#F8FAFD] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Assignments</p>
              <p className="mt-0.5 text-lg font-bold text-[#153B70] dark:text-slate-100 tabular-nums">
                {assignmentsCount} Active
              </p>
            </div>
            <Clock className="w-5 h-5 text-[#DF922C] dark:text-amber-400" aria-hidden="true" />
          </div>
          <div className="rounded-xl bg-[#F8FAFD] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Exam Records</p>
              <p className="mt-0.5 text-lg font-bold text-[#159B83] dark:text-emerald-400 tabular-nums">
                {resultsCount} Completed
              </p>
            </div>
            <Accessibility className="w-5 h-5 text-[#159B83] dark:text-emerald-400" aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Compact Accessibility Shortcut Footer */}
      {profile !== 'standard' && (
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className={isDarkCard ? 'text-slate-300' : 'text-[#52657C] dark:text-slate-400'}>
            Need deeper tuning? Visit the Accessibility Centre anytime.
          </span>
          <button
            type="button"
            onClick={() => onNavigate('access')}
            className={`font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer ${
              isDarkCard ? 'text-amber-300' : 'text-[#1E66BE] dark:text-sky-400'
            }`}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Open Full Accessibility Centre</span>
          </button>
        </div>
      )}
    </section>
  );
};
