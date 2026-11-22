import React, { useEffect, useState } from 'react';
import {
  Accessibility,
  Award,
  BookOpen,
  Bot,
  FileCheck2,
  Hand,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Moon,
  Sun,
  Video,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import type {
  ContrastPreset,
  LanguageCode,
  SectionId,
  ThemeMode,
  UserAccount,
} from '../types';
import type { BlindVoiceState } from '../hooks/useBlindWakeWord';
import { CONTRAST_PRESETS, TRANSLATIONS } from '../data/educareData';

interface WorkspaceShellProps {
  user: UserAccount;
  activeSection: SectionId;
  language: LanguageCode;
  fontSize: number;
  theme: ThemeMode;
  contrast: ContrastPreset;
  voiceStatus: string;
  onNavigate: (section: SectionId) => void;
  onOpenStudentResults: () => void;
  onChangeLanguage: (lang: LanguageCode) => void;
  onStartVoiceNav: () => void;
  onReadPage: () => void;
  onChangeFontSize: (size: number) => void;
  onToggleTheme: () => void;
  onChangeContrast: (preset: ContrastPreset) => void;
  onSignOut: () => void;
  isDeafStudent?: boolean;
  isBlindStudent?: boolean;
  alwaysOnVoice?: boolean;
  isOcdMode?: boolean;
  isNoHandsMode?: boolean;
  isOnline?: boolean;
  blindVoiceState?: BlindVoiceState;
  blindLastHeard?: string;
  children: React.ReactNode;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  user,
  activeSection,
  language,
  fontSize,
  theme,
  contrast,
  voiceStatus,
  onNavigate,
  onOpenStudentResults,
  onChangeLanguage,
  onStartVoiceNav,
  onReadPage,
  onChangeFontSize,
  onToggleTheme,
  onChangeContrast,
  onSignOut,
  isDeafStudent = false,
  isBlindStudent = false,
  alwaysOnVoice = false,
  isOcdMode = false,
  isNoHandsMode = false,
  isOnline = true,
  blindVoiceState = 'listening',
  blindLastHeard = '',
  children,
}) => {
  const showAlwaysOnVoice = isBlindStudent || alwaysOnVoice;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (!confirmSignOutOpen) return;
    const handleNodConfirm = (event: Event) => {
      event.preventDefault();
      setConfirmSignOutOpen(false);
      onSignOut();
    };
    window.addEventListener('educare:nod-confirm', handleNodConfirm);
    return () => window.removeEventListener('educare:nod-confirm', handleNodConfirm);
  }, [confirmSignOutOpen, onSignOut]);

  const primaryNavItems: Array<{ id: SectionId; label: string; icon: React.ReactNode }> =
    user.role === 'teacher'
      ? [
          {
            id: 'teacher',
            label: t.navTeacher,
            icon: <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
          {
            id: 'home',
            label: t.navHome,
            icon: <Home className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
          {
            id: 'classes',
            label: t.navClasses,
            icon: <Video className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
          {
            id: 'materials',
            label: t.navMaterials,
            icon: <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
          {
            id: 'tutor',
            label: t.navTutor,
            icon: <Bot className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
          {
            id: 'exam',
            label: t.navExam,
            icon: <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
        ]
      : [
          {
            id: 'home',
            label: t.navHome,
            icon: <Home className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
          {
            id: 'classes',
            label: t.navClasses,
            icon: <Video className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
          {
            id: 'materials',
            label: t.navMaterials,
            icon: <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
          {
            id: 'tutor',
            label: t.navTutor,
            icon: <Bot className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
          {
            id: 'exam',
            label: t.navExam,
            icon: <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
          },
        ];

  const handleNavClick = (section: SectionId) => {
    onNavigate(section);
    setMobileMenuOpen(false);
  };

  const handleStudentResultsClick = () => {
    onOpenStudentResults();
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand + Signed-in User */}
      <div className="bg-[#153B70] dark:bg-slate-900 text-white px-5 py-4 border-b border-[#0E2B54] dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => handleNavClick(user.role === 'teacher' ? 'teacher' : 'home')}
            className="text-xl font-bold tracking-tight text-white whitespace-nowrap cursor-pointer block"
          >
            EduCare
          </button>
          <p className="text-xs text-blue-100 dark:text-slate-400 truncate mt-0.5">
            {user.role === 'teacher' ? 'Teacher' : 'Student'} · {user.name}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Scrollable Operations Stack */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5">
        {/* Primary Navigation */}
        <nav aria-label="Primary navigation" className="space-y-1">
          <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#52657C] dark:text-slate-400">
            Navigation
          </p>
          {primaryNavItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#153B70] dark:bg-sky-600 text-white shadow-xs'
                    : 'text-[#16253B] dark:text-slate-200 hover:bg-[#F1F6FC] dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {user.role === 'student' && (
            <button
              type="button"
              onClick={handleStudentResultsClick}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl text-sm font-semibold bg-[#E8F7F4] dark:bg-emerald-950/70 text-[#0F6E5D] dark:text-emerald-300 border border-transparent dark:border-emerald-800 hover:bg-[#D5F0EB] dark:hover:bg-emerald-900/70 flex items-center gap-2.5 transition-colors cursor-pointer text-left"
            >
              <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Student Result</span>
            </button>
          )}
        </nav>

        {/* Inclusive Support Tools */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
          <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#52657C] dark:text-slate-400">
            Inclusive Tools
          </p>

          <button
            type="button"
            onClick={() => handleNavClick('access')}
            className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
              activeSection === 'access'
                ? 'bg-[#153B70] dark:bg-sky-600 text-white'
                : 'bg-[#F1F6FC] dark:bg-slate-800 text-[#153B70] dark:text-slate-200 hover:bg-blue-100/70 dark:hover:bg-slate-700'
            }`}
          >
            <Accessibility className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{t.navAccess}</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('sign')}
            className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
              activeSection === 'sign'
                ? 'bg-[#153B70] dark:bg-sky-600 text-white'
                : 'bg-[#F1F6FC] dark:bg-slate-800 text-[#153B70] dark:text-slate-200 hover:bg-blue-100/70 dark:hover:bg-slate-700'
            }`}
          >
            <Hand className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{t.navSign}</span>
          </button>

          {!isDeafStudent && (
            <>
              {showAlwaysOnVoice ? (
                <div
                  role="status"
                  aria-live="polite"
                  className={`w-full px-3 py-2.5 rounded-xl border-2 text-xs space-y-1 ${
                    isBlindStudent
                      ? blindVoiceState === 'armed'
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                        : 'bg-slate-950 text-amber-200 border-amber-400/70 font-semibold'
                      : blindVoiceState === 'armed'
                        ? 'bg-[#1D6CE0] text-white border-[#153B70] font-bold'
                        : 'bg-[#EEF5FC] dark:bg-slate-800 text-[#153B70] dark:text-sky-200 border-[#7AA7D9] dark:border-sky-600 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        blindVoiceState === 'armed'
                          ? isBlindStudent
                            ? 'bg-slate-950 animate-ping'
                            : 'bg-amber-300 animate-ping'
                          : blindVoiceState === 'listening'
                            ? 'bg-emerald-400 animate-pulse'
                            : 'bg-amber-400'
                      }`}
                    />
                    <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {blindVoiceState === 'armed'
                        ? 'Listening for Command...'
                        : blindVoiceState === 'needs-gesture'
                          ? 'Tap or Press Any Key'
                          : blindVoiceState === 'unsupported'
                            ? 'Voice Mic Unsupported'
                            : 'Always-On Mic Active'}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] leading-snug ${
                      isBlindStudent
                        ? blindVoiceState === 'armed'
                          ? 'text-slate-900'
                          : 'text-amber-100/90'
                        : blindVoiceState === 'armed'
                          ? 'text-blue-50'
                          : 'text-[#44566C] dark:text-slate-300'
                    }`}
                  >
                    {blindVoiceState === 'armed'
                      ? isOcdMode && !isBlindStudent
                        ? 'Speak camera command, destination, or question now.'
                        : 'Speak destination or question now.'
                      : blindVoiceState === 'needs-gesture'
                        ? 'Touch screen or press any key once to start hands-free listening.'
                        : isOcdMode && !isBlindStudent
                          ? 'Say "Hey AI start camera", "calibrate", or "open AI tutoring".'
                          : 'Say "Hey AI" or "Hi AI" anytime — no button needed.'}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onStartVoiceNav}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                >
                  <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Voice Assistant</span>
                </button>
              )}

              <button
                type="button"
                onClick={onReadPage}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] text-white text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer text-left"
              >
                <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Read Page</span>
              </button>
            </>
          )}
        </div>

        {/* Display & Language Controls */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#52657C] dark:text-slate-400">
            Display &amp; Language
          </p>

          <div>
            <label htmlFor="workspace-lang" className="sr-only">
              Select Language
            </label>
            <select
              id="workspace-lang"
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-[#153B70] dark:text-slate-100 cursor-pointer"
            >
              <option value="en">English</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>

          {/* Sliding Percentage Text Size Control */}
          <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="workspace-font-size"
                className="text-xs font-semibold text-[#153B70] dark:text-slate-100"
              >
                Text Size
              </label>
              <button
                type="button"
                onClick={() => onChangeFontSize(100)}
                title="Reset to 100%"
                className="font-mono text-xs font-bold text-[#1D6CE0] dark:text-sky-400 tabular-nums hover:underline cursor-pointer"
              >
                {fontSize}%
              </button>
            </div>
            <input
              id="workspace-font-size"
              type="range"
              min={75}
              max={150}
              step={5}
              value={fontSize}
              aria-label="Text size percentage"
              aria-valuetext={`${fontSize}%`}
              onChange={(e) => onChangeFontSize(Number(e.target.value))}
              className="w-full h-2 accent-[#1D6CE0] cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-[#52657C] dark:text-slate-400 tabular-nums">
              <span>75%</span>
              <span>100%</span>
              <span>150%</span>
            </div>
          </div>

          {/* Contrast Preset Selector */}
          <div>
            <label htmlFor="workspace-contrast" className="sr-only">
              Contrast preset
            </label>
            <select
              id="workspace-contrast"
              aria-label="Contrast preset"
              value={contrast}
              onChange={(e) => onChangeContrast(e.target.value as ContrastPreset)}
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-[#153B70] dark:text-slate-100 cursor-pointer"
            >
              {CONTRAST_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  Contrast: {preset.label}
                </option>
              ))}
            </select>
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-pressed={theme === 'dark'}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-[#153B70] shrink-0" aria-hidden="true" />
            )}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Install & Sign Out */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {!isOnline && (
          <div
            role="status"
            className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-semibold flex items-center gap-2"
          >
            <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Offline Cache Active</span>
          </div>
        )}
        <PWAInstallButton />
        <button
          type="button"
          onClick={() => {
            if (isNoHandsMode) {
              setConfirmSignOutOpen(true);
            } else {
              onSignOut();
            }
          }}
          className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#153B70] hover:bg-[#102E59] dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen flex text-[#16253B] dark:text-slate-100 ${
        isDeafStudent ? 'deaf-visual-canvas' : 'bg-[#F1F6FC] dark:bg-slate-950'
      }`}
    >
      {confirmSignOutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="nod-signout-heading"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#159B83] dark:border-emerald-500 p-6 shadow-2xl space-y-4">
            <h3
              id="nod-signout-heading"
              className="text-lg font-bold text-[#153B70] dark:text-slate-100"
            >
              Confirm Sign Out
            </h3>
            <p className="text-sm text-[#44566C] dark:text-slate-300 leading-relaxed">
              Are you sure you want to sign out of EduCare? <strong>Nod your head</strong> (down
              then up) to confirm <strong>Yes, Sign Out</strong>, or choose Cancel.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmSignOutOpen(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-200 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-nod-confirm="true"
                onClick={() => {
                  setConfirmSignOutOpen(false);
                  onSignOut();
                }}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white text-sm font-bold cursor-pointer"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Desktop Left Sidebar */}
      <aside
        aria-label="Workspace sidebar"
        className="hidden lg:flex lg:flex-col w-64 xl:w-72 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Left Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            aria-label="Mobile workspace sidebar"
            className="relative z-10 w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Right Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact Mobile Drawer Trigger (only visible below lg) */}
        <div className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 bg-[#153B70] dark:bg-slate-900 text-white border-b border-[#0E2B54] dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation and tools menu"
            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Menu className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Menu</span>
          </button>
          <span className="text-base font-bold tracking-tight">EduCare</span>
          <span className="text-xs text-blue-100 dark:text-slate-300 truncate max-w-[140px]">
            {user.name}
          </span>
        </div>

        {/* Voice Status Live Feedback (Always visible in Blind & OCD Hands-Free modes) */}
        {(showAlwaysOnVoice || voiceStatus) && (
          <div
            aria-live={showAlwaysOnVoice ? 'assertive' : 'polite'}
            role="status"
            className={
              showAlwaysOnVoice
                ? isBlindStudent
                  ? `px-4 sm:px-6 py-3 border-b-2 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold ${
                      blindVoiceState === 'armed'
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-950 text-amber-300 border-amber-400/70'
                    }`
                  : `px-4 sm:px-6 ${
                      isOcdMode ? 'sm:pr-[312px]' : ''
                    } py-3 border-b-2 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold ${
                      blindVoiceState === 'armed'
                        ? 'bg-[#1D6CE0] text-white border-[#153B70]'
                        : 'bg-[#EAF3FC] dark:bg-slate-900 text-[#153B70] dark:text-sky-200 border-[#7AA7D9] dark:border-sky-700'
                    }`
                : `bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 ${
                    isOcdMode ? 'sm:pr-[312px]' : ''
                  } py-2.5 text-xs font-medium text-[#153B70] dark:text-sky-300`
            }
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {showAlwaysOnVoice && (
                <span
                  aria-hidden="true"
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    blindVoiceState === 'armed'
                      ? isBlindStudent
                        ? 'bg-slate-950 animate-ping'
                        : 'bg-amber-300 animate-ping'
                      : blindVoiceState === 'listening'
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-amber-400'
                  }`}
                />
              )}
              <span className="truncate">
                {voiceStatus ||
                  (blindVoiceState === 'armed'
                    ? isOcdMode && !isBlindStudent
                      ? 'Hey AI is listening now — say "start camera", "calibrate", or where you want to go.'
                      : 'Hey AI is listening now — speak where you want to go or ask any question.'
                    : blindVoiceState === 'needs-gesture'
                      ? 'Tap anywhere or press any key once to activate always-on "Hey AI" / "Hi AI" microphone.'
                      : isOcdMode && !isBlindStudent
                        ? 'Always-On Voice Ready — say "Hey AI start camera", "Hey AI stop camera", "Hey AI calibrate", or "Hey AI open AI tutoring".'
                        : 'Always-On Voice Navigator Ready — say "Hey AI" or "Hi AI" followed by a command (e.g., "Hey AI open AI tutoring", "Hi AI open live classes").')}
              </span>
            </div>
            {showAlwaysOnVoice && blindLastHeard && (
              <span
                className={`text-xs font-mono shrink-0 ${
                  isBlindStudent
                    ? blindVoiceState === 'armed'
                      ? 'text-slate-900'
                      : 'text-slate-300'
                    : blindVoiceState === 'armed'
                      ? 'text-blue-50'
                      : 'text-[#44566C] dark:text-slate-300'
                }`}
              >
                Heard: &ldquo;{blindLastHeard}&rdquo;
              </span>
            )}
          </div>
        )}

        {/* Main Content */}
        <main
          id="educare-active-section"
          className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-7"
        >
          {children}
        </main>

        <footer className="py-6 text-center text-xs text-[#52657C] dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          EduCare © 2026 | Education for Everyone
        </footer>
      </div>
    </div>
  );
};
