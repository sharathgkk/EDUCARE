import type {
  ExamQuestion,
  ExamResultRecord,
  LiveClassSession,
  MatchedTeacher,
  StudyMaterial,
  UserAccount,
} from '../types';
import { apiFetch, apiUrl } from '../services/api';

export const ESSENTIAL_LEARNING_CACHE_NAME = 'educare-essential-learning-data';
export const SESSION_CACHE_NAME = 'educare-session-cache';
const OFFLINE_WORKSPACE_STORAGE_KEY = 'educare_offline_workspace_v1';
const OFFLINE_USER_STORAGE_KEY = 'educare_offline_user_v1';

export interface OfflineWorkspaceSnapshot {
  serverNotes: StudyMaterial[];
  firestoreNotes: StudyMaterial[];
  liveClasses: LiveClassSession[];
  examQuestions: ExamQuestion[];
  examResults: ExamResultRecord[];
  teachersDirectory: MatchedTeacher[];
  cachedAt: string;
}

export function readOfflineWorkspaceSnapshot(): OfflineWorkspaceSnapshot | null {
  try {
    const raw = window.localStorage.getItem(OFFLINE_WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineWorkspaceSnapshot;
  } catch {
    return null;
  }
}

export function saveOfflineWorkspaceSnapshot(
  partial: Partial<OfflineWorkspaceSnapshot>
): OfflineWorkspaceSnapshot | null {
  try {
    const current = readOfflineWorkspaceSnapshot() ?? {
      serverNotes: [],
      firestoreNotes: [],
      liveClasses: [],
      examQuestions: [],
      examResults: [],
      teachersDirectory: [],
      cachedAt: new Date().toISOString(),
    };
    const next: OfflineWorkspaceSnapshot = {
      ...current,
      ...partial,
      cachedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(OFFLINE_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function readOfflineUser(): UserAccount | null {
  try {
    const raw = window.localStorage.getItem(OFFLINE_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserAccount;
  } catch {
    return null;
  }
}

export function saveOfflineUser(user: UserAccount | null): void {
  try {
    if (!user) {
      window.localStorage.removeItem(OFFLINE_USER_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(OFFLINE_USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage quota errors
  }
}

export async function clearOfflineSessionCache(): Promise<void> {
  saveOfflineUser(null);
  try {
    if ('caches' in window) {
      await window.caches.delete(SESSION_CACHE_NAME);
    }
  } catch {
    // Ignore cache API errors
  }
}

const ESSENTIAL_API_ENDPOINTS = [
  '/api/materials',
  '/api/classes/live',
  '/api/exam/questions',
  '/api/teachers',
] as const;

/**
 * Proactively primes the Service Worker Cache Storage with essential study
 * materials, class schedules/links, exam questions, and matched teachers so
 * blind and low-vision users retain immediate access if connectivity drops.
 */
export async function warmEssentialLearningCaches(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window) || !navigator.onLine) {
    return false;
  }

  try {
    const cache = await window.caches.open(ESSENTIAL_LEARNING_CACHE_NAME);
    await Promise.all(
      ESSENTIAL_API_ENDPOINTS.map(async (endpoint) => {
        try {
          const response = await apiFetch(endpoint);
          if (response.ok) {
            await cache.put(apiUrl(endpoint), response.clone());
          }
        } catch {
          // Ignore single endpoint error while warming remaining endpoints
        }
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function getEssentialCacheSummary(): Promise<{
  swActive: boolean;
  cachedEndpoints: number;
  cachedAt: string | null;
}> {
  let swActive = false;
  let cachedEndpoints = 0;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      swActive = Boolean(reg?.active || reg?.waiting || reg?.installing);
    }
    if ('caches' in window) {
      const cache = await window.caches.open(ESSENTIAL_LEARNING_CACHE_NAME);
      const keys = await cache.keys();
      cachedEndpoints = keys.length;
    }
  } catch {
    // Ignore cache inspection errors
  }

  const snapshot = readOfflineWorkspaceSnapshot();
  return {
    swActive,
    cachedEndpoints,
    cachedAt: snapshot?.cachedAt ?? null,
  };
}
