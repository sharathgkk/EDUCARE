import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Moon,
  School,
  Sun,
  UserPlus,
  Volume2,
} from 'lucide-react';
import type {
  AccessibilityPref,
  ContrastPreset,
  DisabilityProfile,
  LanguageCode,
  ThemeMode,
  UserRole,
} from '../types';
import { CONTRAST_PRESETS, DISABILITY_SUPPORT_OPTIONS } from '../data/educareData';
import { speakAloud } from '../utils/speech';

type GateView = 'select' | 'login' | 'register';

export interface PendingGoogleAccount {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  preferredRole: UserRole;
}

interface FrontAuthGateProps {
  language: LanguageCode;
  fontSize: number;
  theme: ThemeMode;
  contrast: ContrastPreset;
  isSubmitting: boolean;
  authError: string;
  pendingGoogleAccount?: PendingGoogleAccount | null;
  onClearError: () => void;
  onChangeLanguage: (lang: LanguageCode) => void;
  onChangeFontSize: (size: number) => void;
  onToggleTheme: () => void;
  onChangeContrast: (preset: ContrastPreset) => void;
  onLogin: (payload: { email: string; password: string; role: UserRole }) => Promise<void>;
  onGoogleLogin: (
    role: UserRole,
    options?: {
      accessibilityPref?: AccessibilityPref;
      disabilityProfile?: DisabilityProfile;
      teachingProfiles?: DisabilityProfile[];
    }
  ) => Promise<void>;
  onCompleteGoogleRegistration?: (payload: {
    name: string;
    role: UserRole;
    accessibilityPref?: AccessibilityPref;
    disabilityProfile?: DisabilityProfile;
    teachingProfiles?: DisabilityProfile[];
    subjectSpecialty?: string;
  }) => Promise<void>;
  onCancelGoogleRegistration?: () => Promise<void>;
  onDemoLogin: (role: UserRole) => Promise<void>;
  onRegister: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    accessibilityPref?: AccessibilityPref;
    disabilityProfile?: DisabilityProfile;
    teachingProfiles?: DisabilityProfile[];
    subjectSpecialty?: string;
  }) => Promise<void>;
}

function GoogleMark() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.29v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.39l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4 3.1c.94-2.84 3.59-4.95 6.71-4.95z"
      />
    </svg>
  );
}

function AccessibilityWheelchairMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-8 h-8 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5.5" r="2" fill="currentColor" stroke="none" />
      <path d="M10.5 9.5h4.5l1.5 5.5h3" />
      <path d="M11 9.5l-1 4.5h5" />
      <path d="M13.8 17.5A4.8 4.8 0 1 1 8.5 12" />
    </svg>
  );
}

export const FrontAuthGate: React.FC<FrontAuthGateProps> = ({
  language,
  fontSize,
  theme,
  contrast,
  isSubmitting,
  authError,
  pendingGoogleAccount = null,
  onClearError,
  onChangeLanguage,
  onChangeFontSize,
  onToggleTheme,
  onChangeContrast,
  onLogin,
  onGoogleLogin,
  onCompleteGoogleRegistration,
  onCancelGoogleRegistration,
  onDemoLogin,
  onRegister,
}) => {
  const [view, setView] = useState<GateView>('select');
  const [loginRole, setLoginRole] = useState<UserRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  // Registration state
  const [regRole, setRegRole] = useState<UserRole>('student');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPref, setRegPref] = useState<AccessibilityPref>('standard');
  const [regDisability, setRegDisability] = useState<DisabilityProfile>('standard');
  const [regTeachingProfiles, setRegTeachingProfiles] = useState<DisabilityProfile[]>([
    'deaf',
    'blind',
  ]);
  const [regSubject, setRegSubject] = useState('');

  const toggleTeachingProfile = (id: DisabilityProfile) => {
    setRegTeachingProfiles((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const displayError = localError || authError;

  useEffect(() => {
    if (!pendingGoogleAccount) return;
    setView('register');
    setRegRole(pendingGoogleAccount.preferredRole);
    setRegName(pendingGoogleAccount.name);
    setRegEmail(pendingGoogleAccount.email);
    setRegPassword('');
    setLocalError('');
  }, [pendingGoogleAccount]);

  const openView = (nextView: GateView, role?: UserRole) => {
    setLocalError('');
    onClearError();
    setPassword('');
    setShowPassword(false);
    if (role) {
      setLoginRole(role);
      setRegRole(role);
    }
    setView(nextView);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    onClearError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError('Please enter both your email address and password.');
      return;
    }

    await onLogin({ email: trimmedEmail, password, role: loginRole });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    onClearError();

    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim();

    if (pendingGoogleAccount && onCompleteGoogleRegistration) {
      if (!cleanName) {
        setLocalError('Please enter your full name to continue.');
        return;
      }
      await onCompleteGoogleRegistration({
        name: cleanName,
        role: regRole,
        accessibilityPref: regRole === 'student' ? regPref : undefined,
        disabilityProfile: regRole === 'student' ? regDisability : undefined,
        teachingProfiles: regRole === 'teacher' ? regTeachingProfiles : undefined,
        subjectSpecialty:
          regRole === 'teacher' ? regSubject.trim() || 'Inclusive Education' : undefined,
      });
      return;
    }

    if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || regPassword.length < 6) {
      setLocalError(
        'Enter your full name, a valid email address, and a password of at least 6 characters.'
      );
      return;
    }

    await onRegister({
      name: cleanName,
      email: cleanEmail,
      password: regPassword,
      role: regRole,
      accessibilityPref: regRole === 'student' ? regPref : undefined,
      disabilityProfile: regRole === 'student' ? regDisability : undefined,
      teachingProfiles: regRole === 'teacher' ? regTeachingProfiles : undefined,
      subjectSpecialty:
        regRole === 'teacher' ? regSubject.trim() || 'Inclusive Education' : undefined,
    });
  };

  const handleReadWelcome = () => {
    speakAloud(
      'Welcome to EduCare, AI-Powered Inclusive Education. Learning Without Barriers. Please select Student Login, Teacher Login, or Create an Account.',
      language
    );
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0E3A75] via-[#144B92] to-[#0F3F7E] dark:from-[#070E1B] dark:via-[#0B162B] dark:to-[#091224] flex flex-col items-center justify-center px-4 py-8">
      <main
        aria-label="EduCare Portal Entry"
        className={`w-full ${
          view === 'register' ? 'max-w-[540px]' : 'max-w-[460px]'
        } bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-white/15 dark:border-slate-800 px-7 py-8 sm:px-10 sm:py-10 text-center transition-all`}
      >
        {/* Top Icon + Brand */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-b from-[#4CA8FF] to-[#1C74E9] shadow-sm flex items-center justify-center mb-4">
            <AccessibilityWheelchairMark />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#153B70] dark:text-slate-100">
            EduCare
          </h1>
          <p className="mt-1.5 text-lg font-semibold text-[#1E66BE] dark:text-sky-400">
            AI-Powered Inclusive Education
          </p>
          <p className="mt-1 text-sm text-[#52657C] dark:text-slate-400">
            Learning Without Barriers
          </p>
        </div>

        <hr className="my-6 border-slate-200 dark:border-slate-800" />

        {view === 'select' && (
          <div>
            <h2 className="text-base font-semibold text-[#16253B] dark:text-slate-100 mb-5">
              Select Your Login Type
            </h2>

            {displayError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200 text-left"
              >
                {displayError}
              </div>
            )}

            <div className="space-y-3.5">
              <button
                type="button"
                onClick={() => openView('login', 'student')}
                className="w-full min-h-[52px] px-5 py-3.5 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white font-semibold text-base flex items-center justify-center gap-2.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <GraduationCap className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Student Login</span>
              </button>

              <button
                type="button"
                onClick={() => openView('login', 'teacher')}
                className="w-full min-h-[52px] px-5 py-3.5 rounded-xl bg-[#DF922C] hover:bg-[#C67F21] text-white font-semibold text-base flex items-center justify-center gap-2.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <School className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Teacher Login</span>
              </button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wider">
                  <span className="bg-white dark:bg-slate-900 px-3 text-[#52657C] dark:text-slate-400 font-medium">
                    or
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void onGoogleLogin('student')}
                className="w-full min-h-[52px] px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#16253B] dark:text-slate-100 font-semibold text-base flex items-center justify-center gap-3 shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <GoogleMark />
                <span>{isSubmitting ? 'Connecting to Google...' : 'Login with Google'}</span>
              </button>
            </div>

            <hr className="my-6 border-slate-200 dark:border-slate-800" />

            <p className="text-sm text-[#52657C] dark:text-slate-400 mb-3.5">
              New to EduCare? Join our inclusive community
            </p>

            <button
              type="button"
              onClick={() => openView('register')}
              className="w-full min-h-[50px] px-5 py-3 rounded-xl border-2 border-[#1D6CE0] dark:border-sky-500 text-[#1D6CE0] dark:text-sky-400 hover:bg-[#F0F6FF] dark:hover:bg-slate-800 font-semibold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>Create an Account / Register</span>
            </button>
          </div>
        )}

        {view === 'login' && (
          <div className="text-left">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => openView('select')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E66BE] dark:text-sky-400 hover:text-[#153B70] dark:hover:text-sky-300 cursor-pointer py-1"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back</span>
              </button>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#52657C] dark:text-slate-400">
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Secure Sign In</span>
              </span>
            </div>

            {/* Student / Teacher Login Mode Toggle */}
            <div
              role="tablist"
              aria-label="Login mode"
              className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={loginRole === 'student'}
                onClick={() => {
                  setLoginRole('student');
                  setLocalError('');
                  onClearError();
                }}
                className={`min-h-[42px] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  loginRole === 'student'
                    ? 'bg-[#159B83] text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Student</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={loginRole === 'teacher'}
                onClick={() => {
                  setLoginRole('teacher');
                  setLocalError('');
                  onClearError();
                }}
                className={`min-h-[42px] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  loginRole === 'teacher'
                    ? 'bg-[#DF922C] text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <School className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Teacher</span>
              </button>
            </div>

            <h2 className="text-xl font-bold text-[#153B70] dark:text-slate-100 mb-1">
              {loginRole === 'student' ? 'Student Login' : 'Teacher Login'}
            </h2>
            <p className="text-sm text-[#52657C] dark:text-slate-400 mb-5">
              {loginRole === 'student'
                ? 'Sign in to access online classes, study notes, AI tutor, and accessible exams.'
                : 'Sign in to manage study materials, live classroom links, assignments, and progress.'}
            </p>

            {displayError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200"
              >
                {displayError}
              </div>
            )}

            <form onSubmit={(e) => void handleLoginSubmit(e)} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    loginRole === 'student' ? 'student@educare.org' : 'teacher@educare.org'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1E66BE] dark:focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full min-h-[44px] px-3.5 py-2.5 pr-11 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1E66BE] dark:focus:border-sky-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full min-h-[48px] px-5 py-3 rounded-xl text-white font-semibold text-base transition-colors cursor-pointer disabled:opacity-60 ${
                  loginRole === 'student'
                    ? 'bg-[#159B83] hover:bg-[#11836E]'
                    : 'bg-[#DF922C] hover:bg-[#C67F21]'
                }`}
              >
                {isSubmitting
                  ? 'Signing In...'
                  : loginRole === 'student'
                    ? 'Sign In as Student'
                    : 'Sign In as Teacher'}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void onGoogleLogin(loginRole)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#16253B] dark:text-slate-100 text-sm font-semibold flex items-center justify-center gap-2.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                <GoogleMark />
                <span>
                  {isSubmitting
                    ? 'Connecting to Google...'
                    : `Continue with Google (${loginRole === 'student' ? 'Student' : 'Teacher'})`}
                </span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void onDemoLogin(loginRole)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-100 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                {loginRole === 'student'
                  ? 'Continue with Demo Student (Aarav Sharma)'
                  : 'Continue with Demo Teacher (Prof. Meera Nair)'}
              </button>

              <div className="flex items-center justify-end text-xs text-[#52657C] dark:text-slate-400 pt-1">
                <button
                  type="button"
                  onClick={() => openView('register', loginRole)}
                  className="text-[#1E66BE] dark:text-sky-400 hover:underline font-medium cursor-pointer"
                >
                  Need an account? Register
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'register' && (
          <div className="text-left">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  if (pendingGoogleAccount && onCancelGoogleRegistration) {
                    void onCancelGoogleRegistration();
                  }
                  openView('select');
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E66BE] dark:text-sky-400 hover:text-[#153B70] dark:hover:text-sky-300 cursor-pointer py-1"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>{pendingGoogleAccount ? 'Cancel Google Setup' : 'Back'}</span>
              </button>
              <span className="text-xs font-semibold text-[#52657C] dark:text-slate-400">
                {pendingGoogleAccount ? 'First-Time Google Setup' : 'New Account'}
              </span>
            </div>

            {pendingGoogleAccount && (
              <div className="mb-4 p-3 rounded-xl bg-[#E8F7F4] dark:bg-emerald-950/50 border border-[#159B83]/40 text-xs text-[#153B70] dark:text-emerald-200 flex items-center gap-2.5">
                <GoogleMark />
                <span>
                  Welcome! Your Gmail (<strong>{pendingGoogleAccount.email}</strong>) is verified.
                  Choose your Learning Superpower below to complete setup.
                </span>
              </div>
            )}

            <h2 className="text-xl font-bold text-[#153B70] dark:text-slate-100 mb-1">
              {pendingGoogleAccount ? 'Choose Your Learning Superpower' : 'Create Your Account'}
            </h2>
            <p className="text-sm text-[#52657C] dark:text-slate-400 mb-4">
              {pendingGoogleAccount
                ? 'Your name and Gmail are filled in below — pick Student or Teacher and select your superpower.'
                : 'Join EduCare as a student or educator.'}
            </p>

            {/* Role Toggle */}
            <div
              role="tablist"
              aria-label="Account role"
              className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4"
            >
              <button
                type="button"
                role="tab"
                aria-selected={regRole === 'student'}
                onClick={() => setRegRole('student')}
                className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  regRole === 'student'
                    ? 'bg-[#159B83] text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Student
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={regRole === 'teacher'}
                onClick={() => setRegRole('teacher')}
                className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  regRole === 'teacher'
                    ? 'bg-[#DF922C] text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Teacher
              </button>
            </div>

            {displayError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200"
              >
                {displayError}
              </div>
            )}

            <form onSubmit={(e) => void handleRegisterSubmit(e)} className="space-y-3.5">
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1E66BE] dark:focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                >
                  {pendingGoogleAccount ? 'Gmail Address (Verified with Google)' : 'Email Address'}
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  readOnly={Boolean(pendingGoogleAccount)}
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => {
                    if (!pendingGoogleAccount) {
                      setRegEmail(e.target.value);
                    }
                  }}
                  placeholder="name@example.com"
                  className={`w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#1E66BE] dark:focus:border-sky-400 focus:outline-none ${
                    pendingGoogleAccount
                      ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed opacity-90'
                      : 'bg-white dark:bg-slate-800'
                  }`}
                />
              </div>

              {!pendingGoogleAccount && (
                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full min-h-[44px] px-3.5 py-2 pr-11 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1E66BE] dark:focus:border-sky-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {regRole === 'student' ? (
                <div className="space-y-3.5">
                  <div>
                    <span
                      id="reg-superpower-label"
                      className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                    >
                      Pick Your Learning Superpower
                    </span>
                    <p className="text-xs text-[#52657C] dark:text-slate-400 mb-2">
                      Choose what fits you best so EduCare can tailor your experience — no serious
                      forms allowed!
                    </p>
                    <div
                      role="radiogroup"
                      aria-labelledby="reg-superpower-label"
                      className="space-y-2 max-h-60 overflow-y-auto pr-1"
                    >
                      {DISABILITY_SUPPORT_OPTIONS.map((option) => {
                        const selected = regDisability === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => {
                              setRegDisability(option.id);
                              setRegPref(option.recommendedPref);
                            }}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              selected
                                ? 'border-[#159B83] bg-[#E8F7F4] dark:bg-emerald-950/60 dark:border-emerald-400'
                                : 'border-slate-200 dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span className="text-sm font-bold text-[#153B70] dark:text-slate-100">
                                {option.funnyTitle}
                              </span>
                              <span className="text-[11px] font-semibold text-[#52657C] dark:text-slate-400">
                                {option.clearLabel}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#44566C] dark:text-slate-300 leading-snug">
                              {option.tagline}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-pref"
                      className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                    >
                      Display &amp; Navigation Mode
                    </label>
                    <select
                      id="reg-pref"
                      value={regPref}
                      onChange={(e) => setRegPref(e.target.value as AccessibilityPref)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#1E66BE] dark:focus:border-sky-400 focus:outline-none"
                    >
                      <option value="standard">Standard Display</option>
                      <option value="large-text">Large Text Mode (120%)</option>
                      <option value="voice-nav">Voice-First Navigation</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div>
                    <span
                      id="reg-teacher-superpowers-label"
                      className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                    >
                      Which Learning Superpowers Can You Teach?
                    </span>
                    <p className="text-xs text-[#52657C] dark:text-slate-400 mb-2">
                      Select all squads you love teaching — EduCare will unlock custom teaching
                      controls &amp; stats for each one!
                    </p>
                    <div
                      role="group"
                      aria-labelledby="reg-teacher-superpowers-label"
                      className="space-y-2 max-h-60 overflow-y-auto pr-1"
                    >
                      {DISABILITY_SUPPORT_OPTIONS.map((option) => {
                        const selected = regTeachingProfiles.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleTeachingProfile(option.id)}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              selected
                                ? 'border-[#DF922C] bg-amber-50 dark:bg-amber-950/40 dark:border-amber-400'
                                : 'border-slate-200 dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-bold text-[#153B70] dark:text-slate-100">
                                  {option.funnyTitle}
                                </span>
                                <span className="text-[11px] font-semibold text-[#52657C] dark:text-slate-400">
                                  · {option.clearLabel}
                                </span>
                              </div>
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                                  selected
                                    ? 'bg-[#DF922C] border-[#DF922C] text-white'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                                }`}
                                aria-hidden="true"
                              >
                                {selected && <Check className="w-3.5 h-3.5" />}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#44566C] dark:text-slate-300 leading-snug">
                              {option.tagline}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-subject"
                      className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                    >
                      Subject Specialty
                    </label>
                    <input
                      id="reg-subject"
                      type="text"
                      value={regSubject}
                      onChange={(e) => setRegSubject(e.target.value)}
                      placeholder="e.g. Computer Science, Mathematics"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1E66BE] dark:focus:border-sky-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#1D6CE0] hover:bg-[#1557B8] text-white font-semibold text-base transition-colors cursor-pointer disabled:opacity-60"
              >
                {pendingGoogleAccount
                  ? isSubmitting
                    ? 'Saving Superpower...'
                    : 'Save Superpower & Enter EduCare'
                  : isSubmitting
                    ? 'Creating Account...'
                    : 'Create Account & Enter EduCare'}
              </button>
            </form>

            {!pendingGoogleAccount && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    void onGoogleLogin(
                      regRole,
                      regRole === 'student'
                        ? { disabilityProfile: regDisability, accessibilityPref: regPref }
                        : { teachingProfiles: regTeachingProfiles }
                    )
                  }
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#16253B] dark:text-slate-100 text-sm font-semibold flex items-center justify-center gap-2.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  <GoogleMark />
                  <span>
                    {isSubmitting
                      ? 'Connecting to Google...'
                      : `Sign Up with Google (${regRole === 'student' ? 'Student' : 'Teacher'})`}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        <p className="mt-7 text-xs text-[#52657C] dark:text-slate-400">
          EduCare © 2026 | Education for Everyone
        </p>
      </main>

      {/* Pre-Login Accessibility & Theme Strip */}
      <div className="prelogin-strip mt-5 flex flex-wrap items-center justify-center gap-3 text-white/90 text-xs">
        <label htmlFor="prelogin-lang" className="sr-only">
          Select Language
        </label>
        <select
          id="prelogin-lang"
          value={language}
          onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-medium focus:outline-none cursor-pointer"
        >
          <option value="en" className="text-slate-900">
            English
          </option>
          <option value="kn" className="text-slate-900">
            ಕನ್ನಡ (Kannada)
          </option>
          <option value="hi" className="text-slate-900">
            हिन्दी (Hindi)
          </option>
        </select>

        <button
          type="button"
          onClick={handleReadWelcome}
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Read Screen</span>
        </button>

        <div
          role="group"
          aria-label="Text size percentage"
          className="inline-flex items-center gap-2 min-h-[38px] px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white"
        >
          <label htmlFor="prelogin-font-size" className="text-xs font-medium whitespace-nowrap">
            Size
          </label>
          <input
            id="prelogin-font-size"
            type="range"
            min={75}
            max={150}
            step={5}
            value={fontSize}
            aria-valuetext={`${fontSize}%`}
            onChange={(e) => onChangeFontSize(Number(e.target.value))}
            className="w-24 accent-sky-300 cursor-pointer"
          />
          <span className="text-xs font-mono font-semibold tabular-nums min-w-[38px] text-right">
            {fontSize}%
          </span>
        </div>

        <label htmlFor="prelogin-contrast" className="sr-only">
          Contrast mode
        </label>
        <select
          id="prelogin-contrast"
          aria-label="Contrast mode"
          value={contrast}
          onChange={(e) => onChangeContrast(e.target.value as ContrastPreset)}
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-medium focus:outline-none cursor-pointer"
        >
          {CONTRAST_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id} className="text-slate-900">
              Contrast: {preset.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-pressed={theme === 'dark'}
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Moon className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </div>
  );
};
