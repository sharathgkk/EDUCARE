import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Video,
  Volume2,
  WifiOff,
} from 'lucide-react';
import type {
  LanguageCode,
  LiveClassSession,
  MatchedTeacher,
  RecordedLesson,
  StudentDoubt,
  UserAccount,
} from '../../types';
import { RECORDED_LESSONS } from '../../data/educareData';
import { speakAloud } from '../../utils/speech';
import {
  LiveSignInterpreterPanel,
  SignDoubtResolverPanel,
} from '../LiveSignClassroomTools';
import { ClassroomChatPanel } from '../ClassroomChatPanel';

const LIVE_CAPTION_SCRIPT = [
  'Hello and welcome everyone to today class. Let us learn step by step.',
  'Today we will explain the core algorithm and solve one clear example together.',
  'Watch the formula carefully on the board and follow each step slowly.',
  'If you have any question or doubt, please ask in sign language anytime.',
  'Before we finish, let us review the homework and practice for the upcoming exam.',
];

interface ClassesSectionProps {
  currentUser: UserAccount;
  language: LanguageCode;
  publishedClassLink: string;
  liveClasses: LiveClassSession[];
  matchedTeachers: MatchedTeacher[];
  doubts: StudentDoubt[];
  onDoubtSubmitted: (doubt: StudentDoubt) => void;
  onRefreshClasses: () => Promise<void>;
  hideSoundControls?: boolean;
  voiceSelectedClass?: { id: number; kind: 'live' | 'recorded'; classId: string } | null;
  isOnline?: boolean;
}

export const ClassesSection: React.FC<ClassesSectionProps> = ({
  currentUser,
  language,
  publishedClassLink,
  liveClasses,
  matchedTeachers,
  doubts,
  onDoubtSubmitted,
  onRefreshClasses,
  hideSoundControls = false,
  voiceSelectedClass = null,
  isOnline = true,
}) => {
  const [meetingLink, setMeetingLink] = useState(
    liveClasses[0]?.meetingUrl || publishedClassLink
  );
  const [activeClassTitle, setActiveClassTitle] = useState(
    liveClasses[0]?.title || 'Inclusive Live Classroom'
  );
  const [activeClassTeacher, setActiveClassTeacher] = useState(
    liveClasses[0]?.teacherName || matchedTeachers[0]?.name || 'Assigned Teacher'
  );
  const [liveSessionActive, setLiveSessionActive] = useState(true);
  const [captionIndex, setCaptionIndex] = useState(0);
  const [customCaption, setCustomCaption] = useState('');
  const [activeCaption, setActiveCaption] = useState(LIVE_CAPTION_SCRIPT[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [activeLesson, setActiveLesson] = useState<RecordedLesson | null>(
    RECORDED_LESSONS[0]
  );

  const hasEditedLinkRef = useRef(false);

  useEffect(() => {
    const preferred = liveClasses[0]?.meetingUrl || publishedClassLink;
    if (preferred && !hasEditedLinkRef.current) {
      setMeetingLink(preferred);
    }
    if (liveClasses[0]?.title) {
      setActiveClassTitle(liveClasses[0].title);
    }
    if (liveClasses[0]?.teacherName) {
      setActiveClassTeacher(liveClasses[0].teacherName);
    }
  }, [liveClasses, publishedClassLink]);

  useEffect(() => {
    if (!voiceSelectedClass) return;
    if (voiceSelectedClass.kind === 'recorded') {
      const lesson = RECORDED_LESSONS.find((l) => l.id === voiceSelectedClass.classId);
      if (lesson) {
        setActiveLesson(lesson);
      }
      return;
    }
    const cls = liveClasses.find((c) => c.id === voiceSelectedClass.classId);
    if (cls) {
      setMeetingLink(cls.meetingUrl);
      setActiveClassTitle(cls.title);
      setActiveClassTeacher(cls.teacherName);
      setLinkStatus({
        type: 'ok',
        text: `Playing "${cls.title}" via voice selection.`,
      });
    }
  }, [voiceSelectedClass, liveClasses]);

  useEffect(() => {
    if (!liveSessionActive) return;
    const timer = window.setInterval(() => {
      setCaptionIndex((prev) => {
        const next = (prev + 1) % LIVE_CAPTION_SCRIPT.length;
        setActiveCaption(LIVE_CAPTION_SCRIPT[next]);
        return next;
      });
    }, 6500);
    return () => window.clearInterval(timer);
  }, [liveSessionActive]);

  const filteredLessons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return RECORDED_LESSONS;
    return RECORDED_LESSONS.filter(
      (lesson) =>
        lesson.title.toLowerCase().includes(q) ||
        lesson.subject.toLowerCase().includes(q) ||
        lesson.instructor.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const validateAndPrepareLink = (rawLink: string) => {
    const trimmed = rawLink.trim();
    if (!trimmed || !/^https:\/\/\S+$/i.test(trimmed)) {
      setLinkStatus({
        type: 'err',
        text: 'Enter a valid HTTPS meeting link provided by your teacher (starting with https://).',
      });
      return null;
    }
    setLinkStatus({
      type: 'ok',
      text: `Meeting link verified: ${trimmed}`,
    });
    return trimmed;
  };

  const verifiedJoinHref = useMemo(() => {
    const trimmed = meetingLink.trim();
    return /^https:\/\/\S+$/i.test(trimmed) ? trimmed : null;
  }, [meetingLink]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7">
        <h2 className="text-2xl font-bold text-[#153B70] dark:text-slate-100">Online Classroom</h2>
        <p className="mt-1 text-sm text-[#44566C] dark:text-slate-300">
          Join live teacher sessions from home or hospital, or replay captioned recorded lessons at
          your own pace.
        </p>
      </div>

      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-4 py-3 text-sm font-medium text-amber-950 dark:text-amber-200 flex items-center gap-2.5"
        >
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            Internet connection unstable or offline — showing cached class schedules, meeting
            details, and offline recorded lessons ready to read aloud.
          </span>
        </div>
      )}

      {/* Live Classroom (Left) + AI Sign Language Interpreter Agent (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Video className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />
                <div>
                  <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                    Live Classroom: {activeClassTitle}
                  </h3>
                  <p className="text-xs text-[#52657C] dark:text-slate-400">
                    Instructor: {activeClassTeacher} · Visual captions synced to AI Sign Interpreter
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLiveSessionActive((v) => !v)}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                  liveSessionActive
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {liveSessionActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Live Feed On</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Resume Live Feed</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Class Visual Feed & Synchronized Captions */}
            <div className="rounded-xl bg-gradient-to-br from-[#0F2A52] via-[#153B70] to-[#0F4C5C] text-white p-5 space-y-4 border border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-200">
                  <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>LIVE CLASS VISUAL STREAM</span>
                </span>
                <span className="text-[11px] font-mono text-sky-200">
                  Caption {captionIndex + 1} / {LIVE_CAPTION_SCRIPT.length}
                </span>
              </div>

              <div className="rounded-lg bg-slate-950/60 border border-white/15 p-4 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300">
                  Live Teacher Caption (Translated to Sign on Right)
                </p>
                <p className="text-base sm:text-lg font-semibold leading-snug text-white">
                  &ldquo;{activeCaption}&rdquo;
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = customCaption.trim();
                  if (!next) return;
                  setLiveSessionActive(false);
                  setActiveCaption(next);
                  setCustomCaption('');
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  aria-label="Send live class sentence to AI Sign Interpreter"
                  value={customCaption}
                  onChange={(e) => setCustomCaption(e.target.value)}
                  placeholder="Type or paste a live teacher sentence to translate into sign actions..."
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-white placeholder:text-sky-200/75 focus:outline-none focus:border-teal-300"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Translate to Sign
                </button>
              </form>
            </div>

            {/* Meeting Join Controls */}
            <div className="space-y-3 pt-1">
              <div>
                <label
                  htmlFor="meeting-link-input"
                  className="block text-xs font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                >
                  Teacher Meeting Link (HTTPS)
                </label>
                <input
                  id="meeting-link-input"
                  type="url"
                  value={meetingLink}
                  onChange={(e) => {
                    hasEditedLinkRef.current = true;
                    setMeetingLink(e.target.value);
                    setLinkStatus(null);
                  }}
                  placeholder="https://meet.example.edu/educare-room"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {verifiedJoinHref ? (
                  <a
                    href={verifiedJoinHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => validateAndPrepareLink(meetingLink)}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>Join Live Class</span>
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => validateAndPrepareLink(meetingLink)}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Join Live Class</span>
                  </button>
                )}

                {publishedClassLink && meetingLink !== publishedClassLink && (
                  <button
                    type="button"
                    onClick={() => {
                      hasEditedLinkRef.current = false;
                      setMeetingLink(publishedClassLink);
                      setLinkStatus({
                        type: 'ok',
                        text: 'Loaded active teacher classroom link.',
                      });
                    }}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-[#153B70] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Use Teacher&apos;s Active Link
                  </button>
                )}
              </div>

              {linkStatus && (
                <div
                  role="status"
                  className={`p-3 rounded-lg text-xs border ${
                    linkStatus.type === 'err'
                      ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                      : 'bg-[#E9F4FF] dark:bg-sky-950/60 border-blue-200 dark:border-sky-800 text-[#153B70] dark:text-sky-200'
                  }`}
                >
                  {linkStatus.text}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-[#52657C] dark:text-slate-400">
            <span>Teacher Active Room</span>
            <span className="font-mono truncate max-w-[260px]">
              {liveClasses[0]?.meetingUrl || publishedClassLink || 'Not published yet'}
            </span>
          </div>
        </section>

        {/* Right Side: Live AI Sign Language Interpreter Agent */}
        <div className="lg:col-span-5 flex flex-col">
          <LiveSignInterpreterPanel
            activeCaption={activeCaption}
            isLiveRunning={liveSessionActive}
            classTitle={activeClassTitle}
          />
        </div>
      </div>

      {/* Sign-Language Doubt Solving Section -> Assigned Teacher Portal */}
      <SignDoubtResolverPanel
        language={language}
        classTitle={activeClassTitle}
        matchedTeachers={matchedTeachers}
        defaultTeacherName={activeClassTeacher}
        doubts={doubts}
        onDoubtSubmitted={onDoubtSubmitted}
        onRefreshDoubts={onRefreshClasses}
      />

      {/* Real-Time Classroom Chat SDK Panel */}
      <ClassroomChatPanel
        currentUser={currentUser}
        language={language}
        liveClasses={liveClasses}
        initialRoomId={liveClasses[0]?.id || 'classroom-general'}
        hideSoundControls={hideSoundControls}
      />

      {/* Teacher-Created Online Class Links */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[#159B83] dark:text-emerald-400" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                Teacher-Created Online Classes
              </h3>
              <p className="text-xs text-[#52657C] dark:text-slate-400">
                Join scheduled online classes published by your teachers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void onRefreshClasses()}
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh Classes</span>
          </button>
        </div>

        {liveClasses.length === 0 ? (
          <p className="text-sm text-[#52657C] dark:text-slate-400 py-3">
            No scheduled online classes published yet. Paste a teacher link above or check back
            soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveClasses.map((cls) => (
              <div
                key={cls.id}
                className="p-4 rounded-xl bg-[#F8FAFD] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-[#159B83] dark:text-emerald-400">
                    {cls.subject} · {cls.durationMinutes} min ·{' '}
                    {cls.captionsEnabled ? 'Live Captions Enabled' : 'Standard Audio'}
                  </div>
                  <h4 className="text-base font-bold text-[#153B70] dark:text-slate-100">
                    {cls.title}
                  </h4>
                  <p className="text-xs text-[#52657C] dark:text-slate-400">
                    Teacher: {cls.teacherName} · Scheduled:{' '}
                    {new Date(cls.scheduledAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {cls.notes && (
                    <p className="text-xs text-[#44566C] dark:text-slate-300 pt-1">{cls.notes}</p>
                  )}
                  <p className="text-xs font-mono text-[#1E66BE] dark:text-sky-400 break-all pt-1">
                    {cls.meetingUrl}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={cls.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1D6CE0] hover:bg-[#1659BD] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Join Live Class</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setMeetingLink(cls.meetingUrl);
                      setActiveClassTitle(cls.title);
                      setActiveClassTeacher(cls.teacherName);
                      setLinkStatus({
                        type: 'ok',
                        text: `Loaded "${cls.title}" into the Live Classroom & AI Sign Interpreter above.`,
                      });
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-[#153B70] dark:text-slate-200 cursor-pointer"
                  >
                    Load in Live Stage
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(cls.meetingUrl);
                        setCopiedId(cls.id);
                        setTimeout(
                          () => setCopiedId((prev) => (prev === cls.id ? null : prev)),
                          2000
                        );
                      } catch {
                        // ignore clipboard errors
                      }
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === cls.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#159B83]" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recorded Classes + Interactive Transcript Viewer */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
              Recorded Classes
            </h3>
            <p className="text-sm text-[#44566C] dark:text-slate-300">
              Search and replay captioned lessons whenever required.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search recorded lesson"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recorded lesson..."
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-3">
            {filteredLessons.length === 0 ? (
              <p className="text-sm text-[#52657C] dark:text-slate-400 py-6">
                No recorded lessons match &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : (
              filteredLessons.map((lesson) => {
                const isSelected = activeLesson?.id === lesson.id;
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setActiveLesson(lesson)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#E9F4FF] dark:bg-sky-950/60 border-[#1D6CE0] dark:border-sky-500'
                        : 'bg-[#F8FAFD] dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">
                          {lesson.subject} · {lesson.duration} · {lesson.instructor}
                        </p>
                        <h4 className="text-base font-semibold text-[#153B70] dark:text-slate-100 mt-1">
                          {lesson.title}
                        </h4>
                      </div>
                      <span className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                        <Play className="w-4 h-4 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="lg:col-span-5 bg-[#F8FAFD] dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            {activeLesson ? (
              <>
                <div>
                  <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">
                    Lesson Transcript · {activeLesson.captionsAvailable ? 'Captioned' : 'Standard'}
                  </p>
                  <h4 className="text-lg font-bold text-[#153B70] dark:text-slate-100 mt-1">
                    {activeLesson.title}
                  </h4>
                  <p className="text-xs text-[#52657C] dark:text-slate-400 mt-0.5">
                    Instructor: {activeLesson.instructor} · {activeLesson.duration}
                  </p>
                </div>

                <p className="text-sm text-[#16253B] dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  {activeLesson.transcript}
                </p>

                {!hideSoundControls && (
                  <button
                    type="button"
                    onClick={() =>
                      speakAloud(`${activeLesson.title}. ${activeLesson.transcript}`, language)
                    }
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                    <span>Listen to Lesson Transcript</span>
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-[#52657C] dark:text-slate-400">
                Select a lesson to view its transcript.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
