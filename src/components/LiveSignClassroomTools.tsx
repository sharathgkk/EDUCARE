import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Eraser,
  Hand,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Send,
  Smile,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { LanguageCode, MatchedTeacher, StudentDoubt } from '../types';
import { apiFetch } from '../services/api';

export type InterpreterPersonaId = 'robot' | 'human' | 'cartoon';
export type SignMotion = 'wave' | 'chin' | 'lift' | 'book' | 'question' | 'circle';

export interface SignActionCue {
  gloss: string;
  motion: SignMotion;
  meaning?: string;
  handshape: string;
  movement: string;
  expression: string;
}

const SIGN_DICTIONARY: Record<string, SignActionCue> = {
  HELLO: {
    gloss: 'HELLO',
    motion: 'wave',
    handshape: 'Open flat palm',
    movement: 'Salute outward from forehead',
    expression: 'Warm welcoming smile',
  },
  WELCOME: {
    gloss: 'WELCOME',
    motion: 'wave',
    handshape: 'Open palm facing up',
    movement: 'Sweep gracefully inward toward chest',
    expression: 'Open, friendly expression',
  },
  TODAY: {
    gloss: 'TODAY',
    motion: 'lift',
    handshape: 'Both Y-hands palms up',
    movement: 'Bounce downward twice in front of chest',
    expression: 'Focused, neutral face',
  },
  CLASS: {
    gloss: 'CLASS',
    motion: 'circle',
    handshape: 'Both C-hands together',
    movement: 'Arc outward to form a circle in front',
    expression: 'Engaged, steady eye contact',
  },
  LEARN: {
    gloss: 'LEARN',
    motion: 'lift',
    handshape: 'Flat O-hand over open palm',
    movement: 'Lift knowledge from palm up to forehead',
    expression: 'Curious, attentive brows',
  },
  STUDY: {
    gloss: 'STUDY',
    motion: 'book',
    handshape: 'Wiggling fingers toward open palm',
    movement: 'Aim fingers at opposite flat palm',
    expression: 'Concentrated gaze',
  },
  BOOK: {
    gloss: 'BOOK',
    motion: 'book',
    handshape: 'Palms pressed together',
    movement: 'Open hands outward like book pages',
    expression: 'Calm, clear expression',
  },
  READ: {
    gloss: 'READ',
    motion: 'book',
    handshape: 'V-hand scanning open palm',
    movement: 'Move two fingers down across flat palm',
    expression: 'Eyes following palm',
  },
  ALGORITHM: {
    gloss: 'STEP-BY-STEP',
    motion: 'circle',
    handshape: 'Flat hands alternating',
    movement: 'Stack ordered steps forward in sequence',
    expression: 'Clear, structured pacing',
  },
  STEP: {
    gloss: 'STEP',
    motion: 'lift',
    handshape: 'Flat hands stacked',
    movement: 'Move hands upward one level at a time',
    expression: 'Steady rhythmic nod',
  },
  FORMULA: {
    gloss: 'FORMULA',
    motion: 'circle',
    handshape: 'F-hands / index pointers',
    movement: 'Link symbols horizontally left to right',
    expression: 'Focused, analytical look',
  },
  EXAMPLE: {
    gloss: 'EXAMPLE',
    motion: 'lift',
    handshape: 'Index finger on opposite open palm',
    movement: 'Present both hands forward together',
    expression: 'Helpful, encouraging look',
  },
  EXPLAIN: {
    gloss: 'EXPLAIN',
    motion: 'circle',
    handshape: 'Both F-hands facing each other',
    movement: 'Alternate forward and back smoothly',
    expression: 'Clear, open expression',
  },
  QUESTION: {
    gloss: 'QUESTION',
    motion: 'question',
    handshape: 'Index finger curved',
    movement: 'Draw a question mark in the air',
    expression: 'Eyebrows raised or furrowed',
  },
  DOUBT: {
    gloss: 'QUESTION',
    motion: 'question',
    handshape: 'Index finger curved',
    movement: 'Trace a crisp question mark forward',
    expression: 'Inquisitive brow furrow',
  },
  HELP: {
    gloss: 'HELP',
    motion: 'lift',
    handshape: 'Thumbs-up fist on flat palm',
    movement: 'Lift both hands upward together',
    expression: 'Supportive, open look',
  },
  UNDERSTAND: {
    gloss: 'UNDERSTAND',
    motion: 'lift',
    handshape: 'Index finger flicking up near temple',
    movement: 'Pop index finger straight up',
    expression: 'Bright nodding expression',
  },
  SLOW: {
    gloss: 'SLOW',
    motion: 'chin',
    handshape: 'Open hand gliding on forearm',
    movement: 'Slide hand slowly up back of opposite hand',
    expression: 'Calm, unhurried face',
  },
  AGAIN: {
    gloss: 'AGAIN / REPEAT',
    motion: 'circle',
    handshape: 'Bent hand tapping flat palm',
    movement: 'Arc bent fingers into opposite palm',
    expression: 'Polite requesting brows',
  },
  HOMEWORK: {
    gloss: 'HOMEWORK',
    motion: 'book',
    handshape: 'HOME (cheek) + WORK (tapping wrists)',
    movement: 'Touch cheek, then tap dominant fist on wrist',
    expression: 'Clear task-focused face',
  },
  EXAM: {
    gloss: 'EXAM / TEST',
    motion: 'question',
    handshape: 'Index fingers drawing ? then palms down',
    movement: 'Trace question marks, then spread palms out',
    expression: 'Attentive, steady brows',
  },
  THANK: {
    gloss: 'THANK YOU',
    motion: 'chin',
    handshape: 'Flat hand fingertips at chin',
    movement: 'Move palm smoothly forward and down',
    expression: 'Grateful smile',
  },
  PLEASE: {
    gloss: 'PLEASE',
    motion: 'circle',
    handshape: 'Flat open palm on chest',
    movement: 'Rub gently in a clockwise circle',
    expression: 'Polite, warm expression',
  },
  CAPTIONS: {
    gloss: 'VISUAL CAPTIONS',
    motion: 'book',
    handshape: 'Both C-hands tracing subtitle bar',
    movement: 'Draw a horizontal line across lower view',
    expression: 'Clear visual focus',
  },
  TEACHER: {
    gloss: 'TEACHER',
    motion: 'lift',
    handshape: 'Flat O-hands at forehead + PERSON',
    movement: 'Pull forward from forehead, then palms down',
    expression: 'Respectful, attentive',
  },
  SCIENCE: {
    gloss: 'SCIENCE',
    motion: 'circle',
    handshape: 'Both A-hands pouring',
    movement: 'Alternate pouring circles in front of chest',
    expression: 'Curious, bright gaze',
  },
  MATH: {
    gloss: 'MATH',
    motion: 'circle',
    handshape: 'Both M-hands crossing',
    movement: 'Brush M-hands past each other twice',
    expression: 'Focused, structured',
  },
};

export function tokenizeCaptionToSignActions(caption: string): SignActionCue[] {
  const cleaned = caption
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const stopWords = new Set([
    'THE',
    'A',
    'AN',
    'IS',
    'ARE',
    'WAS',
    'WERE',
    'TO',
    'OF',
    'IN',
    'ON',
    'AT',
    'FOR',
    'AND',
    'OR',
    'WE',
    'WILL',
    'BE',
    'WITH',
    'THIS',
    'THAT',
    'OUR',
    'YOUR',
    'NOW',
    'LET',
    'US',
  ]);

  const actions: SignActionCue[] = [];
  for (const word of cleaned) {
    if (SIGN_DICTIONARY[word]) {
      actions.push(SIGN_DICTIONARY[word]);
    } else if (word === 'QUESTIONS') {
      actions.push(SIGN_DICTIONARY.QUESTION);
    } else if (word === 'STEPS' || word === 'ALGORITHMS') {
      actions.push(SIGN_DICTIONARY.ALGORITHM);
    } else if (word === 'EXAMPLES') {
      actions.push(SIGN_DICTIONARY.EXAMPLE);
    } else if (word === 'EXPLAINING' || word === 'EXPLANATION') {
      actions.push(SIGN_DICTIONARY.EXPLAIN);
    } else if (word === 'REPEAT' || word === 'REPLAY') {
      actions.push(SIGN_DICTIONARY.AGAIN);
    } else if (word === 'LEARNING') {
      actions.push(SIGN_DICTIONARY.LEARN);
    } else if (!stopWords.has(word) && word.length >= 3 && actions.length < 7) {
      actions.push({
        gloss: word,
        motion: actions.length % 2 === 0 ? 'book' : 'lift',
        handshape: `Fingerspell / Key Concept (${word})`,
        movement: 'Articulate clearly at shoulder height',
        expression: 'Clear mouthing & visual focus',
      });
    }
    if (actions.length >= 8) break;
  }

  if (actions.length === 0) {
    return [SIGN_DICTIONARY.HELLO, SIGN_DICTIONARY.CLASS, SIGN_DICTIONARY.LEARN];
  }
  return actions;
}

export function InterpreterAvatar({
  persona,
  motion,
  playing,
  slowMode,
}: {
  persona: InterpreterPersonaId;
  motion: SignMotion;
  playing: boolean;
  slowMode: boolean;
}) {
  const animClass = playing ? `sign-anim-${motion}` : '';
  const speedClass = slowMode ? 'sign-anim-slow' : '';

  return (
    <svg
      viewBox="0 0 260 220"
      className={`w-full max-w-[235px] h-auto mx-auto select-none ${speedClass}`}
      role="img"
      aria-label={`AI Sign Language Interpreter performing ${motion} sign`}
    >
      <defs>
        <radialGradient id="live-interp-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="130" cy="112" r="96" fill="url(#live-interp-glow)" />
      <circle
        cx="130"
        cy="112"
        r="82"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.14"
        strokeDasharray="4 6"
        className="text-teal-500 dark:text-teal-300"
      />

      {persona === 'robot' && (
        <g>
          <path
            d="M84 198 C84 148, 176 148, 176 198 Z"
            fill="#0F766E"
            stroke="#5EEAD4"
            strokeWidth="2.5"
          />
          <rect x="114" y="160" width="32" height="14" rx="7" fill="#CCFBF1" opacity="0.9" />
          <line x1="130" y1="30" x2="130" y2="50" stroke="#0EA5E9" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="130" cy="25" r="6" fill="#2DD4BF" />
          <rect x="88" y="48" width="84" height="70" rx="22" fill="#0F172A" stroke="#38BDF8" strokeWidth="3" />
          <rect x="98" y="60" width="64" height="44" rx="14" fill="#1E293B" />
          <circle cx="115" cy="79" r="6" fill="#2DD4BF" />
          <circle cx="145" cy="79" r="6" fill="#2DD4BF" />
          <path d="M116 93 Q130 102 144 93" fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {persona === 'human' && (
        <g>
          <path d="M80 198 C82 146, 178 146, 180 198 Z" fill="#1D6CE0" />
          <path d="M115 152 L130 172 L145 152" fill="#E0F2FE" />
          <rect x="120" y="122" width="20" height="26" rx="8" fill="#F2B893" />
          <path d="M88 86 C86 44, 174 44, 172 86 C172 104, 166 118, 160 122 L100 122 C94 118, 88 104, 88 86 Z" fill="#1E293B" />
          <ellipse cx="130" cy="88" rx="34" ry="38" fill="#F5C3A2" />
          <path d="M98 76 Q116 54 156 66 Q164 74 164 84 Q146 68 122 68 Q106 68 98 76 Z" fill="#1E293B" />
          <circle cx="117" cy="86" r="3.8" fill="#0F172A" />
          <circle cx="143" cy="86" r="3.8" fill="#0F172A" />
          <path d="M118 103 Q130 112 142 103" fill="none" stroke="#9A3412" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      )}

      {persona === 'cartoon' && (
        <g>
          <ellipse cx="130" cy="176" rx="46" ry="30" fill="#F59E0B" stroke="#78350F" strokeWidth="2.5" />
          <ellipse cx="130" cy="180" rx="26" ry="18" fill="#FEF3C7" />
          <circle cx="96" cy="54" r="14" fill="#F59E0B" stroke="#78350F" strokeWidth="2.5" />
          <circle cx="164" cy="54" r="14" fill="#F59E0B" stroke="#78350F" strokeWidth="2.5" />
          <circle cx="96" cy="54" r="7" fill="#FDE68A" />
          <circle cx="164" cy="54" r="7" fill="#FDE68A" />
          <circle cx="130" cy="90" r="40" fill="#FBBF24" stroke="#78350F" strokeWidth="2.5" />
          <ellipse cx="130" cy="100" rx="18" ry="13" fill="#FEF3C7" />
          <circle cx="115" cy="82" r="5" fill="#1E293B" />
          <circle cx="145" cy="82" r="5" fill="#1E293B" />
          <circle cx="117" cy="80" r="1.8" fill="#FFFFFF" />
          <circle cx="147" cy="80" r="1.8" fill="#FFFFFF" />
          <ellipse cx="130" cy="95" rx="4.5" ry="3.2" fill="#78350F" />
          <path d="M122 103 Q130 110 138 103" fill="none" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}

      {/* Left signing hand */}
      <g className={`origin-center ${animClass}`} style={{ transformBox: 'fill-box' }}>
        <path
          d="M66 146 C58 134, 60 118, 68 116 C73 115, 76 122, 77 126 C79 116, 86 116, 87 125 C90 118, 96 121, 95 130 C98 127, 102 132, 97 144 C92 154, 74 156, 66 146 Z"
          fill={persona === 'robot' ? '#38BDF8' : persona === 'cartoon' ? '#FDE68A' : '#F5C3A2'}
          stroke={persona === 'robot' ? '#0C4A6E' : '#78350F'}
          strokeWidth="2.2"
        />
      </g>

      {/* Right signing hand */}
      <g
        className={`origin-center ${animClass}`}
        style={{ transformBox: 'fill-box', animationDelay: '0.18s' }}
      >
        <path
          d="M194 146 C202 134, 200 118, 192 116 C187 115, 184 122, 183 126 C181 116, 174 116, 173 125 C170 118, 164 121, 165 130 C162 127, 158 132, 163 144 C168 154, 186 156, 194 146 Z"
          fill={persona === 'robot' ? '#2DD4BF' : persona === 'cartoon' ? '#FDE68A' : '#F5C3A2'}
          stroke={persona === 'robot' ? '#115E59' : '#78350F'}
          strokeWidth="2.2"
        />
      </g>

      <path
        d="M52 106 Q42 122 52 138"
        fill="none"
        stroke="#14B8A6"
        strokeWidth="2.5"
        strokeDasharray="3 4"
        strokeLinecap="round"
        opacity={playing ? 0.85 : 0.25}
      />
      <path
        d="M208 106 Q218 122 208 138"
        fill="none"
        stroke="#0EA5E9"
        strokeWidth="2.5"
        strokeDasharray="3 4"
        strokeLinecap="round"
        opacity={playing ? 0.85 : 0.25}
      />
    </svg>
  );
}

interface LiveSignInterpreterPanelProps {
  activeCaption: string;
  isLiveRunning: boolean;
  classTitle: string;
}

export const LiveSignInterpreterPanel: React.FC<LiveSignInterpreterPanelProps> = ({
  activeCaption,
  isLiveRunning,
  classTitle,
}) => {
  const [persona, setPersona] = useState<InterpreterPersonaId>('robot');
  const [playing, setPlaying] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const actions = useMemo(() => tokenizeCaptionToSignActions(activeCaption), [activeCaption]);

  useEffect(() => {
    setActiveIndex(0);
  }, [activeCaption]);

  useEffect(() => {
    if (!playing || actions.length <= 1) return;
    const intervalMs = slowMode ? 2200 : 1350;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % actions.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [playing, slowMode, actions.length]);

  const currentCue = actions[activeIndex] ?? actions[0];

  return (
    <aside
      aria-label="Live AI Sign Language Interpreter"
      className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-[#0D9488]/35 dark:border-teal-500/40 p-5 flex flex-col justify-between space-y-4 shadow-xs"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D9488] dark:text-teal-300">
              <Hand className="w-4 h-4" aria-hidden="true" />
              <span>AI Live Sign Interpreter</span>
            </div>
            <h3 className="text-base font-bold text-[#153B70] dark:text-slate-100 mt-0.5">
              Real-Time Sign Actions
            </h3>
            <p className="text-xs text-[#52657C] dark:text-slate-400 truncate max-w-[260px]">
              Translating: {classTitle}
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
              isLiveRunning && playing
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {isLiveRunning && playing ? 'LIVE SIGNING' : 'PAUSED'}
          </span>
        </div>

        {/* Persona selector */}
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

        {/* Animated AI Signer Stage */}
        <div className="rounded-xl bg-gradient-to-b from-[#F0FDFA] to-[#EFF6FF] dark:from-slate-800/90 dark:to-slate-900 border border-teal-200/70 dark:border-teal-800/50 p-3 text-center">
          <InterpreterAvatar
            persona={persona}
            motion={currentCue.motion}
            playing={playing}
            slowMode={slowMode}
          />
          <div className="mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-teal-200 dark:border-teal-700">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#0D9488] dark:text-teal-300">
              Signing Now:
            </span>
            <span className="text-sm font-bold text-[#153B70] dark:text-slate-100">
              {currentCue.gloss}
            </span>
          </div>
        </div>

        {/* Sign Action Breakdown */}
        <div className="rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 space-y-1.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-[#52657C] dark:text-slate-400">Handshape:</span>
            <span className="font-semibold text-[#153B70] dark:text-slate-100 text-right">
              {currentCue.handshape}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-[#52657C] dark:text-slate-400">Movement:</span>
            <span className="font-medium text-[#16253B] dark:text-slate-200 text-right">
              {currentCue.movement}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-[#52657C] dark:text-slate-400">Expression:</span>
            <span className="font-medium text-[#16253B] dark:text-slate-200 text-right">
              {currentCue.expression}
            </span>
          </div>
        </div>

        {/* Gloss Sequence Chips */}
        <div>
          <p className="text-[11px] font-semibold text-[#52657C] dark:text-slate-400 mb-1.5">
            Live Sign Action Sequence ({activeIndex + 1}/{actions.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {actions.map((cue, idx) => (
              <button
                key={`${cue.gloss}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  idx === activeIndex
                    ? 'bg-[#0D9488] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-[#153B70] dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-slate-700'
                }`}
              >
                {cue.gloss}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {playing ? (
            <>
              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Pause Signs</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Resume Signs</span>
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
            setActiveIndex(0);
            setPlaying(true);
          }}
          aria-label="Replay sign sequence"
          className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[#153B70] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};

interface SignTile {
  gloss: string;
  cue: string;
  category: 'Need & Polite' | 'Questions' | 'Class Topics';
}

const DOUBT_SIGN_TILES: SignTile[] = [
  { gloss: 'PLEASE', cue: 'Circle palm on chest', category: 'Need & Polite' },
  { gloss: 'EXPLAIN', cue: 'Alternate F-hands', category: 'Need & Polite' },
  { gloss: 'AGAIN', cue: 'Arc fingers into palm', category: 'Need & Polite' },
  { gloss: "DON'T UNDERSTAND", cue: 'Flick index + headshake', category: 'Need & Polite' },
  { gloss: 'SLOW DOWN', cue: 'Slide hand up arm', category: 'Need & Polite' },
  { gloss: 'HELP ME', cue: 'Thumb on palm, lift up', category: 'Need & Polite' },
  { gloss: 'WHAT', cue: 'Open palms shake side', category: 'Questions' },
  { gloss: 'HOW', cue: 'Roll curved hands forward', category: 'Questions' },
  { gloss: 'WHY', cue: 'Forehead to Y-hand', category: 'Questions' },
  { gloss: 'WHICH STEP', cue: 'Alternate thumbs + stack', category: 'Questions' },
  { gloss: 'EXAMPLE', cue: 'Show index on flat palm', category: 'Class Topics' },
  { gloss: 'FORMULA', cue: 'Link symbols left-right', category: 'Class Topics' },
  { gloss: 'THIS TOPIC', cue: 'Point + frame topic', category: 'Class Topics' },
  { gloss: 'ALGORITHM', cue: 'Ordered steps forward', category: 'Class Topics' },
  { gloss: 'HOMEWORK', cue: 'Cheek + tap wrists', category: 'Class Topics' },
  { gloss: 'EXAM', cue: 'Question marks + spread', category: 'Class Topics' },
];

function translateSignSequenceLocally(sequence: string[], classTitle: string): string {
  if (sequence.length === 0) return '';
  const has = (g: string) => sequence.includes(g);

  const topics = sequence.filter((g) =>
    ['EXAMPLE', 'FORMULA', 'THIS TOPIC', 'ALGORITHM', 'HOMEWORK', 'EXAM', 'WHICH STEP'].includes(g)
  );
  const topicText =
    topics.length > 0
      ? topics
          .map((t) => t.toLowerCase())
          .join(' and ')
      : `this part of ${classTitle}`;

  if (has('SLOW DOWN') && !has('EXPLAIN') && !has('WHAT') && !has('HOW') && !has('WHY')) {
    return `Excuse me, could you please slow down a little so I can follow ${topicText} clearly?`;
  }
  if (has("DON'T UNDERSTAND") && has('EXAMPLE')) {
    return `I did not fully understand ${topicText}. Could you please explain it again with an example?`;
  }
  if (has("DON'T UNDERSTAND")) {
    return `Excuse me, I did not understand ${topicText}. Could you please explain it again?`;
  }
  if (has('HOW')) {
    return `Could you please show how ${topicText} works step by step?`;
  }
  if (has('WHY')) {
    return `Could you please explain why ${topicText} works this way?`;
  }
  if (has('WHAT')) {
    return `What does ${topicText} mean in ${classTitle}? Could you please clarify?`;
  }
  if (has('EXPLAIN') || has('AGAIN')) {
    return `Could you please explain ${topicText} one more time?`;
  }
  if (has('HELP ME')) {
    return `I need help with ${topicText}. Could you please guide me?`;
  }
  return `Excuse me, I have a question about ${sequence
    .map((s) => s.toLowerCase())
    .join(' ')} in ${classTitle}. Could you please help?`;
}

interface SignDoubtResolverPanelProps {
  language: LanguageCode;
  classTitle: string;
  matchedTeachers: MatchedTeacher[];
  defaultTeacherName?: string;
  doubts: StudentDoubt[];
  onDoubtSubmitted: (doubt: StudentDoubt) => void;
  onRefreshDoubts: () => Promise<void>;
}

export const SignDoubtResolverPanel: React.FC<SignDoubtResolverPanelProps> = ({
  language,
  classTitle,
  matchedTeachers,
  defaultTeacherName,
  doubts,
  onDoubtSubmitted,
  onRefreshDoubts,
}) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    matchedTeachers[0]?.id ?? 'teacher-assigned'
  );
  const [signSequence, setSignSequence] = useState<string[]>([]);
  const [translatedQuestion, setTranslatedQuestion] = useState('');
  const [aiTranslating, setAiTranslating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState('');
  const [sendError, setSendError] = useState('');

  // Optional Sign Camera Capture
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  useEffect(() => {
    if (matchedTeachers.length > 0 && !matchedTeachers.some((t) => t.id === selectedTeacherId)) {
      setSelectedTeacherId(matchedTeachers[0].id);
    }
  }, [matchedTeachers, selectedTeacherId]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const selectedTeacher = matchedTeachers.find((t) => t.id === selectedTeacherId);
  const resolvedTeacherName =
    selectedTeacher?.name || defaultTeacherName || 'Assigned Teacher';

  const handleAddSign = (gloss: string) => {
    setSendSuccess('');
    setSendError('');
    setAiError('');
    setSignSequence((prev) => {
      const next = [...prev, gloss];
      setTranslatedQuestion(translateSignSequenceLocally(next, classTitle));
      return next;
    });
  };

  const handleRemoveLastSign = () => {
    setSignSequence((prev) => {
      const next = prev.slice(0, -1);
      setTranslatedQuestion(translateSignSequenceLocally(next, classTitle));
      return next;
    });
  };

  const handleClearSigns = () => {
    setSignSequence([]);
    setTranslatedQuestion('');
    setCapturedPreview(null);
    setAiError('');
    setSendError('');
    setSendSuccess('');
  };

  const startCamera = async () => {
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
      setCameraStatus('Camera ready — perform your sign gesture and click Capture Sign.');
    } catch {
      setCameraActive(false);
      setCameraStatus('Camera permission denied or unavailable. Use the Sign Tiles on the left.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStatus('');
  };

  const handleCaptureAndTranslateWithAI = async () => {
    setAiError('');
    let imageBase64 = '';

    if (cameraActive && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 270;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        setCapturedPreview(dataUrl);
        imageBase64 = dataUrl.split(',')[1] || '';
      }
    }

    if (!imageBase64 && signSequence.length === 0) {
      setAiError('Select sign tiles or turn on the camera to capture a sign gesture first.');
      return;
    }

    setAiTranslating(true);
    try {
      const res = await apiFetch('/api/sign/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          signSequence,
          imageBase64: imageBase64 || undefined,
          mimeType: imageBase64 ? 'image/jpeg' : undefined,
          language,
          classTitle,
        }),
      });
      const data = (await res.json()) as { translatedQuestion?: string; error?: string };
      if (!res.ok || !data.translatedQuestion) {
        setAiError(data.error || 'Could not translate sign with AI.');
        return;
      }
      setTranslatedQuestion(data.translatedQuestion);
      if (signSequence.length === 0 && imageBase64) {
        setSignSequence(['CAMERA SIGN GESTURE']);
      }
    } catch {
      setAiError('Network error while contacting the AI Sign Translator.');
    } finally {
      setAiTranslating(false);
    }
  };

  const handleSendToTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalQuestion = translatedQuestion.trim();
    if (!finalQuestion) {
      setSendError('Select sign gestures first so the AI agent can translate your doubt.');
      return;
    }

    setSending(true);
    setSendError('');
    setSendSuccess('');
    try {
      const res = await apiFetch('/api/doubts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          teacherId: selectedTeacher?.id ?? 'teacher-assigned',
          teacherName: resolvedTeacherName,
          classTitle,
          signSequence: signSequence.length > 0 ? signSequence : ['SIGN DOUBT'],
          translatedQuestion: finalQuestion,
        }),
      });
      const data = (await res.json()) as { doubt?: StudentDoubt; error?: string };
      if (!res.ok || !data.doubt) {
        setSendError(data.error || 'Could not send doubt to your teacher.');
        return;
      }
      onDoubtSubmitted(data.doubt);
      setSendSuccess(
        `Your sign-language doubt was translated and sent directly to ${resolvedTeacherName}'s Teacher Portal.`
      );
      setSignSequence([]);
      setTranslatedQuestion('');
      setCapturedPreview(null);
    } catch {
      setSendError('Network error while sending doubt. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-[#1D6CE0]/25 dark:border-sky-500/30 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D6CE0] dark:text-sky-400">
            <MessageSquare className="w-4 h-4" aria-hidden="true" />
            <span>Sign-to-Language Doubt Solving</span>
          </div>
          <h3 className="text-xl font-bold text-[#153B70] dark:text-slate-100 mt-0.5">
            Ask Your Doubt in Sign Language
          </h3>
          <p className="text-sm text-[#44566C] dark:text-slate-300 mt-0.5">
            Express your doubt using sign language tiles or your sign camera. Our AI agent
            translates your signs into clear language and sends it straight to your assigned
            teacher&apos;s portal.
          </p>
        </div>

        <div className="shrink-0 min-w-[220px]">
          <label
            htmlFor="doubt-teacher-select"
            className="block text-xs font-semibold text-[#52657C] dark:text-slate-400 mb-1"
          >
            Assigned Teacher Portal
          </label>
          {matchedTeachers.length > 0 ? (
            <select
              id="doubt-teacher-select"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-800 text-sm font-semibold text-[#153B70] dark:text-slate-100"
            >
              {matchedTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.subjectSpecialty})
                </option>
              ))}
            </select>
          ) : (
            <div className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-800 text-sm font-semibold text-[#153B70] dark:text-slate-100">
              {resolvedTeacherName}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Sign Language Input (Tiles + Optional Camera) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="space-y-3">
            {(['Need & Polite', 'Questions', 'Class Topics'] as const).map((cat) => (
              <div key={cat} className="space-y-1.5">
                <p className="text-xs font-bold text-[#52657C] dark:text-slate-400 uppercase tracking-wide">
                  {cat}
                </p>
                <div className="flex flex-wrap gap-2">
                  {DOUBT_SIGN_TILES.filter((t) => t.category === cat).map((tile) => (
                    <button
                      key={tile.gloss}
                      type="button"
                      onClick={() => handleAddSign(tile.gloss)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-800 hover:border-[#0D9488] dark:hover:border-teal-400 hover:bg-teal-50/70 dark:hover:bg-teal-950/30 text-left transition-colors cursor-pointer"
                    >
                      <span className="block text-xs font-bold text-[#153B70] dark:text-slate-100">
                        {tile.gloss}
                      </span>
                      <span className="block text-[11px] text-[#52657C] dark:text-slate-400">
                        {tile.cue}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Optional Sign Camera */}
          <div className="rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#0D9488] dark:text-teal-300" aria-hidden="true" />
                <span className="text-sm font-bold text-[#153B70] dark:text-slate-100">
                  Live Sign Camera (Optional)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="min-h-[34px] px-3 py-1 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Turn On Sign Camera</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleCaptureAndTranslateWithAI()}
                      disabled={aiTranslating}
                      className="min-h-[34px] px-3 py-1 rounded-lg bg-[#1D6CE0] hover:bg-[#1659BD] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{aiTranslating ? 'Translating...' : 'Capture & Translate Sign'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
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
              className={`w-full max-w-sm aspect-video rounded-lg bg-slate-900 object-cover ${
                cameraActive ? 'block' : 'hidden'
              }`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {capturedPreview && (
              <div className="flex items-center gap-3">
                <img
                  src={capturedPreview}
                  alt="Captured sign gesture"
                  className="w-24 h-16 rounded-lg object-cover border border-teal-300 dark:border-teal-700"
                />
                <span className="text-xs text-[#52657C] dark:text-slate-300">
                  Sign gesture frame captured for translation.
                </span>
              </div>
            )}

            {cameraStatus && (
              <p className="text-xs text-[#52657C] dark:text-slate-400">{cameraStatus}</p>
            )}
          </div>
        </div>

        {/* Right: AI Translation Preview & Send to Teacher Portal */}
        <form
          onSubmit={(e) => void handleSendToTeacher(e)}
          className="lg:col-span-5 rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[#153B70] dark:text-slate-100">
              Your Sign Sequence
            </h4>
            {signSequence.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRemoveLastSign}
                  className="text-xs font-semibold text-[#52657C] dark:text-slate-300 hover:underline cursor-pointer"
                >
                  Undo
                </button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                  type="button"
                  onClick={handleClearSigns}
                  className="text-xs font-semibold text-red-600 dark:text-red-400 inline-flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Eraser className="w-3 h-3" aria-hidden="true" />
                  <span>Clear</span>
                </button>
              </div>
            )}
          </div>

          <div className="min-h-[54px] p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap gap-1.5 items-center">
            {signSequence.length === 0 ? (
              <span className="text-xs text-slate-400">
                Tap sign tiles on the left to build your sign language doubt...
              </span>
            ) : (
              signSequence.map((gloss, idx) => (
                <span
                  key={`${gloss}-${idx}`}
                  className="px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-700 text-xs font-bold text-[#0F766E] dark:text-teal-300"
                >
                  {gloss}
                </span>
              ))
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="translated-doubt-text"
                className="text-xs font-bold text-[#153B70] dark:text-slate-200"
              >
                AI Translation to Normal Language (For Teacher)
              </label>
              <button
                type="button"
                onClick={() => void handleCaptureAndTranslateWithAI()}
                disabled={aiTranslating || signSequence.length === 0}
                className="text-xs font-semibold text-[#1D6CE0] dark:text-sky-400 hover:underline disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span>{aiTranslating ? 'Refining...' : 'Refine with AI'}</span>
              </button>
            </div>
            <textarea
              id="translated-doubt-text"
              rows={3}
              value={translatedQuestion}
              onChange={(e) => setTranslatedQuestion(e.target.value)}
              placeholder="Your translated doubt will appear here automatically..."
              className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
            />
          </div>

          {aiError && (
            <p className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
              {aiError}
            </p>
          )}

          {sendError && (
            <p className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
              {sendError}
            </p>
          )}

          {sendSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{sendSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={sending || !translatedQuestion.trim()}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>
              {sending ? 'Sending...' : `Send Doubt to ${resolvedTeacherName}`}
            </span>
          </button>
        </form>
      </div>

      {/* Student's Sent Doubts & Teacher Replies */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-[#153B70] dark:text-slate-100">
            Your Sent Doubts &amp; Teacher Replies ({doubts.length})
          </h4>
          <button
            type="button"
            onClick={() => void onRefreshDoubts()}
            className="text-xs font-semibold text-[#1D6CE0] dark:text-sky-400 hover:underline cursor-pointer"
          >
            Refresh Replies
          </button>
        </div>

        {doubts.length === 0 ? (
          <p className="text-xs text-[#52657C] dark:text-slate-400">
            No doubts sent yet. Build a sign sequence above to ask your assigned teacher directly.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {doubts.map((item) => (
              <article
                key={item.id}
                className="p-4 rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#52657C] dark:text-slate-400">
                    To: {item.teacherName} · {item.classTitle}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                      item.status === 'answered'
                        ? 'text-[#0F766E] dark:text-emerald-400'
                        : 'text-[#C67F21] dark:text-amber-400'
                    }`}
                  >
                    {item.status === 'answered' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>{item.status === 'answered' ? 'Answered' : 'Sent to Teacher'}</span>
                  </span>
                </div>

                {item.signSequence.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.signSequence.map((s, idx) => (
                      <span
                        key={`${item.id}-${idx}`}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-[#0D9488] dark:text-teal-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-sm font-medium text-[#153B70] dark:text-slate-100">
                  &ldquo;{item.translatedQuestion}&rdquo;
                </p>

                {item.teacherReply && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-0.5">
                    <span className="font-bold block">Teacher Reply ({item.teacherName}):</span>
                    <span>{item.teacherReply}</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
