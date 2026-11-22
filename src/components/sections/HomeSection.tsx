import React, { useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Clock,
  Eye,
  FileCheck2,
  Hand,
  School,
  ShieldCheck,
  Trash2,
  Video,
} from 'lucide-react';
import type {
  Assignment,
  ContrastPreset,
  DisabilityProfile,
  LanguageCode,
  LoginLogRecord,
  MatchedTeacher,
  SectionId,
  StudyMaterial,
  UserAccount,
} from '../../types';
import type { BlindVoiceState } from '../../hooks/useBlindWakeWord';
import { DISABILITY_SUPPORT_OPTIONS, TRANSLATIONS } from '../../data/educareData';
import { SuperpowerStudio } from '../SuperpowerStudio';
import { DeafSignAcademy } from '../DeafSignAcademy';

interface HomeSectionProps {
  user: UserAccount;
  language: LanguageCode;
  fontSize: number;
  contrast: ContrastPreset;
  voiceStatus: string;
  assignments: Assignment[];
  materialsCount: number;
  matchedMaterials: StudyMaterial[];
  matchedTeachers: MatchedTeacher[];
  resultsCount: number;
  loginLogs: LoginLogRecord[];
  blindVoiceState?: BlindVoiceState;
  blindLastHeard?: string;
  onSelectProfile: (profile: DisabilityProfile) => void;
  onNavigate: (section: SectionId) => void;
  onOpenStudentResults: () => void;
  onStartVoiceNav: () => void;
  onReadPage: () => void;
  onChangeFontSize: (size: number) => void;
  onChangeContrast: (preset: ContrastPreset) => void;
  onClearSavedLoginInfo?: () => Promise<void>;
}

export const HomeSection: React.FC<HomeSectionProps> = ({
  user,
  language,
  fontSize,
  contrast,
  voiceStatus,
  assignments,
  materialsCount,
  matchedMaterials,
  matchedTeachers,
  resultsCount,
  loginLogs,
  blindVoiceState = 'listening',
  blindLastHeard = '',
  onSelectProfile,
  onNavigate,
  onOpenStudentResults,
  onStartVoiceNav,
  onReadPage,
  onChangeFontSize,
  onChangeContrast,
  onClearSavedLoginInfo,
}) => {
  const [confirmClearLogin, setConfirmClearLogin] = useState(false);
  const [clearingLogin, setClearingLogin] = useState(false);
  const t = TRANSLATIONS[language];
  const activeProfile: DisabilityProfile =
    user.disabilityProfile ?? (user.teachingProfiles?.[0] ?? 'standard');
  const activeProfileMeta =
    DISABILITY_SUPPORT_OPTIONS.find((opt) => opt.id === activeProfile) ??
    DISABILITY_SUPPORT_OPTIONS[0];
  const isDeafStudent = user.role === 'student' && activeProfile === 'deaf';
  const isBlindStudent = user.role === 'student' && activeProfile === 'blind';
  const isOcdStudent = activeProfile === 'ocd';

  const featureCards: Array<{
    id: SectionId;
    title: string;
    description: string;
    cta: string;
    meta: string;
    icon: React.ReactNode;
    accentClass: string;
  }> = [
    {
      id: 'classes',
      title: t.onlineClassesTitle,
      description: t.onlineClassesDesc,
      cta: 'Open Classes',
      meta: isDeafStudent ? 'Live Captions · Visual Transcripts' : 'Live · Recorded Lessons',
      icon: <Video className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />,
      accentClass: 'bg-[#153B70] hover:bg-[#102E59] dark:bg-sky-600 dark:hover:bg-sky-500 text-white',
    },
    {
      id: 'tutor',
      title: t.aiTutorTitle,
      description: t.aiTutorDesc,
      cta: 'Ask AI Tutor',
      meta: isDeafStudent ? 'Visual Text Support' : 'Voice · Text Support',
      icon: <Bot className="w-5 h-5 text-[#159B83] dark:text-emerald-400" aria-hidden="true" />,
      accentClass: 'bg-[#159B83] hover:bg-[#11836E] text-white',
    },
    {
      id: 'access',
      title: t.eyeControlTitle,
      description: t.eyeControlDesc,
      cta: 'Explore Tools',
      meta: isDeafStudent ? 'Contrast · Camera · Font Size' : 'Voice · Camera · Font Size',
      icon: <Eye className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />,
      accentClass: 'bg-[#1D6CE0] hover:bg-[#1659BD] text-white',
    },
    {
      id: 'sign',
      title: t.signLanguageTitle,
      description: t.signLanguageDesc,
      cta: 'Learn Signs',
      meta: 'Visual Sign Guides',
      icon: <Hand className="w-5 h-5 text-[#DF922C] dark:text-amber-400" aria-hidden="true" />,
      accentClass: 'bg-[#DF922C] hover:bg-[#C67F21] text-white',
    },
    {
      id: 'materials',
      title: t.offlineLearningTitle,
      description: t.offlineLearningDesc,
      cta: 'Download Notes',
      meta: `${materialsCount} Offline Notes`,
      icon: <BookOpen className="w-5 h-5 text-[#153B70] dark:text-sky-300" aria-hidden="true" />,
      accentClass: 'bg-[#153B70] hover:bg-[#102E59] dark:bg-sky-600 dark:hover:bg-sky-500 text-white',
    },
    {
      id: 'exam',
      title: t.onlineExamTitle,
      description: t.onlineExamDesc,
      cta: 'Start Exam',
      meta: isDeafStudent ? 'Extra Time · Visual Mode' : 'Extra Time · Read Aloud',
      icon: <FileCheck2 className="w-5 h-5 text-[#159B83] dark:text-emerald-400" aria-hidden="true" />,
      accentClass: 'bg-[#159B83] hover:bg-[#11836E] text-white',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-[#1E66BE] dark:text-sky-400 mb-1">
              {user.role === 'teacher' ? 'Educator Workspace' : 'Student Learning Portal'}
              <span aria-hidden="true"> · </span>
              <span>{user.name}</span>
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#153B70] dark:text-slate-100 text-balance">
              {t.welcomeTitle}
            </h2>
            <p className="mt-2 text-base text-[#44566C] dark:text-slate-300 leading-relaxed">
              {isBlindStudent
                ? 'Always-On Hands-Free Voice Navigator active. Say "Hey AI" or "Hi AI" anytime to open AI tutoring, live classes, study notes, exams, results, or ask a study question aloud.'
                : isOcdStudent
                  ? 'Always-On "Hey AI" Voice Control & On-Device Webcam Hand Navigator active. Say "Hey AI start camera", "Hey AI stop camera", "Hey AI calibrate", or "Hey AI open AI tutoring" anytime.'
                  : t.welcomeSubtitle}
            </p>
          </div>

          {user.role === 'teacher' ? (
            <button
              type="button"
              onClick={() => onNavigate('teacher')}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-[#DF922C] hover:bg-[#C67F21] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>Open Teacher Dashboard</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenStudentResults}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Award className="w-4 h-4" aria-hidden="true" />
              <span>View Student Result ({resultsCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Dedicated Superpower UI/UX, Stats & Controls (shown only for active superpower modes) */}
      {activeProfile !== 'standard' && (
        <SuperpowerStudio
          profile={activeProfile}
          userRole={user.role}
          language={language}
          fontSize={fontSize}
          contrast={contrast}
          voiceStatus={voiceStatus}
          materialsCount={materialsCount}
          assignmentsCount={assignments.length}
          resultsCount={resultsCount}
          blindVoiceState={blindVoiceState}
          blindLastHeard={blindLastHeard}
          allowedProfiles={
            user.role === 'teacher' && user.teachingProfiles && user.teachingProfiles.length > 0
              ? user.teachingProfiles
              : undefined
          }
          onSelectProfile={onSelectProfile}
          onNavigate={onNavigate}
          onStartVoiceNav={onStartVoiceNav}
          onReadPage={onReadPage}
          onChangeFontSize={onChangeFontSize}
          onChangeContrast={onChangeContrast}
        />
      )}

      {/* Super-Sonic Hearing: AI Sign Language Academy (2-Week / 2-Month Courses + Progress Bar) */}
      {isDeafStudent && (
        <DeafSignAcademy
          userId={user.id}
          language={language}
          onOpenSignLibrary={() => onNavigate('sign')}
        />
      )}

      {/* Student-Only Matched Teachers & Tailored Notes for Active Superpower */}
      {user.role === 'student' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section
            aria-labelledby="matched-teachers-heading"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <School className="w-5 h-5 text-[#DF922C] dark:text-amber-400 shrink-0" aria-hidden="true" />
                <div>
                  <h3
                    id="matched-teachers-heading"
                    className="text-lg font-bold text-[#153B70] dark:text-slate-100"
                  >
                    Your {activeProfileMeta.funnyTitle} Teachers
                  </h3>
                  <p className="text-xs text-[#52657C] dark:text-slate-400">
                    Showing only teachers matched to {activeProfileMeta.clearLabel}.
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#DF922C] dark:text-amber-400 tabular-nums shrink-0">
                {matchedTeachers.length} {matchedTeachers.length === 1 ? 'teacher' : 'teachers'}
              </span>
            </div>

            {matchedTeachers.length === 0 ? (
              <p className="text-sm text-[#52657C] dark:text-slate-400 bg-[#F8FAFD] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                No teachers are assigned to {activeProfileMeta.funnyTitle} yet. When a teacher
                selects this superpower, they will appear here automatically.
              </p>
            ) : (
              <div className="space-y-2.5">
                {matchedTeachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="p-3.5 rounded-xl bg-[#F8FAFD] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#153B70] dark:text-slate-100 truncate">
                        {teacher.name}
                      </p>
                      <p className="text-xs text-[#44566C] dark:text-slate-300 truncate">
                        {teacher.subjectSpecialty}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        teacher.isLoggedIn
                          ? 'text-[#0F6E5D] dark:text-emerald-400'
                          : 'text-[#52657C] dark:text-slate-400'
                      }`}
                    >
                      {teacher.isLoggedIn ? 'Available' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            aria-labelledby="matched-notes-heading"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400 shrink-0" aria-hidden="true" />
                <div>
                  <h3
                    id="matched-notes-heading"
                    className="text-lg font-bold text-[#153B70] dark:text-slate-100"
                  >
                    Notes for {activeProfileMeta.funnyTitle}
                  </h3>
                  <p className="text-xs text-[#52657C] dark:text-slate-400">
                    Study notes uploaded specifically for your superpower squad.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('materials')}
                className="text-xs font-semibold text-[#1D6CE0] dark:text-sky-400 hover:underline cursor-pointer shrink-0"
              >
                Open All ({matchedMaterials.length})
              </button>
            </div>

            {matchedMaterials.length === 0 ? (
              <p className="text-sm text-[#52657C] dark:text-slate-400 bg-[#F8FAFD] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                No study notes uploaded for {activeProfileMeta.funnyTitle} yet. Notes uploaded by
                your matched teachers will appear here right away.
              </p>
            ) : (
              <div className="space-y-2.5">
                {matchedMaterials.slice(0, 3).map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => onNavigate('materials')}
                    className="w-full text-left p-3.5 rounded-xl bg-[#F8FAFD] dark:bg-slate-800 hover:bg-[#EFF5FC] dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-bold text-[#153B70] dark:text-slate-100 truncate">
                      {note.title}
                    </p>
                    <p className="text-xs text-[#52657C] dark:text-slate-400 mt-0.5">
                      By {note.uploadedBy || 'EduCare Teacher'} · {note.subject} · {note.readTime}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Core Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {featureCards.map((card) => (
          <article
            key={card.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between transition-shadow hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-[#F1F6FC] dark:bg-slate-800 flex items-center justify-center">
                  {card.icon}
                </span>
                <span className="text-xs font-medium text-[#52657C] dark:text-slate-400">
                  {card.meta}
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100 mb-1.5">
                {card.title}
              </h3>
              <p className="text-sm text-[#44566C] dark:text-slate-300 leading-relaxed">
                {card.description}
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate(card.id)}
                className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${card.accentClass}`}
              >
                <span>{card.cta}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              {card.id === 'exam' && user.role === 'student' && (
                <button
                  type="button"
                  onClick={onOpenStudentResults}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#153B70] dark:text-slate-200 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Result
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Upcoming Assignments Overview */}
      {assignments.length > 0 && (
        <section
          aria-labelledby="assignments-heading"
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7"
        >
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3
              id="assignments-heading"
              className="text-lg font-bold text-[#153B70] dark:text-slate-100"
            >
              Active Assignments
            </h3>
            <span className="text-xs font-medium text-[#52657C] dark:text-slate-400 tabular-nums">
              {assignments.length} {assignments.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {assignments.map((item) => (
              <div
                key={item.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <h4 className="text-base font-semibold text-[#16253B] dark:text-slate-100">
                    {item.title}
                  </h4>
                  <p className="text-sm text-[#44566C] dark:text-slate-300 mt-0.5">
                    {item.details}
                  </p>
                </div>
                <div className="text-xs font-medium text-[#52657C] dark:text-slate-400 shrink-0 tabular-nums">
                  {item.subject} · Due {item.dueDate}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {/* Saved Login Info (Firestore) */}
      {user.authProvider === 'google' && (
        <section
          aria-labelledby="login-history-heading"
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#159B83] dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <h3
                id="login-history-heading"
                className="text-lg font-bold text-[#153B70] dark:text-slate-100"
              >
                Saved Account &amp; Login History
              </h3>
            </div>
            <span className="text-xs font-medium text-[#52657C] dark:text-slate-400 tabular-nums">
              Google Sign-In · {user.loginCount ?? loginLogs.length ?? 1}{' '}
              {(user.loginCount ?? 1) === 1 ? 'login recorded' : 'logins recorded'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-sm">
            <div className="rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Account Email</p>
              <p className="mt-0.5 font-semibold text-[#16253B] dark:text-slate-100 truncate">
                {user.email}
              </p>
            </div>
            <div className="rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Portal Role</p>
              <p className="mt-0.5 font-semibold text-[#16253B] dark:text-slate-100 capitalize">
                {user.role}
              </p>
            </div>
            <div className="rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5">
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">Last Login</p>
              <p className="mt-0.5 font-semibold text-[#16253B] dark:text-slate-100 tabular-nums">
                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Just now'}
              </p>
            </div>
          </div>

          {loginLogs.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {loginLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs"
                >
                  <div className="flex items-center gap-2 text-[#16253B] dark:text-slate-200 font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#1E66BE] dark:text-sky-400 shrink-0" aria-hidden="true" />
                    <span className="tabular-nums">
                      {new Date(log.loggedInAt).toLocaleString()}
                    </span>
                    <span className="text-[#52657C] dark:text-slate-400 capitalize">
                      · {log.portalRole}
                    </span>
                  </div>
                  <span
                    className={`font-semibold ${
                      log.status === 'active'
                        ? 'text-[#159B83] dark:text-emerald-400'
                        : 'text-[#52657C] dark:text-slate-400'
                    }`}
                  >
                    {log.status === 'active' ? 'Active session' : 'Signed out'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {onClearSavedLoginInfo && (
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#52657C] dark:text-slate-400">
                Want to reset your profile and start fresh as a first-time Google user?
              </p>
              {!confirmClearLogin ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearLogin(true)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remove Saved Login Info</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={clearingLogin}
                    onClick={() => {
                      setClearingLogin(true);
                      void onClearSavedLoginInfo().finally(() => {
                        setClearingLogin(false);
                        setConfirmClearLogin(false);
                      });
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {clearingLogin ? 'Removing...' : 'Confirm Remove & Sign Out'}
                  </button>
                  <button
                    type="button"
                    disabled={clearingLogin}
                    onClick={() => setConfirmClearLogin(false)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-[#16253B] dark:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
