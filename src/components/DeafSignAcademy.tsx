import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Bot,
  Calendar,
  CheckCircle2,
  Circle,
  Hand,
  Pause,
  Play,
  RotateCcw,
  Send,
  Smile,
  Sparkles,
  User,
} from 'lucide-react';
import type { LanguageCode } from '../types';
import { apiFetch } from '../services/api';

type CourseTrack = '2-weeks' | '2-months';
type CoachPersona = 'robot' | 'human' | 'cartoon';
type SignMotionType = 'wave' | 'chin' | 'lift' | 'book' | 'question' | 'circle';

interface SignCourseLesson {
  id: string;
  schedule: string;
  category: 'Everyday Life' | 'Everyday Education';
  title: string;
  keySigns: string[];
  handshape: string;
  movement: string;
  facialCue: string;
  practiceTip: string;
  motion: SignMotionType;
}

const TWO_WEEK_LESSONS: SignCourseLesson[] = [
  {
    id: '2w-1',
    schedule: 'Days 1–2',
    category: 'Everyday Life',
    title: 'Greetings & Warm Introductions',
    keySigns: ['Hello', 'Good Morning', 'My Name Is', 'Nice to Meet You'],
    handshape: 'Flat open hand with fingers together near the forehead',
    movement: 'Glide smoothly outward from the temple in a friendly arc',
    facialCue: 'Warm smile + open eye contact',
    practiceTip: 'Practice introducing yourself in front of a mirror 3 times slowly.',
    motion: 'wave',
  },
  {
    id: '2w-2',
    schedule: 'Days 3–4',
    category: 'Everyday Life',
    title: 'Everyday Courtesy & Feelings',
    keySigns: ['Thank You', 'Please', 'Happy', 'Excuse Me'],
    handshape: 'Open flat palm touching gently near the chin',
    movement: 'Move forward and slightly downward toward the person',
    facialCue: 'Relaxed eyebrows + gentle nod of gratitude',
    practiceTip: 'Facial expression carries the warmth of the sign — let your smile show.',
    motion: 'chin',
  },
  {
    id: '2w-3',
    schedule: 'Days 5–6',
    category: 'Everyday Life',
    title: 'Home, Food & Daily Needs',
    keySigns: ['Water', 'Eat', 'Home', 'Rest'],
    handshape: 'Three fingers shaped like "W" tapping gently near the chin for Water',
    movement: 'Two light, crisp taps — then open flat hands forming a roof for Home',
    facialCue: 'Natural relaxed face; mouth the word lightly if comfortable',
    practiceTip: 'Sign "Water" and "Home" whenever you take a study break today.',
    motion: 'chin',
  },
  {
    id: '2w-4',
    schedule: 'Days 7–8',
    category: 'Everyday Life',
    title: 'Asking for Help & Everyday Safety',
    keySigns: ['Help', 'Wait', 'Doctor', 'Safe'],
    handshape: 'Thumbs-up fist resting calmly on your opposite open palm',
    movement: 'Lift both hands upward together toward chest height',
    facialCue: 'Slightly raised eyebrows when asking "Can you help me?"',
    practiceTip: 'Move hands slightly forward when offering help to someone else.',
    motion: 'lift',
  },
  {
    id: '2w-5',
    schedule: 'Days 9–10',
    category: 'Everyday Education',
    title: 'Numbers, Time & Class Schedule',
    keySigns: ['1 to 10', 'Today', 'Tomorrow', 'Break Time'],
    handshape: 'Clear upright fingers at shoulder height facing forward',
    movement: 'Hold each number steady for one beat so it is easy to read visually',
    facialCue: 'Steady attentive gaze',
    practiceTip: 'Tap your wrist lightly for "Time", then sign the hour number.',
    motion: 'wave',
  },
  {
    id: '2w-6',
    schedule: 'Days 11–12',
    category: 'Everyday Education',
    title: 'Classroom Questions & Understanding',
    keySigns: ['Question', 'Understand', 'Repeat Please', 'Yes / No'],
    handshape: 'Index finger extended upright at shoulder level',
    movement: 'Trace a crisp question-mark curve downward in the air',
    facialCue: 'Furrowed brows slightly for WH-questions; raised brows for Yes/No questions',
    practiceTip: 'Use "Question" + "Repeat Please" during live online classes.',
    motion: 'question',
  },
  {
    id: '2w-7',
    schedule: 'Day 13',
    category: 'Everyday Education',
    title: 'Reading, Writing & Study Notes',
    keySigns: ['Book', 'Write', 'Study', 'Homework'],
    handshape: 'Both flat palms pressed together like a closed cover',
    movement: 'Hinge both palms open smoothly like opening a book',
    facialCue: 'Focused, engaged expression',
    practiceTip: 'Follow "Book" with a pinching pen motion across your palm for "Write".',
    motion: 'book',
  },
  {
    id: '2w-8',
    schedule: 'Day 14',
    category: 'Everyday Life',
    title: 'Everyday Life & School Mini-Conversation',
    keySigns: ['Hello', 'Ready to Learn', 'Thank You', 'See You Soon'],
    handshape: 'Flow smoothly from open palm greetings into classroom signs',
    movement: 'Pause briefly between each sign so every gesture stays crisp',
    facialCue: 'Confident smile + expressive eyebrow rhythm',
    practiceTip: 'Combine 3 signs in a row to complete your 2-week everyday milestone!',
    motion: 'circle',
  },
];

const TWO_MONTH_LESSONS: SignCourseLesson[] = [
  {
    id: '2m-1',
    schedule: 'Week 1',
    category: 'Everyday Life',
    title: 'Visual Grammar & Facial Expression Mastery',
    keySigns: ['Who', 'What', 'Where', 'When', 'Why'],
    handshape: 'Relaxed open hands with clear wrist alignment at chest space',
    movement: 'Keep signs inside the visual signing frame (forehead to waist)',
    facialCue: 'Eyebrows UP for Yes/No questions; eyebrows DOWN for Who/What/Where/Why',
    practiceTip: 'In sign language, your eyebrows act like punctuation marks.',
    motion: 'question',
  },
  {
    id: '2m-2',
    schedule: 'Week 2',
    category: 'Everyday Life',
    title: 'Family, Friends & Community Navigation',
    keySigns: ['Family', 'Friend', 'Bus / Travel', 'Shop'],
    handshape: 'Both hands in "F" shapes touching at thumbs and index fingers',
    movement: 'Sweep outward in a complete circle until pinkies meet for "Family"',
    facialCue: 'Warm, inclusive expression',
    practiceTip: 'Link both index fingers together twice for "Friend".',
    motion: 'circle',
  },
  {
    id: '2m-3',
    schedule: 'Week 3',
    category: 'Everyday Education',
    title: 'Mathematics & Problem Solving Signs',
    keySigns: ['Add', 'Subtract', 'Equal', 'Solve'],
    handshape: 'Flat hands crossing or meeting cleanly at center chest',
    movement: 'Bring fingertips together smoothly for "Equal"; lift upward for "Add"',
    facialCue: 'Clear deliberate pacing for each step of an equation',
    practiceTip: 'Sign each number clearly before the operation sign.',
    motion: 'lift',
  },
  {
    id: '2m-4',
    schedule: 'Week 4',
    category: 'Everyday Education',
    title: 'Science, Computers & Coding Vocabulary',
    keySigns: ['Science', 'Computer', 'Code', 'Idea'],
    handshape: 'C-shape moving along forearm for "Computer"; alternating thumbs for "Science"',
    movement: 'Pouring motion with thumbs down for "Science" experiments',
    facialCue: 'Curious, bright expression when signing "Idea"',
    practiceTip: 'Fingerspell short coding keywords like IF, FOR, or DEF steadily.',
    motion: 'circle',
  },
  {
    id: '2m-5',
    schedule: 'Week 5',
    category: 'Everyday Education',
    title: 'Classroom Discussions & Teamwork',
    keySigns: ['Agree', 'Explain', 'Share', 'Team'],
    handshape: 'Both index fingers alternating back and forth for "Explain"',
    movement: 'Smooth rhythmic forward-and-back motion at chest height',
    facialCue: 'Nod gently when signing "Agree"',
    practiceTip: 'Pair "Idea" + "Share" to jump into group projects effortlessly.',
    motion: 'wave',
  },
  {
    id: '2m-6',
    schedule: 'Week 6',
    category: 'Everyday Education',
    title: 'Exams, Study Plans & Deadlines',
    keySigns: ['Exam', 'Finish', 'Extra Time', 'Ready'],
    handshape: 'Open palms flipping outward crisply for "Finish"',
    movement: 'Trace question marks downward with both hands for "Exam / Test"',
    facialCue: 'Calm, confident posture',
    practiceTip: 'Practice signing "Need Extra Time" + "Thank You" smoothly.',
    motion: 'book',
  },
  {
    id: '2m-7',
    schedule: 'Week 7',
    category: 'Everyday Life',
    title: 'Health, Emotions & Self-Advocacy',
    keySigns: ['Calm', 'Confused', 'Need Captions', 'Interpreter'],
    handshape: 'Open palms gliding slowly downward from shoulders for "Calm"',
    movement: 'Slow, steady breathing rhythm matching the downward hand glide',
    facialCue: 'Match your facial expression to the emotion being signed',
    practiceTip: 'Advocating for captions or visual notes is a superpower!',
    motion: 'lift',
  },
  {
    id: '2m-8',
    schedule: 'Week 8',
    category: 'Everyday Education',
    title: 'Fluent Storytelling & Graduation Showcase',
    keySigns: ['Story', 'Learn', 'Proud', 'Future'],
    handshape: 'Full expressive signing combining everyday life and school vocabulary',
    movement: 'Forward arc from cheek into open space for "Future"',
    facialCue: 'Proud, joyful expression',
    practiceTip: 'Sign a 3-sentence story about your favorite school subject!',
    motion: 'wave',
  },
];

interface DeafSignAcademyProps {
  userId: string;
  language: LanguageCode;
  onOpenSignLibrary: () => void;
}

const CoachAvatarStage: React.FC<{
  persona: CoachPersona;
  motion: SignMotionType;
  playing: boolean;
  slowMode: boolean;
  activeTitle: string;
}> = ({ persona, motion, playing, slowMode, activeTitle }) => {
  const duration = slowMode ? '2.8s' : '1.6s';
  const animClass = playing ? `sign-anim-${motion}` : '';

  const palette =
    persona === 'robot'
      ? {
          bg: 'from-cyan-950 via-slate-900 to-indigo-950',
          accent: '#38BDF8',
          secondary: '#FBBF24',
          body: '#1E293B',
          head: '#0F172A',
          hand: '#38BDF8',
          label: 'Nova · AI Sign Robot',
        }
      : persona === 'human'
        ? {
            bg: 'from-indigo-950 via-[#153B70] to-teal-950',
            accent: '#F59E0B',
            secondary: '#34D399',
            body: '#1D4ED8',
            head: '#F3C6A5',
            hand: '#F3C6A5',
            label: 'Maya · AI Human Coach',
          }
        : {
            bg: 'from-amber-950 via-indigo-950 to-teal-950',
            accent: '#FBBF24',
            secondary: '#38BDF8',
            body: '#0D9488',
            head: '#FDE68A',
            hand: '#FCD34D',
            label: 'Pip · AI Cartoon Buddy',
          };

  return (
    <div
      className={`relative rounded-2xl bg-gradient-to-br ${palette.bg} border border-white/15 p-5 overflow-hidden flex flex-col items-center justify-between min-h-[290px]`}
    >
      {/* Subtle luminous visual-rhythm rings */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 42%, rgba(56, 189, 248, 0.35), transparent 58%), radial-gradient(circle at 80% 80%, rgba(251, 191, 36, 0.25), transparent 45%)',
        }}
      />

      <div className="relative z-10 w-full flex items-center justify-between text-xs text-sky-100/90 font-medium">
        <span>{palette.label}</span>
        <span>{playing ? (slowMode ? 'Slow Motion · 0.6x' : 'Live Motion · 1x') : 'Paused'}</span>
      </div>

      {/* Animated Expressive AI Sign Coach SVG */}
      <svg
        viewBox="0 0 260 200"
        className="relative z-10 w-full max-w-[260px] h-48"
        role="img"
        aria-label={`${palette.label} demonstrating ${activeTitle}`}
      >
        {/* Soft glowing signing frame arc */}
        <ellipse
          cx="130"
          cy="115"
          rx="96"
          ry="68"
          fill="none"
          stroke={palette.accent}
          strokeOpacity="0.25"
          strokeWidth="2"
          strokeDasharray="6 6"
        />

        {/* Shoulders / Torso */}
        <path
          d="M78 192 C78 148, 182 148, 182 192 Z"
          fill={palette.body}
          stroke={palette.accent}
          strokeWidth="2.5"
        />

        {/* Head per persona */}
        {persona === 'robot' && (
          <g>
            <line x1="130" y1="22" x2="130" y2="38" stroke={palette.accent} strokeWidth="3" />
            <circle cx="130" cy="18" r="6" fill={palette.secondary} />
            <rect
              x="92"
              y="38"
              width="76"
              height="64"
              rx="18"
              fill={palette.head}
              stroke={palette.accent}
              strokeWidth="3"
            />
            {/* Glowing Visor */}
            <rect x="103" y="54" width="54" height="24" rx="10" fill="#082F49" />
            <circle cx="118" cy="66" r="5" fill="#38BDF8" />
            <circle cx="142" cy="66" r="5" fill="#38BDF8" />
            {/* Friendly LED Smile */}
            <path
              d="M116 88 Q130 97 144 88"
              fill="none"
              stroke={palette.secondary}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        )}

        {persona === 'human' && (
          <g>
            {/* Hair */}
            <path
              d="M90 68 C90 34, 170 34, 170 68 L172 90 C162 84, 158 70, 158 60 C145 50, 115 50, 102 60 C102 70, 98 84, 88 90 Z"
              fill="#1E293B"
            />
            {/* Face */}
            <circle cx="130" cy="72" r="32" fill={palette.head} />
            {/* Expressive Eyebrows */}
            <path d="M112 60 Q118 56 124 60" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M136 60 Q142 56 148 60" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Eyes */}
            <circle cx="118" cy="68" r="3.5" fill="#0F172A" />
            <circle cx="142" cy="68" r="3.5" fill="#0F172A" />
            {/* Warm Smile */}
            <path
              d="M118 84 Q130 94 142 84"
              fill="none"
              stroke="#9A3412"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        )}

        {persona === 'cartoon' && (
          <g>
            {/* Cute Ears / Antenna Tufts */}
            <circle cx="96" cy="48" r="13" fill={palette.accent} />
            <circle cx="164" cy="48" r="13" fill={palette.accent} />
            {/* Round Friendly Cartoon Head */}
            <circle cx="130" cy="72" r="35" fill={palette.head} stroke={palette.accent} strokeWidth="3" />
            {/* Big Expressive Eyes */}
            <circle cx="116" cy="67" r="6" fill="#0F172A" />
            <circle cx="144" cy="67" r="6" fill="#0F172A" />
            <circle cx="118" cy="65" r="2" fill="#FFFFFF" />
            <circle cx="146" cy="65" r="2" fill="#FFFFFF" />
            {/* Rosy Cheeks */}
            <circle cx="105" cy="78" r="4.5" fill="#FB7185" fillOpacity="0.55" />
            <circle cx="155" cy="78" r="4.5" fill="#FB7185" fillOpacity="0.55" />
            {/* Cheerful Smile */}
            <path
              d="M117 83 Q130 95 143 83"
              fill="none"
              stroke="#0F172A"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Left Supporting Arm + Hand */}
        <g
          className={animClass ? `${animClass}-left` : ''}
          style={{ animationDuration: duration, transformOrigin: '92px 158px' }}
        >
          <path
            d="M88 164 Q64 145 78 122"
            fill="none"
            stroke={palette.hand}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <circle cx="80" cy="118" r="11" fill={palette.hand} stroke="#0F172A" strokeWidth="1.5" />
          <path d="M74 110 L74 102 M80 107 L80 99 M86 110 L86 102" stroke={palette.hand} strokeWidth="3.5" strokeLinecap="round" />
        </g>

        {/* Right Dominant Signing Arm + Hand */}
        <g
          className={animClass ? `${animClass}-right` : ''}
          style={{ animationDuration: duration, transformOrigin: '168px 158px' }}
        >
          <path
            d="M172 164 Q198 136 184 102"
            fill="none"
            stroke={palette.hand}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <circle cx="182" cy="96" r="12" fill={palette.hand} stroke="#0F172A" strokeWidth="1.5" />
          <path
            d="M175 88 L173 78 M181 85 L181 75 M187 86 L189 77 M192 92 L198 86"
            stroke={palette.hand}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* Visual Motion Path Cue */}
        <path
          d={
            motion === 'question'
              ? 'M200 72 Q216 64 212 84 Q208 98 202 106'
              : motion === 'book'
                ? 'M95 130 Q130 112 165 130'
                : motion === 'lift'
                  ? 'M130 142 L130 104'
                  : 'M188 74 Q212 64 222 86'
          }
          fill="none"
          stroke={palette.secondary}
          strokeWidth="2.5"
          strokeDasharray="4 4"
          strokeLinecap="round"
        />
      </svg>

      <div className="relative z-10 w-full text-center">
        <p className="text-xs font-semibold text-amber-300">
          Visual Demonstration · 100% Silent Mode
        </p>
      </div>
    </div>
  );
};

export const DeafSignAcademy: React.FC<DeafSignAcademyProps> = ({
  userId,
  language,
  onOpenSignLibrary,
}) => {
  const storageKey = `educare_sign_academy_progress_${userId}`;
  const [track, setTrack] = useState<CourseTrack>('2-weeks');
  const [persona, setPersona] = useState<CoachPersona>('robot');
  const [playing, setPlaying] = useState<boolean>(true);
  const [slowMode, setSlowMode] = useState<boolean>(false);
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return ['2w-1'];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return ['2w-1'];
    }
  });

  const lessons = track === '2-weeks' ? TWO_WEEK_LESSONS : TWO_MONTH_LESSONS;
  const [activeLessonId, setActiveLessonId] = useState<string>(TWO_WEEK_LESSONS[0].id);

  // Visual AI Sign Coach prompt state
  const [coachPrompt, setCoachPrompt] = useState('');
  const [coachAnswer, setCoachAnswer] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(completedIds));
    } catch {
      // Ignore storage quota issues
    }
  }, [completedIds, storageKey]);

  const activeLesson = useMemo(
    () => lessons.find((l) => l.id === activeLessonId) ?? lessons[0],
    [lessons, activeLessonId]
  );

  const trackCompletedCount = useMemo(
    () => lessons.filter((l) => completedIds.includes(l.id)).length,
    [lessons, completedIds]
  );
  const progressPercent = Math.round((trackCompletedCount / lessons.length) * 100);

  const handleSwitchTrack = (nextTrack: CourseTrack) => {
    setTrack(nextTrack);
    const nextList = nextTrack === '2-weeks' ? TWO_WEEK_LESSONS : TWO_MONTH_LESSONS;
    setActiveLessonId(nextList[0].id);
  };

  const toggleLessonComplete = (id: string) => {
    setCompletedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAskSignCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = coachPrompt.trim();
    if (!clean) return;
    setCoachLoading(true);
    setCoachAnswer('');
    try {
      const res = await apiFetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question: `You are a friendly visual Sign Language coach teaching a deaf student. Never mention sound or listening. Give a clear, upbeat, step-by-step visual guide (Handshape, Hand Position, Movement, Facial Expression) for how to sign: "${clean}". Keep it concise and easy to follow.`,
          language,
          role: 'student',
        }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      setCoachAnswer(
        data.answer ||
          data.error ||
          'Use clear open-hand gestures inside chest height, move smoothly, and match your facial expression to the meaning.'
      );
    } catch {
      setCoachAnswer(
        'Visual Coach Tip: Keep your hands clearly visible between shoulder and chest height, form the key handshape cleanly, and pair the movement with a matching facial expression.'
      );
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="sign-academy-heading"
      className="bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-indigo-200/80 dark:border-slate-800 p-6 sm:p-7 space-y-6 shadow-xs"
    >
      {/* Top Header & Course Track Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-700 dark:text-amber-300">
            Super-Sonic Hearing · Visual Sign Language Academy · 100% Sound-Free
          </p>
          <h3
            id="sign-academy-heading"
            className="mt-1 text-2xl font-bold text-[#153B70] dark:text-slate-100"
          >
            Learn Sign Language with Your AI Coach
          </h3>
          <p className="mt-1 text-sm text-[#44566C] dark:text-slate-300">
            Master every sign needed for everyday life and school with interactive visual coaching.
          </p>
        </div>

        {/* Segmented Course Duration Switcher */}
        <div
          role="tablist"
          aria-label="Sign language course length"
          className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={track === '2-weeks'}
            onClick={() => handleSwitchTrack('2-weeks')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              track === '2-weeks'
                ? 'bg-[#153B70] dark:bg-amber-400 text-white dark:text-slate-950 shadow-xs'
                : 'text-[#44566C] dark:text-slate-300 hover:text-[#153B70] dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            <span>2-Week Everyday Course</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={track === '2-months'}
            onClick={() => handleSwitchTrack('2-months')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              track === '2-months'
                ? 'bg-[#153B70] dark:bg-amber-400 text-white dark:text-slate-950 shadow-xs'
                : 'text-[#44566C] dark:text-slate-300 hover:text-[#153B70] dark:hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" aria-hidden="true" />
            <span>2-Month Complete Course</span>
          </button>
        </div>
      </div>

      {/* Course Progress Bar */}
      <div className="rounded-xl bg-[#F4F7FE] dark:bg-slate-800/80 border border-indigo-100 dark:border-slate-700 p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="font-bold text-[#153B70] dark:text-slate-100">
            {track === '2-weeks' ? '2-Week Everyday Essentials Progress' : '2-Month Complete Fluency Progress'}
          </div>
          <div className="font-mono text-sm font-bold text-indigo-700 dark:text-amber-300 tabular-nums">
            {trackCompletedCount} / {lessons.length} Lessons · {progressPercent}%
          </div>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Sign language course progress"
          className="w-full h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#159B83] via-[#1D6CE0] to-[#DF922C] transition-all duration-500"
            style={{ width: `${Math.max(progressPercent, 3)}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#52657C] dark:text-slate-400">
          <span>
            {progressPercent === 100
              ? 'Course complete! You mastered every everyday & school sign in this track.'
              : `Next milestone: Complete "${activeLesson.title}" to boost your visual fluency.`}
          </span>
          <button
            type="button"
            onClick={onOpenSignLibrary}
            className="font-semibold text-[#1E66BE] dark:text-sky-400 hover:underline cursor-pointer"
          >
            Open Full Visual Sign Dictionary →
          </button>
        </div>
      </div>

      {/* Main Split: AI Sign Coach Stage (Left) + Interactive Course Modules (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: AI Coach Avatar & Visual Sign Breakdown */}
        <div className="lg:col-span-6 space-y-4">
          {/* Choose Your AI Agent Persona */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#52657C] dark:text-slate-400">
              Choose Your AI Sign Coach
            </span>
            <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-800 gap-1">
              {(
                [
                  { id: 'robot', label: 'AI Robot', icon: <Bot className="w-3.5 h-3.5" /> },
                  { id: 'human', label: 'AI Human', icon: <User className="w-3.5 h-3.5" /> },
                  { id: 'cartoon', label: 'AI Cartoon', icon: <Smile className="w-3.5 h-3.5" /> },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={persona === item.id}
                  onClick={() => setPersona(item.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    persona === item.id
                      ? 'bg-[#153B70] dark:bg-sky-600 text-white'
                      : 'text-[#44566C] dark:text-slate-300 hover:text-[#153B70] dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <CoachAvatarStage
            persona={persona}
            motion={activeLesson.motion}
            playing={playing}
            slowMode={slowMode}
            activeTitle={activeLesson.title}
          />

          {/* Motion Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#153B70] hover:bg-[#102E59] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{playing ? 'Pause Motion' : 'Play Motion'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSlowMode((s) => !s)}
              aria-pressed={slowMode}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                slowMode
                  ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 text-amber-950 dark:text-amber-200'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#153B70] dark:text-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{slowMode ? 'Slow Practice: ON' : 'Slow Practice'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleLessonComplete(activeLesson.id)}
              aria-pressed={completedIds.includes(activeLesson.id)}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ml-auto ${
                completedIds.includes(activeLesson.id)
                  ? 'bg-[#159B83] hover:bg-[#11836E] text-white'
                  : 'border border-[#159B83] text-[#0F6E5D] dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>
                {completedIds.includes(activeLesson.id) ? 'Lesson Completed' : 'Mark Complete'}
              </span>
            </button>
          </div>

          {/* Active Lesson Visual Breakdown */}
          <div className="rounded-xl bg-[#F8FAFD] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 space-y-2.5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-[#153B70] dark:text-slate-100">
                {activeLesson.schedule}: {activeLesson.title}
              </h4>
              <span className="text-xs font-medium text-[#52657C] dark:text-slate-400">
                {activeLesson.category}
              </span>
            </div>
            <p className="text-xs text-[#44566C] dark:text-slate-300">
              <strong className="text-[#153B70] dark:text-slate-100">Key Signs:</strong>{' '}
              {activeLesson.keySigns.join(' · ')}
            </p>
            <p className="text-xs text-[#44566C] dark:text-slate-300">
              <strong className="text-[#153B70] dark:text-slate-100">Handshape:</strong>{' '}
              {activeLesson.handshape}
            </p>
            <p className="text-xs text-[#44566C] dark:text-slate-300">
              <strong className="text-[#153B70] dark:text-slate-100">Movement:</strong>{' '}
              {activeLesson.movement}
            </p>
            <p className="text-xs text-[#44566C] dark:text-slate-300">
              <strong className="text-[#153B70] dark:text-slate-100">Facial Cue:</strong>{' '}
              {activeLesson.facialCue}
            </p>
            <p className="text-xs text-indigo-800 dark:text-amber-300 font-medium pt-1">
              Practice Tip: {activeLesson.practiceTip}
            </p>
          </div>
        </div>

        {/* Right: Course Curriculum List + Ask AI Sign Coach */}
        <div className="lg:col-span-6 space-y-4">
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {lessons.map((lesson) => {
              const isDone = completedIds.includes(lesson.id);
              const isSelected = activeLesson.id === lesson.id;
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => setActiveLessonId(lesson.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'border-[#153B70] dark:border-amber-400 bg-indigo-50/70 dark:bg-slate-800 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {isDone ? (
                      <CheckCircle2
                        className="w-4 h-4 text-[#159B83] dark:text-emerald-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        className="w-4 h-4 text-slate-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">
                        {lesson.schedule} · {lesson.category}
                      </p>
                      <p className="text-sm font-bold text-[#153B70] dark:text-slate-100 truncate">
                        {lesson.title}
                      </p>
                      <p className="text-xs text-[#44566C] dark:text-slate-300 truncate mt-0.5">
                        {lesson.keySigns.join(', ')}
                      </p>
                    </div>
                  </div>
                  <Hand
                    className={`w-4 h-4 shrink-0 mt-1 ${
                      isSelected ? 'text-[#DF922C]' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          {/* Ask Your AI Sign Coach (100% Visual Text Guide) */}
          <div className="rounded-xl bg-[#F4F7FE] dark:bg-slate-800/80 border border-indigo-200/70 dark:border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#DF922C]" aria-hidden="true" />
              <h4 className="text-sm font-bold text-[#153B70] dark:text-slate-100">
                Ask Your AI Sign Coach Any Word or School Phrase
              </h4>
            </div>
            <form onSubmit={(e) => void handleAskSignCoach(e)} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                aria-label="Ask how to sign any word or phrase"
                value={coachPrompt}
                onChange={(e) => setCoachPrompt(e.target.value)}
                placeholder="e.g. How do I sign 'I finished my homework'?"
                className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#1D6CE0] focus:outline-none"
              />
              <button
                type="submit"
                disabled={coachLoading}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#159B83] hover:bg-[#11836E] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{coachLoading ? 'Guiding...' : 'Show Sign Steps'}</span>
              </button>
            </form>

            {coachAnswer && (
              <div
                aria-live="polite"
                className="rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-700 p-3.5 text-xs text-[#16253B] dark:text-slate-200 whitespace-pre-wrap leading-relaxed"
              >
                {coachAnswer}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
