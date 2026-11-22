/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import type {
  AccessibilityPref,
  Assignment,
  ContrastPreset,
  DisabilityProfile,
  ExamQuestion,
  ExamResultRecord,
  LanguageCode,
  LiveClassSession,
  LoginLogRecord,
  MatchedTeacher,
  SectionId,
  StudentDoubt,
  StudentStatusRecord,
  StudyMaterial,
  ThemeMode,
  UserAccount,
  UserRole,
} from './types';
import {
  auth,
  checkGoogleUserExistsInFirestore,
  createStudyNoteInFirestore,
  deleteStudyNoteFromFirestore,
  deleteUserLoginDataInFirestore,
  fetchUserLoginInfoFromFirestore,
  recordGoogleLoginInFirestore,
  recordLogoutInFirestore,
  signInWithGooglePopup,
  signOutFromFirebase,
  subscribeToStudyNotes,
  updateUserPreferencesInFirestore,
} from './firebase';
import {
  EXAM_QUESTIONS,
  INITIAL_ASSIGNMENTS,
  INITIAL_MATERIALS,
  RECORDED_LESSONS,
} from './data/educareData';
import { FrontAuthGate, type PendingGoogleAccount } from './components/FrontAuthGate';
import { WorkspaceShell } from './components/WorkspaceShell';
import { HomeSection } from './components/sections/HomeSection';
import { ClassesSection } from './components/sections/ClassesSection';
import { MaterialsSection } from './components/sections/MaterialsSection';
import { TutorSection } from './components/sections/TutorSection';
import { AccessibilitySection } from './components/sections/AccessibilitySection';
import { SignLanguageSection } from './components/sections/SignLanguageSection';
import { ExamSection } from './components/sections/ExamSection';
import { TeacherSection } from './components/sections/TeacherSection';
import { OcdHandNavigator, type OcdHandVoiceAction } from './components/OcdHandNavigator';
import { NoHandsFaceNavigator } from './components/NoHandsFaceNavigator';
import { OfflineIndicator } from './components/OfflineIndicator';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  clearOfflineSessionCache,
  readOfflineUser,
  readOfflineWorkspaceSnapshot,
  saveOfflineUser,
  saveOfflineWorkspaceSnapshot,
  warmEssentialLearningCaches,
} from './utils/offlineCache';
import {
  getSpeechLang,
  getSpeechRecognitionCtor,
  isSpeakingAloud,
  speakAloud,
  stopSpeaking,
} from './utils/speech';
import { cancelHaptic, triggerHaptic, type HapticCue } from './utils/haptics';
import {
  buildPlayableClassCatalog,
  matchUploadedClass,
  matchUploadedMaterial,
} from './utils/voiceMatching';
import { useBlindWakeWord } from './hooks/useBlindWakeWord';
import {
  bootstrapNexconnSession,
  disconnectNexconnSession,
} from './services/nexconnClient';
import { apiFetch } from './services/api';

const STORAGE_KEYS = {
  materials: 'educare_materials_v1',
  assignments: 'educare_assignments_v1',
  classLink: 'educare_live_link_v1',
  fontSize: 'educare_font_size_v1',
  theme: 'educare_theme_v1',
  contrast: 'educare_contrast_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function authFetchJson<T>(
  url: string,
  init: RequestInit = {},
  maxRetries = 2
): Promise<{ ok: boolean; status: number; data: T | null; networkError: string | null }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      status: 0,
      data: null,
      networkError: 'You appear to be offline. Please check your internet connection and try again.',
    };
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await apiFetch(url, {
        ...init,
        credentials: 'include',
        cache: 'no-store',
      });

      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxRetries) {
        await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
        continue;
      }

      const raw = await res.text();
      let parsed: T | null = null;
      if (raw.trim()) {
        try {
          parsed = JSON.parse(raw) as T;
        } catch {
          parsed = null;
        }
      }

      return {
        ok: res.ok,
        status: res.status,
        data: parsed,
        networkError: null,
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
      }
    }
  }

  const msg =
    lastError instanceof Error && lastError.message
      ? `Unable to reach EduCare server (${lastError.message}). Please try again.`
      : 'Unable to reach EduCare server. Please check your connection and try again.';
  return { ok: false, status: 0, data: null, networkError: msg };
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [pendingGoogleUser, setPendingGoogleUser] = useState<PendingGoogleAccount | null>(null);
  const pendingFirebaseUserRef = useRef<FirebaseUser | null>(null);
  const [loginLogs, setLoginLogs] = useState<LoginLogRecord[]>([]);
  const activeLogIdRef = useRef<string | null>(null);
  const googleLoginInProgressRef = useRef<boolean>(false);
  const studyNotesUnsubRef = useRef<(() => void) | null>(null);

  const initialOfflineSnapshot = useMemo(() => readOfflineWorkspaceSnapshot(), []);
  const isOnline = useOnlineStatus();
  const prevOnlineRef = useRef<boolean>(isOnline);

  const [firestoreNotes, setFirestoreNotes] = useState<StudyMaterial[]>(
    () => initialOfflineSnapshot?.firestoreNotes ?? []
  );
  const [serverNotes, setServerNotes] = useState<StudyMaterial[]>(
    () => initialOfflineSnapshot?.serverNotes ?? []
  );
  const materials = useMemo<StudyMaterial[]>(() => {
    const merged = new Map<string, StudyMaterial>();
    for (const note of firestoreNotes) {
      merged.set(note.id, note);
    }
    for (const note of serverNotes) {
      if (!merged.has(note.id)) {
        merged.set(note.id, note);
      }
    }
    const seedNotes: StudyMaterial[] = INITIAL_MATERIALS.map((m) => ({
      ...m,
      source: 'seed',
    }));
    return [...Array.from(merged.values()), ...seedNotes];
  }, [firestoreNotes, serverNotes]);

  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    readStorage<Assignment[]>(STORAGE_KEYS.assignments, INITIAL_ASSIGNMENTS)
  );
  const [publishedClassLink, setPublishedClassLink] = useState<string>(() =>
    readStorage<string>(STORAGE_KEYS.classLink, 'https://meet.jit.si/educare-inclusive-cs-room')
  );
  const [liveClasses, setLiveClasses] = useState<LiveClassSession[]>(
    () => initialOfflineSnapshot?.liveClasses ?? []
  );

  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>(
    () =>
      initialOfflineSnapshot?.examQuestions && initialOfflineSnapshot.examQuestions.length > 0
        ? initialOfflineSnapshot.examQuestions
        : EXAM_QUESTIONS
  );
  const [examResults, setExamResults] = useState<ExamResultRecord[]>(
    () => initialOfflineSnapshot?.examResults ?? []
  );
  const [studentStatuses, setStudentStatuses] = useState<StudentStatusRecord[]>([]);
  const [studentDoubts, setStudentDoubts] = useState<StudentDoubt[]>([]);
  const [teachersDirectory, setTeachersDirectory] = useState<MatchedTeacher[]>(
    () => initialOfflineSnapshot?.teachersDirectory ?? []
  );
  const [examTabIntent, setExamTabIntent] = useState<'exam' | 'results' | 'prepare' | undefined>(
    undefined
  );

  const activeStudentProfile: DisabilityProfile = currentUser?.disabilityProfile ?? 'standard';
  const isDeafStudent = currentUser?.role === 'student' && activeStudentProfile === 'deaf';
  const isBlindStudent = currentUser?.role === 'student' && activeStudentProfile === 'blind';
  const isOcdMode = activeStudentProfile === 'ocd';
  const isNoHandsMode = activeStudentProfile === 'no-hands';
  const hasAlwaysOnVoice = isBlindStudent || isOcdMode;
  const [ocdHandVoiceCmd, setOcdHandVoiceCmd] = useState<{
    id: number;
    action: OcdHandVoiceAction;
  } | null>(null);
  const [voiceTutorPrompt, setVoiceTutorPrompt] = useState<{ id: number; text: string } | null>(
    null
  );
  const [voiceSelectedClass, setVoiceSelectedClass] = useState<{
    id: number;
    kind: 'live' | 'recorded';
    classId: string;
  } | null>(null);
  const [voiceSelectedMaterial, setVoiceSelectedMaterial] = useState<{
    id: number;
    materialId: string;
  } | null>(null);
  const blindDialogueModeRef = useRef<'idle' | 'select-class' | 'select-material' | 'jarvis-tutor'>(
    'idle'
  );
  const armForReplyRef = useRef<(durationMs?: number, echoCooldownMs?: number) => void>(() => {});
  const disarmReplyRef = useRef<() => void>(() => {});
  const setEchoGuardRef = useRef<(durationMs?: number) => void>(() => {});
  const spokenVoiceModeRef = useRef<'none' | 'blind' | 'ocd'>('none');
  const prevBlindSectionKeyRef = useRef<string | null>(null);
  const recentNavHapticAtRef = useRef<number>(0);

  const matchedTeachers = useMemo<MatchedTeacher[]>(() => {
    if (!currentUser || currentUser.role !== 'student') return teachersDirectory;
    return teachersDirectory.filter((t) => t.teachingProfiles.includes(activeStudentProfile));
  }, [currentUser, teachersDirectory, activeStudentProfile]);

  const studentVisibleMaterials = useMemo<StudyMaterial[]>(() => {
    if (!currentUser || currentUser.role !== 'student') return materials;
    return materials.filter((note) => {
      if (note.targetProfiles && note.targetProfiles.length > 0) {
        return note.targetProfiles.includes(activeStudentProfile);
      }
      // Fallback for legacy untagged notes: match by teacher's teachingProfiles if available
      if (note.teacherUid) {
        const author = teachersDirectory.find((t) => t.id === note.teacherUid);
        if (author) {
          return author.teachingProfiles.includes(activeStudentProfile);
        }
      }
      return activeStudentProfile === 'standard';
    });
  }, [currentUser, materials, teachersDirectory, activeStudentProfile]);

  const [activeSection, setActiveSection] = useState<SectionId>('home');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = readStorage<number>(STORAGE_KEYS.fontSize, 100);
    if (typeof saved !== 'number' || !Number.isFinite(saved)) return 100;
    // Migrate legacy pixel values (12..24) to percentage (75..150)
    const normalized = saved <= 30 ? Math.round((saved / 16) * 100) : saved;
    return Math.min(150, Math.max(75, normalized));
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = readStorage<ThemeMode | null>(STORAGE_KEYS.theme, null);
    if (saved === 'dark' || saved === 'light') return saved;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  });
  const [contrast, setContrast] = useState<ContrastPreset>(() => {
    const saved = readStorage<ContrastPreset | null>(STORAGE_KEYS.contrast, null);
    if (
      saved === 'default' ||
      saved === 'soft-blue' ||
      saved === 'high-contrast-dark' ||
      saved === 'yellow-on-black' ||
      saved === 'dyslexia-pastel'
    ) {
      return saved;
    }
    return 'default';
  });
  const [voiceStatus, setVoiceStatus] = useState<string>('');

  const fetchUserWorkspaceData = useCallback(async (role: UserRole) => {
    try {
      const [qRes, rRes, cRes, mRes, tRes, dRes] = await Promise.all([
        apiFetch('/api/exam/questions'),
        apiFetch('/api/exam/results'),
        apiFetch('/api/classes/live'),
        apiFetch('/api/materials'),
        apiFetch('/api/teachers'),
        apiFetch('/api/doubts'),
      ]);

      const snapshotUpdates: {
        examQuestions?: ExamQuestion[];
        examResults?: ExamResultRecord[];
        liveClasses?: LiveClassSession[];
        serverNotes?: StudyMaterial[];
        teachersDirectory?: MatchedTeacher[];
      } = {};

      if (qRes.ok) {
        const qData = (await qRes.json()) as { questions?: ExamQuestion[] };
        if (qData.questions) {
          setExamQuestions(qData.questions);
          snapshotUpdates.examQuestions = qData.questions;
        }
      }

      if (rRes.ok) {
        const rData = (await rRes.json()) as { results?: ExamResultRecord[] };
        if (rData.results) {
          setExamResults(rData.results);
          snapshotUpdates.examResults = rData.results;
        }
      }

      if (cRes.ok) {
        const cData = (await cRes.json()) as { classes?: LiveClassSession[] };
        if (cData.classes) {
          setLiveClasses(cData.classes);
          snapshotUpdates.liveClasses = cData.classes;
          if (cData.classes[0]?.meetingUrl) {
            setPublishedClassLink(cData.classes[0].meetingUrl);
          }
        }
      }

      if (mRes.ok) {
        const mData = (await mRes.json()) as { materials?: StudyMaterial[] };
        if (mData.materials) {
          setServerNotes(mData.materials);
          snapshotUpdates.serverNotes = mData.materials;
        }
      }

      if (tRes.ok) {
        const tData = (await tRes.json()) as { teachers?: MatchedTeacher[] };
        if (tData.teachers) {
          setTeachersDirectory(tData.teachers);
          snapshotUpdates.teachersDirectory = tData.teachers;
        }
      }

      if (Object.keys(snapshotUpdates).length > 0) {
        saveOfflineWorkspaceSnapshot(snapshotUpdates);
        void warmEssentialLearningCaches();
      }

      if (dRes.ok) {
        const dData = (await dRes.json()) as { doubts?: StudentDoubt[] };
        if (dData.doubts) {
          setStudentDoubts(dData.doubts);
        }
      }

      if (role === 'teacher') {
        const sRes = await apiFetch('/api/teacher/students');
        if (sRes.ok) {
          const sData = (await sRes.json()) as { students?: StudentStatusRecord[] };
          if (sData.students) setStudentStatuses(sData.students);
        }
      }
    } catch {
      // Keep existing/cached offline state on unstable network error
    }
  }, []);

  // Real-time Firestore listener for Teacher-published Study Notes only while Firebase Auth is active
  useEffect(() => {
    if (studyNotesUnsubRef.current) {
      studyNotesUnsubRef.current();
      studyNotesUnsubRef.current = null;
    }

    if (!firebaseUid || !auth.currentUser || auth.currentUser.uid !== firebaseUid) {
      if (navigator.onLine) {
        setFirestoreNotes([]);
      }
      return;
    }

    const unsubscribe = subscribeToStudyNotes((notes) => {
      setFirestoreNotes(notes);
      saveOfflineWorkspaceSnapshot({ firestoreNotes: notes });
    });
    studyNotesUnsubRef.current = unsubscribe;

    return () => {
      unsubscribe();
      if (studyNotesUnsubRef.current === unsubscribe) {
        studyNotesUnsubRef.current = null;
      }
    };
  }, [firebaseUid]);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;

      setFirebaseUid(firebaseUser ? firebaseUser.uid : null);

      if (googleLoginInProgressRef.current) {
        return;
      }

      if (firebaseUser) {
        try {
          const { profile, logs } = await fetchUserLoginInfoFromFirestore(firebaseUser.uid);
          if (!active) return;

          if (!profile) {
            // First-time Google user who hasn't picked a Learning Superpower yet:
            // keep them on FrontAuthGate's Register view with name & Gmail pre-filled.
            pendingFirebaseUserRef.current = firebaseUser;
            setPendingGoogleUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || undefined,
              preferredRole: 'student',
            });
            setFirebaseUid(null);
            return;
          }

          pendingFirebaseUserRef.current = null;
          setPendingGoogleUser(null);

          // Sync Express session cookie for exams, live classes, and teacher endpoints
          await authFetchJson('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: profile.id,
              name: profile.name,
              email: profile.email,
              role: profile.role,
              accessibilityPref: profile.accessibilityPref,
              disabilityProfile: profile.disabilityProfile,
              teachingProfiles: profile.teachingProfiles,
            }),
          }, 1);

          if (!active) return;
          setLoginLogs(logs);
          setCurrentUser(profile);
          saveOfflineUser(profile);
          if (profile.accessibilityPref === 'large-text') {
            setFontSize((prev) => (prev < 120 ? 120 : prev));
          }
          setActiveSection(profile.role === 'teacher' ? 'teacher' : 'home');
          void fetchUserWorkspaceData(profile.role);
          void bootstrapNexconnSession(profile);
        } catch {
          const cachedUser = readOfflineUser();
          if (active && cachedUser && !navigator.onLine) {
            setCurrentUser(cachedUser);
            setActiveSection(cachedUser.role === 'teacher' ? 'teacher' : 'home');
            void fetchUserWorkspaceData(cachedUser.role);
          }
        } finally {
          if (active) setAuthChecking(false);
        }
        return;
      }

      // No Firebase user: check Express session cookie (or offline cached session if network is down)
      try {
        const result = await authFetchJson<{ user?: UserAccount | null }>('/api/auth/session', {}, 1);
        if (!result.ok || !result.data) {
          const cachedUser = readOfflineUser();
          if (active && cachedUser && !navigator.onLine) {
            setCurrentUser(cachedUser);
            setActiveSection(cachedUser.role === 'teacher' ? 'teacher' : 'home');
          }
          return;
        }
        const data = result.data;
        if (active && data.user) {
          setCurrentUser(data.user);
          saveOfflineUser(data.user);
          if (data.user.accessibilityPref === 'large-text') {
            setFontSize((prev) => (prev < 120 ? 120 : prev));
          }
          setActiveSection(data.user.role === 'teacher' ? 'teacher' : 'home');
          void fetchUserWorkspaceData(data.user.role);
          void bootstrapNexconnSession(data.user);
        } else if (active && data.user === null) {
          saveOfflineUser(null);
        }
      } catch {
        const cachedUser = readOfflineUser();
        if (active && cachedUser) {
          setCurrentUser(cachedUser);
          if (cachedUser.accessibilityPref === 'large-text') {
            setFontSize((prev) => (prev < 120 ? 120 : prev));
          }
          setActiveSection(cachedUser.role === 'teacher' ? 'teacher' : 'home');
          void fetchUserWorkspaceData(cachedUser.role);
        }
      } finally {
        if (active) setAuthChecking(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [fetchUserWorkspaceData]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.classLink, JSON.stringify(publishedClassLink));
  }, [publishedClassLink]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.fontSize, JSON.stringify(fontSize));
    document.documentElement.style.removeProperty('font-size');
    document.documentElement.style.setProperty('--ec-font-scale', String(fontSize / 100));
  }, [fontSize]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.contrast, JSON.stringify(contrast));
    document.documentElement.setAttribute('data-contrast', contrast);
    document.documentElement.classList.toggle(
      'high-contrast',
      contrast === 'high-contrast-dark' || contrast === 'yellow-on-black'
    );
  }, [contrast]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(theme));
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      if (
        (next === 'light' &&
          (contrast === 'high-contrast-dark' || contrast === 'yellow-on-black')) ||
        (next === 'dark' && (contrast === 'soft-blue' || contrast === 'dyslexia-pastel'))
      ) {
        setContrast('default');
      }
      return next;
    });
  };

  const handleChangeContrast = (preset: ContrastPreset) => {
    setContrast(preset);
    if (preset === 'high-contrast-dark' || preset === 'yellow-on-black') {
      setTheme('dark');
    } else if (preset === 'soft-blue' || preset === 'dyslexia-pastel') {
      setTheme('light');
    }
  };

  const fireBlindHaptic = useCallback(
    (cue: HapticCue) => {
      if (!isBlindStudent) return;
      if (cue === 'navigate') {
        recentNavHapticAtRef.current = Date.now();
      }
      triggerHaptic(cue, true);
    },
    [isBlindStudent]
  );

  const setDialogueMode = useCallback(
    (mode: 'idle' | 'select-class' | 'select-material' | 'jarvis-tutor') => {
      blindDialogueModeRef.current = mode;
      if (mode === 'idle') {
        disarmReplyRef.current();
      }
    },
    []
  );

  const navigateTo = useCallback(
    (section: SectionId): boolean => {
      if (section === 'teacher' && currentUser?.role !== 'teacher') {
        const deniedMsg = 'Access denied. Teacher Dashboard requires a Teacher login.';
        setVoiceStatus(deniedMsg);
        fireBlindHaptic('error');
        if (hasAlwaysOnVoice) {
          speakAloud(deniedMsg, language);
        }
        return false;
      }

      const sectionChanged = activeSection !== section;
      if (section !== 'exam') {
        setExamTabIntent(undefined);
      }
      if (section !== 'tutor' && blindDialogueModeRef.current === 'jarvis-tutor') {
        setDialogueMode('idle');
      }
      if (section !== 'classes' && blindDialogueModeRef.current === 'select-class') {
        setDialogueMode('idle');
      }
      if (section !== 'materials' && blindDialogueModeRef.current === 'select-material') {
        setDialogueMode('idle');
      }

      setActiveSection(section);
      fireBlindHaptic(sectionChanged ? 'navigate' : 'success');

      if (currentUser) {
        void fetchUserWorkspaceData(currentUser.role);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    },
    [
      activeSection,
      currentUser,
      fetchUserWorkspaceData,
      fireBlindHaptic,
      hasAlwaysOnVoice,
      language,
      setDialogueMode,
    ]
  );

  const openStudentResults = useCallback(() => {
    const sectionChanged = activeSection !== 'exam' || examTabIntent !== 'results';
    setDialogueMode('idle');
    setExamTabIntent('results');
    setActiveSection('exam');
    fireBlindHaptic(sectionChanged ? 'navigate' : 'success');
    if (currentUser) {
      void fetchUserWorkspaceData(currentUser.role);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [
    activeSection,
    currentUser,
    examTabIntent,
    fetchUserWorkspaceData,
    fireBlindHaptic,
    setDialogueMode,
  ]);

  const openTeacherExamTab = (tab: 'results' | 'prepare') => {
    setExamTabIntent(tab);
    setActiveSection('exam');
    if (currentUser) {
      void fetchUserWorkspaceData(currentUser.role);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyAuthenticatedUser = (user: UserAccount) => {
    setCurrentUser(user);
    saveOfflineUser(user);
    setAuthError('');
    setVoiceStatus('');
    setExamTabIntent(undefined);
    if (user.accessibilityPref === 'large-text' || user.disabilityProfile === 'blind') {
      setFontSize((prev) => (prev < 120 ? 120 : prev));
    }
    if (user.disabilityProfile === 'ocd') {
      setContrast((prev) => (prev === 'default' ? 'soft-blue' : prev));
    }
    setActiveSection(user.role === 'teacher' ? 'teacher' : 'home');
    void fetchUserWorkspaceData(user.role);
    void bootstrapNexconnSession(user);
  };

  const handleLogin = async (payload: {
    email: string;
    password: string;
    role: UserRole;
  }) => {
    setAuthSubmitting(true);
    setAuthError('');
    try {
      const result = await authFetchJson<{ user?: UserAccount; error?: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (result.networkError) {
        setAuthError(result.networkError);
        return;
      }
      if (!result.ok || !result.data?.user) {
        setAuthError(
          result.data?.error ||
            (result.status >= 500
              ? 'Server error while signing in. Please try again.'
              : 'Unable to sign in. Please verify your credentials.')
        );
        return;
      }
      applyAuthenticatedUser(result.data.user);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleDemoLogin = async (role: UserRole) => {
    setAuthSubmitting(true);
    setAuthError('');
    try {
      const result = await authFetchJson<{ user?: UserAccount; error?: string }>(
        '/api/auth/demo',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        }
      );
      if (result.networkError) {
        setAuthError(result.networkError);
        return;
      }
      if (!result.ok || !result.data?.user) {
        setAuthError(result.data?.error || 'Unable to start demo session right now.');
        return;
      }
      applyAuthenticatedUser(result.data.user);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRegister = async (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    accessibilityPref?: AccessibilityPref;
    disabilityProfile?: DisabilityProfile;
    teachingProfiles?: DisabilityProfile[];
    subjectSpecialty?: string;
  }) => {
    setAuthSubmitting(true);
    setAuthError('');
    try {
      const result = await authFetchJson<{ user?: UserAccount; error?: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (result.networkError) {
        setAuthError(result.networkError);
        return;
      }
      if (!result.ok || !result.data?.user) {
        setAuthError(
          result.data?.error ||
            (result.status >= 500
              ? 'Server error while creating account. Please try again.'
              : 'Unable to create account.')
        );
        return;
      }
      applyAuthenticatedUser(result.data.user);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleLogin = async (
    role: UserRole,
    options?: {
      accessibilityPref?: AccessibilityPref;
      disabilityProfile?: DisabilityProfile;
      teachingProfiles?: DisabilityProfile[];
    }
  ) => {
    setAuthSubmitting(true);
    setAuthError('');
    googleLoginInProgressRef.current = true;
    try {
      const firebaseUser = await signInWithGooglePopup();
      const hasExplicitSuperpower = Boolean(
        options?.disabilityProfile ||
          (options?.teachingProfiles && options.teachingProfiles.length > 0)
      );

      if (!hasExplicitSuperpower) {
        let userExists = false;
        try {
          userExists = await checkGoogleUserExistsInFirestore(firebaseUser.uid);
        } catch (checkErr) {
          console.warn('Firestore user existence check failed:', checkErr);
          userExists = false;
        }

        if (!userExists) {
          pendingFirebaseUserRef.current = firebaseUser;
          setPendingGoogleUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || undefined,
            preferredRole: role,
          });
          setFirebaseUid(null);
          return;
        }
      }

      let savedUser: UserAccount = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'EduCare User',
        email: firebaseUser.email || '',
        role,
        accessibilityPref: options?.accessibilityPref ?? 'standard',
        disabilityProfile: options?.disabilityProfile,
        teachingProfiles: options?.teachingProfiles,
        photoURL: firebaseUser.photoURL || undefined,
        authProvider: 'google',
        loginCount: 1,
        isLoggedIn: true,
        lastLoginAt: new Date().toISOString(),
      };

      try {
        const recorded = await recordGoogleLoginInFirestore(firebaseUser, role, options);
        savedUser = recorded.user;
        activeLogIdRef.current = recorded.logId;
      } catch (firestoreErr) {
        console.warn('Firestore Google login sync deferred:', firestoreErr);
      }

      // Sync Express session cookie for exams, live classes, chat, and teacher endpoints
      await authFetchJson(
        '/api/auth/google',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: savedUser.id,
            name: savedUser.name,
            email: savedUser.email,
            role: savedUser.role,
            accessibilityPref: savedUser.accessibilityPref,
            disabilityProfile: savedUser.disabilityProfile,
            teachingProfiles: savedUser.teachingProfiles,
          }),
        },
        1
      );

      try {
        const { logs } = await fetchUserLoginInfoFromFirestore(firebaseUser.uid);
        setLoginLogs(logs);
      } catch {
        setLoginLogs([]);
      }

      pendingFirebaseUserRef.current = null;
      setPendingGoogleUser(null);
      setFirebaseUid(firebaseUser.uid);
      applyAuthenticatedUser(savedUser);
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Google sign-in was cancelled. Click Login with Google to try again.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked by your browser. Please allow popups and try again.');
      } else if (code === 'auth/network-request-failed') {
        setAuthError(
          'Network error reaching Google Sign-In. Please check your connection or use Email / Demo login.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          'Google Sign-In is unavailable on this domain. Please use Email/Password or Demo Student/Teacher login.'
        );
      } else {
        setAuthError('Unable to complete Google sign-in right now. Please try Email or Demo login.');
      }
    } finally {
      googleLoginInProgressRef.current = false;
      setAuthSubmitting(false);
    }
  };

  const handleCompleteGoogleRegistration = async (payload: {
    name: string;
    role: UserRole;
    accessibilityPref?: AccessibilityPref;
    disabilityProfile?: DisabilityProfile;
    teachingProfiles?: DisabilityProfile[];
    subjectSpecialty?: string;
  }) => {
    const firebaseUser = pendingFirebaseUserRef.current || auth.currentUser;
    if (!firebaseUser) {
      setPendingGoogleUser(null);
      setAuthError('Google sign-in session expired. Please click Login with Google again.');
      return;
    }

    setAuthSubmitting(true);
    setAuthError('');
    googleLoginInProgressRef.current = true;
    try {
      let savedUser: UserAccount = {
        id: firebaseUser.uid,
        name:
          payload.name.trim() ||
          firebaseUser.displayName ||
          firebaseUser.email?.split('@')[0] ||
          'EduCare User',
        email: firebaseUser.email || '',
        role: payload.role,
        accessibilityPref: payload.accessibilityPref ?? 'standard',
        disabilityProfile: payload.disabilityProfile,
        teachingProfiles: payload.teachingProfiles,
        subjectSpecialty: payload.subjectSpecialty,
        photoURL: firebaseUser.photoURL || undefined,
        authProvider: 'google',
        loginCount: 1,
        isLoggedIn: true,
        lastLoginAt: new Date().toISOString(),
      };

      try {
        const recorded = await recordGoogleLoginInFirestore(firebaseUser, payload.role, {
          name: payload.name,
          accessibilityPref: payload.accessibilityPref,
          disabilityProfile: payload.disabilityProfile,
          teachingProfiles: payload.teachingProfiles,
        });
        savedUser = {
          ...recorded.user,
          subjectSpecialty: payload.subjectSpecialty ?? recorded.user.subjectSpecialty,
        };
        activeLogIdRef.current = recorded.logId;
      } catch (firestoreErr) {
        console.warn('Firestore Google registration sync deferred:', firestoreErr);
      }

      const syncResult = await authFetchJson<{ user?: UserAccount }>(
        '/api/auth/google',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: savedUser.id,
            name: savedUser.name,
            email: savedUser.email,
            role: savedUser.role,
            accessibilityPref: savedUser.accessibilityPref,
            disabilityProfile: savedUser.disabilityProfile,
            teachingProfiles: savedUser.teachingProfiles,
            subjectSpecialty: payload.subjectSpecialty,
          }),
        },
        1
      );

      if (syncResult.ok && syncResult.data?.user?.subjectSpecialty && !savedUser.subjectSpecialty) {
        savedUser = {
          ...savedUser,
          subjectSpecialty: syncResult.data.user.subjectSpecialty,
        };
      }

      try {
        const { logs } = await fetchUserLoginInfoFromFirestore(firebaseUser.uid);
        setLoginLogs(logs);
      } catch {
        setLoginLogs([]);
      }

      pendingFirebaseUserRef.current = null;
      setPendingGoogleUser(null);
      setFirebaseUid(firebaseUser.uid);
      applyAuthenticatedUser(savedUser);
    } finally {
      googleLoginInProgressRef.current = false;
      setAuthSubmitting(false);
    }
  };

  const handleCancelGoogleRegistration = async () => {
    pendingFirebaseUserRef.current = null;
    setPendingGoogleUser(null);
    setAuthError('');
    setFirebaseUid(null);
    try {
      await signOutFromFirebase();
    } catch {
      // Continue cleanly even if Firebase sign-out fails
    }
  };

  const handleSignOut = async () => {
    stopSpeaking();
    cancelHaptic();
    setDialogueMode('idle');
    setVoiceTutorPrompt(null);
    setVoiceSelectedClass(null);
    setVoiceSelectedMaterial(null);
    setOcdHandVoiceCmd(null);
    spokenVoiceModeRef.current = 'none';
    prevBlindSectionKeyRef.current = null;
    // Unsubscribe real-time Firestore listeners BEFORE signing out to avoid permission-denied race
    if (studyNotesUnsubRef.current) {
      studyNotesUnsubRef.current();
      studyNotesUnsubRef.current = null;
    }
    setFirebaseUid(null);
    setFirestoreNotes([]);

    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        await recordLogoutInFirestore(uid, activeLogIdRef.current);
      } catch {
        // Continue sign-out even if logging fails
      }
      try {
        await signOutFromFirebase();
      } catch {
        // Continue sign-out
      }
    }
    try {
      await disconnectNexconnSession();
    } catch {
      // Ignore Nexconn disconnect errors
    }
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local state regardless
    }
    pendingFirebaseUserRef.current = null;
    setPendingGoogleUser(null);
    activeLogIdRef.current = null;
    setLoginLogs([]);
    setServerNotes([]);
    saveOfflineWorkspaceSnapshot({
      serverNotes: [],
      firestoreNotes: [],
      liveClasses: [],
      examResults: [],
    });
    void clearOfflineSessionCache();
    setCurrentUser(null);
    setExamResults([]);
    setStudentStatuses([]);
    setVoiceStatus('');
  };

  const handleClearSavedLoginInfo = async () => {
    stopSpeaking();
    cancelHaptic();
    setDialogueMode('idle');
    setVoiceTutorPrompt(null);
    setVoiceSelectedClass(null);
    setVoiceSelectedMaterial(null);
    setOcdHandVoiceCmd(null);
    spokenVoiceModeRef.current = 'none';
    prevBlindSectionKeyRef.current = null;
    if (studyNotesUnsubRef.current) {
      studyNotesUnsubRef.current();
      studyNotesUnsubRef.current = null;
    }

    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        await deleteUserLoginDataInFirestore(uid);
      } catch (err) {
        console.warn('Firestore login data cleanup warning:', err);
      }
      try {
        await signOutFromFirebase();
      } catch {
        // Continue cleanup
      }
    }

    try {
      await disconnectNexconnSession();
    } catch {
      // Ignore Nexconn disconnect errors
    }
    try {
      await apiFetch('/api/auth/login-info', { method: 'DELETE' });
    } catch {
      // Clear local state regardless
    }

    setFirebaseUid(null);
    setFirestoreNotes([]);
    pendingFirebaseUserRef.current = null;
    setPendingGoogleUser(null);
    activeLogIdRef.current = null;
    setLoginLogs([]);
    setServerNotes([]);
    saveOfflineWorkspaceSnapshot({
      serverNotes: [],
      firestoreNotes: [],
      liveClasses: [],
      examResults: [],
    });
    void clearOfflineSessionCache();
    setCurrentUser(null);
    setExamResults([]);
    setStudentStatuses([]);
    setVoiceStatus('');
  };

  const handleUpdateUserPreferences = async (updates: {
    disabilityProfile?: DisabilityProfile;
    teachingProfiles?: DisabilityProfile[];
  }) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...updates } : prev));

    if (updates.disabilityProfile === 'blind') {
      setFontSize((prev) => (prev < 120 ? 120 : prev));
    } else if (updates.disabilityProfile === 'ocd') {
      handleChangeContrast('soft-blue');
    }

    if (auth.currentUser) {
      updateUserPreferencesInFirestore(auth.currentUser.uid, updates).catch(() => {});
    }

    apiFetch('/api/auth/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    }).catch(() => {});
  };

  const handleAddMaterial = async (input: {
    title: string;
    subject: string;
    readTime: string;
    content: string;
    fileName?: string;
    targetProfiles?: DisabilityProfile[];
  }) => {
    if (!currentUser || currentUser.role !== 'teacher') {
      throw new Error('Only teachers can publish study notes.');
    }

    const resolvedTargets: DisabilityProfile[] =
      input.targetProfiles && input.targetProfiles.length > 0
        ? input.targetProfiles
        : currentUser.teachingProfiles && currentUser.teachingProfiles.length > 0
          ? currentUser.teachingProfiles
          : ['standard'];

    let createdId: string | undefined;

    if (auth.currentUser) {
      const created = await createStudyNoteInFirestore({
        ...input,
        targetProfiles: resolvedTargets,
        uploadedBy: currentUser.name,
        teacherUid: auth.currentUser.uid,
      });
      createdId = created.id;
    }

    // Also persist on server so demo/local students can read the same notes
    const res = await apiFetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        id: createdId,
        ...input,
        targetProfiles: resolvedTargets,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { materials?: StudyMaterial[] };
      if (data.materials) setServerNotes(data.materials);
    } else if (!createdId) {
      throw new Error('Failed to save study note.');
    }
  };

  const handleDeleteMaterial = async (material: StudyMaterial) => {
    if (!currentUser || currentUser.role !== 'teacher') {
      throw new Error('Only teachers can delete study notes.');
    }

    if (material.source === 'firestore' && auth.currentUser) {
      await deleteStudyNoteFromFirestore(material.id);
    }

    const res = await apiFetch(`/api/materials/${encodeURIComponent(material.id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (res.ok) {
      const data = (await res.json()) as { materials?: StudyMaterial[] };
      if (data.materials) setServerNotes(data.materials);
    } else if (material.source !== 'firestore') {
      throw new Error('Failed to delete study note.');
    }
  };

  useEffect(() => {
    if (isDeafStudent) {
      stopSpeaking();
      setVoiceStatus('');
    }
  }, [isDeafStudent]);

  useEffect(() => {
    if (prevOnlineRef.current === isOnline) return;
    prevOnlineRef.current = isOnline;

    if (!isOnline) {
      const offlineMsg =
        'Offline mode active. Cached study materials and class information remain available.';
      setVoiceStatus(offlineMsg);
      if (hasAlwaysOnVoice && !isDeafStudent) {
        setEchoGuardRef.current(6000);
        speakAloud(offlineMsg, language, 1, () => {
          setEchoGuardRef.current(350);
        });
      }
    } else {
      const onlineMsg = 'Internet connection restored. Syncing latest study materials and classes.';
      setVoiceStatus(onlineMsg);
      if (currentUser) {
        void fetchUserWorkspaceData(currentUser.role);
      } else {
        void warmEssentialLearningCaches();
      }
      if (hasAlwaysOnVoice && !isDeafStudent) {
        setEchoGuardRef.current(5500);
        speakAloud('Internet connection restored.', language, 1, () => {
          setEchoGuardRef.current(350);
        });
      }
    }
  }, [currentUser, fetchUserWorkspaceData, hasAlwaysOnVoice, isDeafStudent, isOnline, language]);

  useEffect(() => {
    if (!hasAlwaysOnVoice) {
      spokenVoiceModeRef.current = 'none';
      prevBlindSectionKeyRef.current = null;
      return;
    }

    const sectionKey = `${activeSection}:${examTabIntent ?? ''}`;
    if (prevBlindSectionKeyRef.current === null) {
      prevBlindSectionKeyRef.current = sectionKey;
    } else if (prevBlindSectionKeyRef.current !== sectionKey) {
      prevBlindSectionKeyRef.current = sectionKey;
      if (isBlindStudent && Date.now() - recentNavHapticAtRef.current > 250) {
        triggerHaptic('navigate', true);
        recentNavHapticAtRef.current = Date.now();
      }
    }

    const currentMode: 'blind' | 'ocd' = isBlindStudent ? 'blind' : 'ocd';
    if (spokenVoiceModeRef.current !== currentMode) {
      spokenVoiceModeRef.current = currentMode;
      if (currentMode === 'blind') {
        setVoiceStatus(
          'Master of Shadows active — Always-on mic listening. Say "Hey AI" or "Hi AI" anytime.'
        );
        speakAloud(
          'Master of Shadows mode active. Your microphone is always on. Say the wake phrase followed by open AI tutoring, open live classes, study notes, exam, results, or read page.',
          language
        );
      } else {
        setVoiceStatus(
          'High-Energy Fingers active — Always-on "Hey AI" mic & Hand Navigator ready. Say "Calibration Wizard", "Start Camera", "Stop Camera", or "Hey AI open AI tutoring".'
        );
        setEchoGuardRef.current(12000);
        speakAloud(
          'High-Energy Fingers mode active. Always-on Hey AI voice control and webcam hand navigation are ready. Say calibration wizard, start camera, stop camera, or Hey AI open AI tutoring anytime.',
          language,
          1,
          () => {
            setEchoGuardRef.current(1800);
          }
        );
      }
    }
  }, [hasAlwaysOnVoice, isBlindStudent, activeSection, examTabIntent, language]);

  const handleHandNavigatorVoiceFeedback = useCallback(
    (spokenMessage: string, options?: { interrupt?: boolean }) => {
      setVoiceStatus(spokenMessage);
      if (!hasAlwaysOnVoice) return;
      if (!options?.interrupt && isSpeakingAloud()) return;
      setEchoGuardRef.current(9500);
      speakAloud(spokenMessage, language, 1, () => {
        setEchoGuardRef.current(350);
      });
    },
    [hasAlwaysOnVoice, language]
  );

  const handleReadPage = useCallback(
    (prefixText?: string) => {
      if (isDeafStudent) return;
      const el = document.getElementById('educare-active-section');
      const domText = el?.innerText?.replace(/\s+/g, ' ').trim();
      const combined = [prefixText, domText].filter(Boolean).join('. ').trim();
      if (!combined) return;
      const truncated = combined.length > 1600 ? `${combined.slice(0, 1600)}.` : combined;
      const ok = speakAloud(truncated, language);
      if (!ok) {
        fireBlindHaptic('error');
        setVoiceStatus('Text-to-Speech is not supported in this browser.');
      } else {
        setVoiceStatus('Reading active section aloud.');
      }
    },
    [fireBlindHaptic, isDeafStudent, language]
  );

  const speakAndArmDialogue = useCallback(
    (
      spokenText: string,
      expectedMode: 'select-class' | 'select-material' | 'jarvis-tutor',
      armDurationMs = 28000
    ) => {
      setDialogueMode(expectedMode);
      setEchoGuardRef.current(60000);
      speakAloud(spokenText, language, 1, () => {
        if (!hasAlwaysOnVoice || blindDialogueModeRef.current !== expectedMode) {
          setEchoGuardRef.current(350);
          return;
        }
        fireBlindHaptic('wake');
        armForReplyRef.current(armDurationMs, 450);
      });
    },
    [fireBlindHaptic, hasAlwaysOnVoice, language, setDialogueMode]
  );

  const playMatchedClassOrPromptRetry = useCallback(
    (spokenQuery: string) => {
      const { matched, cleanedLabel, allTitles } = matchUploadedClass(
        spokenQuery,
        liveClasses,
        RECORDED_LESSONS
      );

      if (!matched) {
        fireBlindHaptic('error');
        const uploadedListText =
          allTitles.length > 0
            ? allTitles.join(', ')
            : 'no classes have been uploaded yet';
        const missingMsg =
          allTitles.length > 0
            ? `The ${cleanedLabel || 'requested'} class is not yet uploaded. The uploaded classes are: ${uploadedListText}. Please say which uploaded class you want to hear.`
            : 'No classes have been uploaded yet.';
        setVoiceStatus(missingMsg);
        if (allTitles.length > 0) {
          speakAndArmDialogue(missingMsg, 'select-class', 28000);
        } else {
          setDialogueMode('idle');
          speakAloud(missingMsg, language);
        }
        return;
      }

      setVoiceSelectedClass({
        id: Date.now(),
        kind: matched.kind,
        classId: matched.id,
      });
      fireBlindHaptic('success');
      setVoiceStatus(`Playing class: "${matched.title}".`);
      setDialogueMode('select-class');
      setEchoGuardRef.current(120000);

      speakAloud(
        `Playing ${matched.title}. ${matched.spokenBody} Finished reading ${matched.title}. Say another class name if you want to hear it, or say stop.`,
        language,
        1,
        () => {
          if (!hasAlwaysOnVoice || blindDialogueModeRef.current !== 'select-class') {
            setEchoGuardRef.current(350);
            return;
          }
          fireBlindHaptic('wake');
          armForReplyRef.current(22000, 450);
        }
      );
    },
    [fireBlindHaptic, hasAlwaysOnVoice, language, liveClasses, setDialogueMode, speakAndArmDialogue]
  );

  const playMatchedMaterialOrPromptRetry = useCallback(
    (spokenQuery: string) => {
      const { matched, cleanedLabel, allTitles } = matchUploadedMaterial(
        spokenQuery,
        studentVisibleMaterials
      );

      if (!matched) {
        fireBlindHaptic('error');
        const uploadedListText =
          allTitles.length > 0
            ? allTitles.join(', ')
            : 'no study materials have been uploaded yet';
        const missingMsg =
          allTitles.length > 0
            ? `The ${cleanedLabel || 'requested'} material is not yet uploaded. The uploaded materials are: ${uploadedListText}. Please say which uploaded material you want to hear.`
            : 'No study materials have been uploaded for your profile yet.';
        setVoiceStatus(missingMsg);
        if (allTitles.length > 0) {
          speakAndArmDialogue(missingMsg, 'select-material', 28000);
        } else {
          setDialogueMode('idle');
          speakAloud(missingMsg, language);
        }
        return;
      }

      setVoiceSelectedMaterial({
        id: Date.now(),
        materialId: matched.id,
      });
      fireBlindHaptic('success');
      setVoiceStatus(`Reading study material: "${matched.title}".`);
      setDialogueMode('select-material');
      setEchoGuardRef.current(120000);

      speakAloud(
        `Reading study material: ${matched.title}, subject ${matched.subject}. ${matched.content}. Finished reading ${matched.title}. Say another material name or say stop.`,
        language,
        1,
        () => {
          if (!hasAlwaysOnVoice || blindDialogueModeRef.current !== 'select-material') {
            setEchoGuardRef.current(350);
            return;
          }
          fireBlindHaptic('wake');
          armForReplyRef.current(22000, 450);
        }
      );
    },
    [
      fireBlindHaptic,
      hasAlwaysOnVoice,
      language,
      setDialogueMode,
      speakAndArmDialogue,
      studentVisibleMaterials,
    ]
  );

  const handleTutorAudioStart = useCallback(() => {
    if (!hasAlwaysOnVoice) return;
    setEchoGuardRef.current(90000);
  }, [hasAlwaysOnVoice]);

  const handleTutorAudioEnd = useCallback(() => {
    if (!hasAlwaysOnVoice) return;
    if (blindDialogueModeRef.current === 'jarvis-tutor') {
      window.setTimeout(() => {
        if (blindDialogueModeRef.current === 'jarvis-tutor') {
          fireBlindHaptic('wake');
          setVoiceStatus('Jarvis AI Tutor listening — speak your answer or next question.');
          armForReplyRef.current(35000, 400);
        }
      }, 400);
    } else {
      setEchoGuardRef.current(350);
    }
  }, [fireBlindHaptic, hasAlwaysOnVoice]);

  const handleBlindWakeOnly = useCallback(
    (setEchoGuard: (durationMs?: number) => void) => {
      fireBlindHaptic('wake');
      const wakePrompt = isOcdMode
        ? "I'm listening. Say start camera, stop camera, calibrate, or where you would like to go."
        : "I'm listening. Where would you like to go or how can I help?";
      setVoiceStatus(
        isOcdMode
          ? 'Hey AI listening now — say "start camera", "stop camera", "calibrate", "open AI tutoring", or "open classes".'
          : 'Hey AI listening now — say a destination (e.g. "open AI tutoring", "open classes", "open materials") or ask a question.'
      );
      setEchoGuard(4200);
      speakAloud(wakePrompt, language, 1, () => {
        setEchoGuard(350);
      });
    },
    [fireBlindHaptic, isOcdMode, language]
  );

  const handleBlindVoiceCommand = useCallback(
    (rawCommand: string) => {
      if (!hasAlwaysOnVoice) return;
      const cleaned = rawCommand.trim();
      const cmd = cleaned.toLowerCase().replace(/\s+/g, ' ');
      if (!cmd) return;

      // 0. OCD Hand Navigator & Calibration Wizard Voice Controls (evaluated first so "stop camera" / "cancel wizard" are never swallowed)
      if (isOcdMode) {
        if (/\b(reset|clear|default)\b.*\b(calibration|calibrate|reach zone|wizard)\b/.test(cmd)) {
          setOcdHandVoiceCmd({ id: Date.now(), action: 'reset-calibration' });
          setVoiceStatus(`Voice command: "${cleaned}" -> Resetting hand calibration.`);
          return;
        }
        if (/\b(cancel|stop|exit|abort|close)\b.*\b(calibration|calibrate|wizard)\b/.test(cmd)) {
          setOcdHandVoiceCmd({ id: Date.now(), action: 'cancel-calibration' });
          setVoiceStatus(`Voice command: "${cleaned}" -> Cancelling calibration wizard.`);
          return;
        }
        if (
          /\b(repeat|replay)\b.*\b(instruction|step|cue|calibration|wizard)\b/.test(cmd) ||
          /^(?:please\s+)?(?:repeat|repeat step|repeat instruction|repeat cue|say again)$/.test(cmd)
        ) {
          setOcdHandVoiceCmd({ id: Date.now(), action: 'repeat-calibration-cue' });
          setVoiceStatus(`Voice command: "${cleaned}" -> Repeating calibration audio cue.`);
          return;
        }
        if (
          /\b(skip|next)\b.*\b(calibration|wizard|step)\b/.test(cmd) ||
          /^(?:please\s+)?(?:skip step|next step)$/.test(cmd)
        ) {
          setOcdHandVoiceCmd({ id: Date.now(), action: 'skip-calibration-step' });
          setVoiceStatus(`Voice command: "${cleaned}" -> Advancing calibration wizard step.`);
          return;
        }
        if (/\b(calibrate|calibration|recalibrate|calibration wizard|hand wizard|wizard)\b/.test(cmd)) {
          setOcdHandVoiceCmd({ id: Date.now(), action: 'calibrate' });
          setVoiceStatus(`Voice command: "${cleaned}" -> Starting hand-tracking calibration wizard.`);
          return;
        }
        if (
          /\b(start|open|turn on|switch on|enable|launch|activate)\b.*\b(camera|webcam|hand navigation|hand tracking|hand pointer)\b/.test(
            cmd
          ) ||
          /\bcamera on\b/.test(cmd)
        ) {
          setOcdHandVoiceCmd({ id: Date.now(), action: 'start-camera' });
          setVoiceStatus(`Voice command: "${cleaned}" -> Starting hand navigation camera.`);
          return;
        }
        if (
          /\b(stop|close|turn off|switch off|disable|end|deactivate)\b.*\b(camera|webcam|hand navigation|hand tracking|hand pointer)\b/.test(
            cmd
          ) ||
          /\bcamera off\b/.test(cmd)
        ) {
          setOcdHandVoiceCmd({ id: Date.now(), action: 'stop-camera' });
          setVoiceStatus(`Voice command: "${cleaned}" -> Stopping hand navigation camera.`);
          return;
        }
        if (
          /\b(minimize|hide|collapse)\b.*\b(camera|hand navigator|hand navigation|dock|preview)\b/.test(
            cmd
          )
        ) {
          setOcdHandVoiceCmd({ id: Date.now(), action: 'minimize' });
          setVoiceStatus(`Voice command: "${cleaned}" -> Minimizing hand preview.`);
          return;
        }
        if (
          /\b(expand|show|restore|unhide)\b.*\b(camera|hand navigator|hand navigation|dock|preview)\b/.test(
            cmd
          )
        ) {
          setOcdHandVoiceCmd({ id: Date.now(), action: 'expand' });
          setVoiceStatus(`Voice command: "${cleaned}" -> Expanding hand preview.`);
          return;
        }
      }

      // 1. Stop speaking / exit active audio dialogue
      if (
        /^(?:please\s+)?(?:stop|stop speaking|stop reading|stop audio|stop listening|exit tutor|quit tutor|goodbye jarvis|goodbye|quiet|silence|mute|cancel)\b/.test(
          cmd
        ) ||
        /\b(stop reading|stop speaking|stop audio|stop listening|exit tutor)\b/.test(cmd)
      ) {
        stopSpeaking();
        setDialogueMode('idle');
        fireBlindHaptic('stop');
        setVoiceStatus('Audio stopped. Say "Hey AI" or "Hi AI" anytime.');
        return;
      }

      // 2. Read current screen aloud
      if (
        /\b(read (?:this |the )?(?:page|screen|section)|read aloud|read it|describe (?:this |the )?(?:page|screen)|what is on (?:this |the )?(?:page|screen))\b/.test(
          cmd
        )
      ) {
        fireBlindHaptic('success');
        setVoiceStatus(`Voice command: "${cleaned}" -> Reading active page aloud.`);
        handleReadPage();
        return;
      }

      // 3. Where am I?
      if (/\b(where am i|current page|which section|which page)\b/.test(cmd)) {
        fireBlindHaptic('success');
        const labels: Record<SectionId, string> = {
          home: 'Home Dashboard',
          classes: 'Live and Recorded Classes',
          materials: 'Study Notes and Materials',
          tutor: 'AI Personal Learning Tutor',
          access: 'Accessibility Centre',
          sign: 'Sign Language Studio',
          exam: 'Examination and Results',
          teacher: 'Teacher Dashboard',
        };
        const msg = `You are currently on ${labels[activeSection]}.`;
        setVoiceStatus(msg);
        speakAloud(msg, language);
        return;
      }

      // 4. General help
      if (/^(?:please\s+)?(?:help|help me|what can i say|commands|voice commands)\b/.test(cmd)) {
        fireBlindHaptic('success');
        const helpMsg = isOcdMode
          ? 'You can say start camera, stop camera, calibrate, reset calibration, open AI tutoring for Jarvis audio tutoring, open classes, open materials, open exam, check my results, or read this page.'
          : 'You can say open AI tutoring for Jarvis audio tutoring, open classes to choose and hear a class, open materials to hear study notes, open exam, check my results, open accessibility, or read this page.';
        setVoiceStatus(`Voice Help: ${helpMsg}`);
        speakAloud(helpMsg, language);
        return;
      }

      // 5. Sign out
      if (/\b(sign out|log out|logout)\b/.test(cmd)) {
        setDialogueMode('idle');
        fireBlindHaptic('stop');
        setVoiceStatus('Signing out of EduCare...');
        speakAloud('Signing out of EduCare.', language, 1, () => {
          void handleSignOut();
        });
        return;
      }

      // 6. Display & contrast adjustments (can run from anywhere without leaving current flow)
      if (/\b(bigger|larger|increase|zoom in)\b/.test(cmd)) {
        fireBlindHaptic('success');
        const nextSize = Math.min(150, fontSize + 15);
        setFontSize(nextSize);
        setVoiceStatus(`Text size increased to ${nextSize}%.`);
        speakAloud(`Text size increased to ${nextSize} percent.`, language);
        return;
      }

      if (/\b(smaller|decrease|zoom out)\b/.test(cmd)) {
        fireBlindHaptic('success');
        const nextSize = Math.max(75, fontSize - 15);
        setFontSize(nextSize);
        setVoiceStatus(`Text size decreased to ${nextSize}%.`);
        speakAloud(`Text size set to ${nextSize} percent.`, language);
        return;
      }

      if (cmd.includes('yellow')) {
        fireBlindHaptic('success');
        handleChangeContrast('yellow-on-black');
        setVoiceStatus('Switched contrast to Yellow on Black.');
        speakAloud('Switched to Yellow on Black high contrast.', language);
        return;
      }

      if (cmd.includes('high contrast')) {
        fireBlindHaptic('success');
        handleChangeContrast('high-contrast-dark');
        setVoiceStatus('Switched contrast to High Contrast Dark.');
        speakAloud('Switched to High Contrast Dark.', language);
        return;
      }

      if (cmd.includes('dark mode') || cmd === 'dark') {
        fireBlindHaptic('success');
        setTheme('dark');
        setVoiceStatus('Switched to Dark Mode.');
        speakAloud('Switched to Dark Mode.', language);
        return;
      }

      if (cmd.includes('light mode') || cmd === 'light') {
        fireBlindHaptic('success');
        setTheme('light');
        setContrast('default');
        setVoiceStatus('Switched to Light Mode.');
        speakAloud('Switched to Light Mode.', language);
        return;
      }

      // 7. Navigation destinations (always allowed so user is never trapped in any dialogue mode)
      if (/\b(teacher dashboard|teacher portal|teacher section|open teacher)\b/.test(cmd)) {
        navigateTo('teacher');
        return;
      }

      const isPureOpenTutorCmd =
        /^(?:please\s+)?(?:open|start|launch|go to|enter|show)?\s*(?:the\s+)?(?:jarvis\s+)?(?:ai\s+)?tutor(?:ing)?(?:\s+mode|\s+section|\s+please)?$/i.test(
          cmd
        );

      if (isPureOpenTutorCmd) {
        navigateTo('tutor');
        setVoiceTutorPrompt(null);
        const jarvisGreeting =
          'Opened AI Tutoring in Jarvis audio-to-audio mode. I am listening now. What topic would you like to learn, or would you like me to ask you a practice question on Java, Python, or Mathematics?';
        setVoiceStatus('Jarvis AI Tutor active — audio-to-audio dialogue started.');
        speakAndArmDialogue(jarvisGreeting, 'jarvis-tutor', 35000);
        return;
      }

      // Classes navigation or named class launch (e.g. "open classes", "open live classes", "open python class")
      if (
        /\b(open|start|show|go to|list|play|hear|select)\b.*\b(class|classes|live class|live classes|online class|online classes|classroom|recorded|lesson|lessons)\b/.test(
          cmd
        ) ||
        /^(?:live\s+|online\s+|recorded\s+)?(classes|lessons)$/i.test(cmd)
      ) {
        navigateTo('classes');
        const catalog = buildPlayableClassCatalog(liveClasses, RECORDED_LESSONS);
        const classTitles = catalog.map((c) => c.title);

        const { cleanedLabel } = matchUploadedClass(cleaned, liveClasses, RECORDED_LESSONS);
        const isGenericOpenClasses =
          !cleanedLabel ||
          /^(?:open|start|show|go to|list)\s+(?:the\s+)?(?:live\s+|online\s+|recorded\s+)?(?:class|classes|classroom|lesson|lessons)$/i.test(
            cmd
          );

        if (!isGenericOpenClasses && cleanedLabel.length >= 2) {
          playMatchedClassOrPromptRetry(cleaned);
          return;
        }

        const promptMsg =
          classTitles.length > 0
            ? `Opened Online Classes. Select the class you want to hear. The uploaded classes are: ${classTitles.join(', ')}. Please say the class name or number.`
            : 'Opened Online Classes. Select the class you want to hear. No classes have been uploaded yet.';
        setVoiceStatus(
          'Opened Online Classes — listening for which class you want to hear.'
        );
        if (classTitles.length > 0) {
          speakAndArmDialogue(promptMsg, 'select-class', 28000);
        } else {
          setDialogueMode('idle');
          speakAloud(promptMsg, language);
        }
        return;
      }

      if (/\b(result|results|score|scores|marks|grade|grades)\b/.test(cmd)) {
        openStudentResults();
        const latest = examResults[0];
        const summary = latest
          ? `Opened Student Results. Your latest score is ${latest.score} out of ${latest.totalQuestions}, which is ${latest.percentage} percent.`
          : 'Opened Student Results. You have no completed exam records yet.';
        setVoiceStatus(`Voice command: "${cleaned}" -> Reading Student Results.`);
        window.setTimeout(() => {
          handleReadPage(summary);
        }, 160);
        return;
      }

      // Materials navigation or named material launch
      if (
        /\b(open|show|go to|list|read|hear|select)\b.*\b(material|materials|note|notes|study note|study notes|offline)\b/.test(
          cmd
        ) ||
        /^(?:study\s+)?(materials|notes)$/i.test(cmd)
      ) {
        navigateTo('materials');
        const titles = studentVisibleMaterials.map((m) => m.title);
        const { cleanedLabel } = matchUploadedMaterial(cleaned, studentVisibleMaterials);
        const isGenericOpenMaterials =
          !cleanedLabel ||
          /^(?:open|show|go to|list|read)\s+(?:the\s+)?(?:study\s+)?(?:material|materials|note|notes|offline)$/i.test(
            cmd
          );

        if (!isGenericOpenMaterials && cleanedLabel.length >= 2) {
          playMatchedMaterialOrPromptRetry(cleaned);
          return;
        }

        const promptMsg =
          titles.length > 0
            ? `Opened Study Materials. Select the material you want to hear. The uploaded materials are: ${titles.join(', ')}. Please say the material name or number.`
            : 'Opened Study Materials. No study materials are uploaded for your profile yet.';
        setVoiceStatus(
          'Opened Study Materials — listening for which material you want to hear.'
        );
        if (titles.length > 0) {
          speakAndArmDialogue(promptMsg, 'select-material', 28000);
        } else {
          setDialogueMode('idle');
          speakAloud(promptMsg, language);
        }
        return;
      }

      if (/\b(open|start|go to|show|take)\s+(?:the\s+)?(exam|examination|test|quiz)\b/.test(cmd) || /^(exam|examination|quiz)$/.test(cmd)) {
        navigateTo('exam');
        const firstQ = examQuestions[0];
        const qSummary = firstQ
          ? `Question 1: ${firstQ.prompt}. Options: ${firstQ.options.map((o, idx) => `${idx + 1}: ${o.label}`).join(', ')}.`
          : '';
        const msg = `Opened Examination. ${examQuestions.length} questions are ready. ${qSummary}`;
        setVoiceStatus(`Voice command: "${cleaned}" -> Reading Examination.`);
        window.setTimeout(() => {
          handleReadPage(msg);
        }, 160);
        return;
      }

      if (/\b(access|accessibility|setting|settings|eye control)\b/.test(cmd)) {
        navigateTo('access');
        setVoiceStatus(`Voice command: "${cleaned}" -> Reading Accessibility Centre.`);
        window.setTimeout(() => {
          handleReadPage('Opened Accessibility Centre.');
        }, 160);
        return;
      }

      if (/\b(sign language|sign studio)\b/.test(cmd)) {
        navigateTo('sign');
        setVoiceStatus(`Voice command: "${cleaned}" -> Reading Sign Language studio.`);
        window.setTimeout(() => {
          handleReadPage('Opened Sign Language Studio.');
        }, 160);
        return;
      }

      if (/\b(home|dashboard|main page|start page|go back)\b/.test(cmd)) {
        navigateTo('home');
        setVoiceStatus(`Voice command: "${cleaned}" -> Reading Home dashboard.`);
        window.setTimeout(() => {
          handleReadPage('Opened Home Dashboard.');
        }, 160);
        return;
      }

      // 8. Active conversational context handlers (Class selector / Material selector / Jarvis Tutor loop)
      if (blindDialogueModeRef.current === 'select-class' && activeSection === 'classes') {
        if (/\b(list|what classes|which classes|available|uploaded)\b/.test(cmd)) {
          const titles = buildPlayableClassCatalog(liveClasses, RECORDED_LESSONS).map((c) => c.title);
          speakAndArmDialogue(
            `The uploaded classes are: ${titles.join(', ')}. Please say the class you want to hear.`,
            'select-class',
            28000
          );
          return;
        }
        playMatchedClassOrPromptRetry(cleaned);
        return;
      }

      if (blindDialogueModeRef.current === 'select-material' && activeSection === 'materials') {
        if (/\b(list|what materials|what notes|available|uploaded)\b/.test(cmd)) {
          const titles = studentVisibleMaterials.map((m) => m.title);
          speakAndArmDialogue(
            `The uploaded materials are: ${titles.join(', ')}. Please say the material you want to hear.`,
            'select-material',
            28000
          );
          return;
        }
        playMatchedMaterialOrPromptRetry(cleaned);
        return;
      }

      if (blindDialogueModeRef.current === 'jarvis-tutor' && activeSection === 'tutor') {
        setDialogueMode('jarvis-tutor');
        setEchoGuardRef.current(60000);
        setVoiceTutorPrompt({ id: Date.now(), text: cleaned });
        setVoiceStatus(`Jarvis AI Tutor thinking about: "${cleaned}"`);
        return;
      }

      // 9. Explicit spoken question for AI Tutor (enters Jarvis audio-to-audio loop!)
      const directQuestionMatch =
        /^(?:please\s+)?(?:ask (?:the )?(?:ai )?tutor(?: to)?\s+|open (?:ai )?tutor(?:ing)?\s+(?:and\s+)?(?:ask\s+)?|tell me\s+|explain\s+|what is\s+|what are\s+|who is\s+|why (?:is|are|do|does)\s+|how (?:do|does|to|can|is)\s+|define\s+|teach me\s+|solve\s+|help me (?:with|understand)\s+)(.+)$/i.exec(
          cleaned
        );
      if (directQuestionMatch) {
        const prefixCheck = cleaned.toLowerCase();
        const questionToAsk =
          prefixCheck.startsWith('ask ') || prefixCheck.startsWith('open ')
            ? directQuestionMatch[1].trim()
            : cleaned;
        if (questionToAsk.length >= 2) {
          navigateTo('tutor');
          setDialogueMode('jarvis-tutor');
          setEchoGuardRef.current(60000);
          setVoiceTutorPrompt({ id: Date.now(), text: questionToAsk });
          setVoiceStatus(`Jarvis AI Tutor answering: "${questionToAsk}".`);
          return;
        }
      }

      // 10. Multi-word conversational request -> route to Jarvis AI Tutor automatically
      if (cmd.split(' ').length >= 3) {
        navigateTo('tutor');
        setDialogueMode('jarvis-tutor');
        setEchoGuardRef.current(60000);
        setVoiceTutorPrompt({ id: Date.now(), text: cleaned });
        setVoiceStatus(`Jarvis AI Tutor answering: "${cleaned}"`);
        return;
      }

      fireBlindHaptic('error');
      const retryMsg = isOcdMode
        ? `I heard ${cleaned}. Try saying start camera, stop camera, calibrate, open AI tutoring, open classes, open materials, open exam, or read page.`
        : `I heard ${cleaned}. Try saying open AI tutoring, open classes, open materials, open exam, results, or read page.`;
      setVoiceStatus(retryMsg);
      speakAloud(retryMsg, language);
    },
    [
      hasAlwaysOnVoice,
      isOcdMode,
      activeSection,
      language,
      liveClasses,
      examResults,
      studentVisibleMaterials,
      examQuestions,
      fontSize,
      handleReadPage,
      fireBlindHaptic,
      navigateTo,
      openStudentResults,
      playMatchedClassOrPromptRetry,
      playMatchedMaterialOrPromptRetry,
      setDialogueMode,
      speakAndArmDialogue,
    ]
  );

  const ocdDirectVoicePatterns = useMemo<RegExp[] | undefined>(() => {
    if (!isOcdMode) return undefined;
    return [
      /^(?:please\s+)?(?:start|open|turn on|switch on|enable|launch|activate|stop|close|turn off|switch off|disable|end|deactivate|minimize|hide|collapse|expand|show|restore)\s+(?:the\s+)?(?:hand\s+|webcam\s+)?(?:camera|webcam|hand navigation|hand tracking|hand navigator|hand preview)(?:\s+please)?$/i,
      /^(?:camera\s+(?:on|off))$/i,
      /^(?:please\s+)?(?:start\s+|open\s+|launch\s+|begin\s+|do\s+|run\s+|reset\s+|clear\s+|cancel\s+|stop\s+|exit\s+)?(?:the\s+)?(?:hand[\s-]+tracking\s+|hand\s+)?(?:calibrate|calibration|recalibrate)(?:\s+wizard)?(?:\s+(?:camera|hand|zone|reach|please))?$/i,
      /^(?:please\s+)?(?:repeat|replay)\s+(?:the\s+)?(?:calibration\s+|wizard\s+)?(?:instruction|step|cue)(?:\s+please)?$/i,
      /^(?:please\s+)?(?:skip|next)\s+(?:calibration\s+|wizard\s+)?step(?:\s+please)?$/i,
      /^(?:please\s+)?(?:cancel|stop|exit)\s+(?:the\s+)?(?:calibration\s+)?wizard(?:\s+please)?$/i,
    ];
  }, [isOcdMode]);

  const {
    listeningState: blindVoiceState,
    lastHeard: blindLastHeard,
    armForReply,
    disarmReply,
    setEchoGuard,
  } = useBlindWakeWord({
    enabled: hasAlwaysOnVoice,
    language,
    onCommand: handleBlindVoiceCommand,
    onWakeOnly: handleBlindWakeOnly,
    directCommandPatterns: ocdDirectVoicePatterns,
  });

  armForReplyRef.current = armForReply;
  disarmReplyRef.current = disarmReply;
  setEchoGuardRef.current = setEchoGuard;

  const handleStartVoiceNav = () => {
    if (isDeafStudent) return;
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) {
      setVoiceStatus('Voice navigation is not supported in this browser.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = getSpeechLang(language);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setVoiceStatus(
      'Listening for navigation command (e.g., Classes, Materials, Tutor, Exam, Result)...'
    );

    recognition.onresult = (event) => {
      const command = (event.results[0]?.[0]?.transcript || '').toLowerCase();
      if (isOcdMode && /\b(reset|clear)\b.*\b(calibrat|wizard)/.test(command)) {
        setOcdHandVoiceCmd({ id: Date.now(), action: 'reset-calibration' });
        setVoiceStatus(`Voice command: "${command}" -> Resetting hand calibration.`);
      } else if (isOcdMode && /\b(cancel|stop|exit)\b.*\b(calibrat|wizard)/.test(command)) {
        setOcdHandVoiceCmd({ id: Date.now(), action: 'cancel-calibration' });
        setVoiceStatus(`Voice command: "${command}" -> Cancelling calibration wizard.`);
      } else if (isOcdMode && /\b(repeat|replay)\b.*\b(instruction|step|cue)/.test(command)) {
        setOcdHandVoiceCmd({ id: Date.now(), action: 'repeat-calibration-cue' });
        setVoiceStatus(`Voice command: "${command}" -> Repeating calibration audio cue.`);
      } else if (isOcdMode && /\b(calibrat|wizard)/.test(command)) {
        setOcdHandVoiceCmd({ id: Date.now(), action: 'calibrate' });
        setVoiceStatus(`Voice command: "${command}" -> Starting hand-tracking calibration wizard.`);
      } else if (isOcdMode && /\b(start|open|enable|turn on)\b.*\b(camera|webcam)/.test(command)) {
        setOcdHandVoiceCmd({ id: Date.now(), action: 'start-camera' });
        setVoiceStatus(`Voice command: "${command}" -> Starting camera.`);
      } else if (isOcdMode && /\b(stop|close|disable|turn off)\b.*\b(camera|webcam)/.test(command)) {
        setOcdHandVoiceCmd({ id: Date.now(), action: 'stop-camera' });
        setVoiceStatus(`Voice command: "${command}" -> Stopping camera.`);
      } else if (command.includes('result')) {
        openStudentResults();
        setVoiceStatus(`Voice command: "${command}" -> Opened Results.`);
      } else if (command.includes('class')) {
        navigateTo('classes');
        setVoiceStatus(`Voice command: "${command}" -> Opened Classes.`);
      } else if (command.includes('material') || command.includes('note')) {
        navigateTo('materials');
        setVoiceStatus(`Voice command: "${command}" -> Opened Materials.`);
      } else if (command.includes('tutor') || command.includes('ai')) {
        navigateTo('tutor');
        setVoiceStatus(`Voice command: "${command}" -> Opened AI Tutor.`);
      } else if (command.includes('sign')) {
        navigateTo('sign');
        setVoiceStatus(`Voice command: "${command}" -> Opened Sign Language.`);
      } else if (command.includes('exam') || command.includes('test')) {
        navigateTo('exam');
        setVoiceStatus(`Voice command: "${command}" -> Opened Examination.`);
      } else if (command.includes('teacher') && currentUser?.role === 'teacher') {
        navigateTo('teacher');
        setVoiceStatus(`Voice command: "${command}" -> Opened Teacher Dashboard.`);
      } else if (command.includes('home')) {
        navigateTo('home');
        setVoiceStatus(`Voice command: "${command}" -> Opened Home.`);
      } else if (command.includes('access') || command.includes('eye')) {
        navigateTo('access');
        setVoiceStatus(`Voice command: "${command}" -> Opened Accessibility Centre.`);
      } else if (command.includes('soft blue')) {
        handleChangeContrast('soft-blue');
        setVoiceStatus(`Voice command: "${command}" -> Switched contrast to Soft Blue.`);
      } else if (command.includes('yellow')) {
        handleChangeContrast('yellow-on-black');
        setVoiceStatus(`Voice command: "${command}" -> Switched contrast to Yellow on Black.`);
      } else if (command.includes('dyslexia') || command.includes('pastel')) {
        handleChangeContrast('dyslexia-pastel');
        setVoiceStatus(`Voice command: "${command}" -> Switched contrast to Dyslexia Pastel.`);
      } else if (command.includes('high contrast')) {
        handleChangeContrast('high-contrast-dark');
        setVoiceStatus(`Voice command: "${command}" -> Switched contrast to High Contrast Dark.`);
      } else if (command.includes('default')) {
        handleChangeContrast('default');
        setVoiceStatus(`Voice command: "${command}" -> Switched contrast to Default.`);
      } else if (command.includes('dark')) {
        setTheme('dark');
        if (contrast === 'soft-blue' || contrast === 'dyslexia-pastel') {
          setContrast('default');
        }
        setVoiceStatus(`Voice command: "${command}" -> Switched to Dark Mode.`);
      } else if (command.includes('light')) {
        setTheme('light');
        if (contrast === 'high-contrast-dark' || contrast === 'yellow-on-black') {
          setContrast('default');
        }
        setVoiceStatus(`Voice command: "${command}" -> Switched to Light Mode.`);
      } else if (command.includes('large') || command.includes('font')) {
        setFontSize((prev) => (prev >= 125 ? 100 : Math.min(150, prev + 15)));
        setVoiceStatus(`Voice command: "${command}" -> Adjusted text size.`);
      } else {
        setVoiceStatus(
          `Command not recognized: "${command}". Try Classes, Materials, Tutor, Exam, Result, Soft Blue, High Contrast, Yellow, Dyslexia Pastel, Dark Mode, or Light Mode.`
        );
      }
    };

    recognition.onerror = () => {
      setVoiceStatus('Could not capture voice command. Please check microphone permissions.');
    };

    recognition.start();
  };

  if (authChecking) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#0E3A75] via-[#144B92] to-[#0F3F7E] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-2xl shadow-2xl px-8 py-7 text-center">
          <p className="text-lg font-bold text-[#153B70] dark:text-sky-300">EduCare</p>
          <p className="mt-1 text-sm text-[#52657C] dark:text-slate-400">Checking session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <FrontAuthGate
        language={language}
        fontSize={fontSize}
        theme={theme}
        contrast={contrast}
        isSubmitting={authSubmitting}
        authError={authError}
        pendingGoogleAccount={pendingGoogleUser}
        onClearError={() => setAuthError('')}
        onChangeLanguage={setLanguage}
        onChangeFontSize={setFontSize}
        onToggleTheme={toggleTheme}
        onChangeContrast={handleChangeContrast}
        onLogin={handleLogin}
        onGoogleLogin={handleGoogleLogin}
        onCompleteGoogleRegistration={handleCompleteGoogleRegistration}
        onCancelGoogleRegistration={handleCancelGoogleRegistration}
        onDemoLogin={handleDemoLogin}
        onRegister={handleRegister}
      />
    );
  }

  return (
    <WorkspaceShell
      user={currentUser}
      activeSection={activeSection}
      language={language}
      fontSize={fontSize}
      theme={theme}
      contrast={contrast}
      voiceStatus={voiceStatus}
      isDeafStudent={isDeafStudent}
      isBlindStudent={isBlindStudent}
      alwaysOnVoice={hasAlwaysOnVoice}
      isOcdMode={isOcdMode}
      isNoHandsMode={isNoHandsMode}
      isOnline={isOnline}
      blindVoiceState={blindVoiceState}
      blindLastHeard={blindLastHeard}
      onNavigate={navigateTo}
      onOpenStudentResults={openStudentResults}
      onChangeLanguage={setLanguage}
      onStartVoiceNav={handleStartVoiceNav}
      onReadPage={handleReadPage}
      onChangeFontSize={setFontSize}
      onToggleTheme={toggleTheme}
      onChangeContrast={handleChangeContrast}
      onSignOut={() => void handleSignOut()}
    >
      {activeSection === 'home' && (
        <HomeSection
          user={currentUser}
          language={language}
          fontSize={fontSize}
          contrast={contrast}
          voiceStatus={voiceStatus}
          assignments={assignments}
          materialsCount={studentVisibleMaterials.length}
          matchedMaterials={studentVisibleMaterials}
          matchedTeachers={matchedTeachers}
          resultsCount={examResults.length}
          loginLogs={loginLogs}
          blindVoiceState={blindVoiceState}
          blindLastHeard={blindLastHeard}
          onSelectProfile={(profile) => void handleUpdateUserPreferences({ disabilityProfile: profile })}
          onNavigate={navigateTo}
          onOpenStudentResults={openStudentResults}
          onStartVoiceNav={handleStartVoiceNav}
          onReadPage={handleReadPage}
          onChangeFontSize={setFontSize}
          onChangeContrast={handleChangeContrast}
          onClearSavedLoginInfo={handleClearSavedLoginInfo}
        />
      )}

      {activeSection === 'classes' && (
        <ClassesSection
          currentUser={currentUser}
          language={language}
          publishedClassLink={publishedClassLink}
          liveClasses={liveClasses}
          matchedTeachers={matchedTeachers}
          doubts={studentDoubts}
          onDoubtSubmitted={(newDoubt) => setStudentDoubts((prev) => [newDoubt, ...prev])}
          onRefreshClasses={() => fetchUserWorkspaceData(currentUser.role)}
          hideSoundControls={isDeafStudent}
          voiceSelectedClass={voiceSelectedClass}
          isOnline={isOnline}
        />
      )}

      {activeSection === 'materials' && (
        <MaterialsSection
          language={language}
          userRole={currentUser.role}
          studentProfile={currentUser.role === 'student' ? activeStudentProfile : undefined}
          materials={studentVisibleMaterials}
          hideSoundControls={isDeafStudent}
          voiceSelectedMaterial={voiceSelectedMaterial}
          isOnline={isOnline}
        />
      )}

      {activeSection === 'tutor' && (
        <TutorSection
          currentUser={currentUser}
          liveClasses={liveClasses}
          language={language}
          userRole={currentUser.role}
          hideSoundControls={isDeafStudent}
          signLanguageMode={isDeafStudent}
          isBlindStudent={hasAlwaysOnVoice}
          autoPrompt={voiceTutorPrompt}
          onTutorAudioStart={handleTutorAudioStart}
          onTutorAudioEnd={handleTutorAudioEnd}
        />
      )}

      {activeSection === 'access' && (
        <AccessibilitySection
          language={language}
          fontSize={fontSize}
          contrast={contrast}
          theme={theme}
          voiceStatus={voiceStatus}
          onStartVoiceNav={handleStartVoiceNav}
          onReadPage={handleReadPage}
          onChangeFontSize={setFontSize}
          onChangeContrast={handleChangeContrast}
          onToggleTheme={toggleTheme}
          hideSoundControls={isDeafStudent}
          isBlindStudent={isBlindStudent}
          alwaysOnVoice={hasAlwaysOnVoice}
          isOcdMode={isOcdMode}
          blindVoiceState={blindVoiceState}
        />
      )}

      {activeSection === 'sign' && (
        <SignLanguageSection language={language} hideSoundControls={isDeafStudent} />
      )}

      {activeSection === 'exam' && (
        <ExamSection
          language={language}
          userRole={currentUser.role}
          questions={examQuestions}
          results={examResults}
          initialTab={examTabIntent}
          onRefreshData={() => fetchUserWorkspaceData(currentUser.role)}
          onQuestionCreated={(updated) => setExamQuestions(updated)}
          onQuestionDeleted={(updated) => setExamQuestions(updated)}
          onResultSubmitted={(newResult) =>
            setExamResults((prev) => [newResult, ...prev])
          }
          hideSoundControls={isDeafStudent}
          isNoHandsMode={isNoHandsMode}
        />
      )}

      {activeSection === 'teacher' && currentUser.role === 'teacher' && (
        <TeacherSection
          user={currentUser}
          language={language}
          fontSize={fontSize}
          contrast={contrast}
          voiceStatus={voiceStatus}
          publishedClassLink={publishedClassLink}
          liveClasses={liveClasses}
          materials={materials}
          assignmentsCount={assignments.length}
          resultsCount={examResults.length}
          studentStatuses={studentStatuses}
          studentDoubts={studentDoubts}
          onDoubtReplied={(updated) =>
            setStudentDoubts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
          }
          onRefreshStatuses={() => fetchUserWorkspaceData('teacher')}
          onOpenExamTab={openTeacherExamTab}
          onPublishClassLink={setPublishedClassLink}
          onLiveClassesUpdated={setLiveClasses}
          onAddMaterial={handleAddMaterial}
          onDeleteMaterial={handleDeleteMaterial}
          onAddAssignment={(newAsg) => setAssignments((prev) => [newAsg, ...prev])}
          onUpdateTeachingProfiles={(teachingProfiles) =>
            void handleUpdateUserPreferences({ teachingProfiles })
          }
          onNavigate={navigateTo}
          onStartVoiceNav={handleStartVoiceNav}
          onReadPage={handleReadPage}
          onChangeFontSize={setFontSize}
          onChangeContrast={handleChangeContrast}
        />
      )}
      {isOcdMode && (
        <OcdHandNavigator
          voiceCommand={ocdHandVoiceCmd}
          onVoiceFeedback={handleHandNavigatorVoiceFeedback}
          voiceState={blindVoiceState}
        />
      )}
      {isNoHandsMode && <NoHandsFaceNavigator />}
      <OfflineIndicator
        cachedMaterialsCount={studentVisibleMaterials.length}
        cachedClassesCount={liveClasses.length + RECORDED_LESSONS.length}
      />
    </WorkspaceShell>
  );
}
