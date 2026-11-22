import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  AccessibilityPref,
  DisabilityProfile,
  LoginLogRecord,
  StudyMaterial,
  UserAccount,
  UserRole,
} from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

// Blueprint-aligned truncation & sanitization helpers
function sanitizeName(raw: string | null | undefined, fallbackEmail: string): string {
  const trimmed = (raw || '').trim();
  const base = trimmed || fallbackEmail.split('@')[0] || 'EduCare User';
  return base.slice(0, 120);
}

function sanitizeEmail(raw: string | null | undefined): string {
  return (raw || '').trim().toLowerCase().slice(0, 200);
}

function sanitizePhotoUrl(raw: string | null | undefined): string | undefined {
  const trimmed = (raw || '').trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 500);
}

function sanitizeUserAgent(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Browser';
  return (ua.trim() || 'Unknown Browser').slice(0, 300);
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return null;
}

export async function signInWithGooglePopup(): Promise<FirebaseUser> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutFromFirebase(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function checkGoogleUserExistsInFirestore(uid: string): Promise<boolean> {
  const userPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}

export async function recordGoogleLoginInFirestore(
  firebaseUser: FirebaseUser,
  portalRole: UserRole,
  options?: {
    name?: string;
    accessibilityPref?: AccessibilityPref;
    disabilityProfile?: DisabilityProfile;
    teachingProfiles?: DisabilityProfile[];
  }
): Promise<{ user: UserAccount; logId: string }> {
  const uid = firebaseUser.uid;
  const email = sanitizeEmail(firebaseUser.email);
  const name = sanitizeName(options?.name || firebaseUser.displayName, email);
  const photoURL = sanitizePhotoUrl(firebaseUser.photoURL);
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  let loginCount = 1;
  let accessibilityPref: AccessibilityPref = options?.accessibilityPref ?? 'standard';
  let disabilityProfile: DisabilityProfile | undefined = options?.disabilityProfile;
  let teachingProfiles: DisabilityProfile[] | undefined = options?.teachingProfiles?.slice(0, 6);

  if (!existingSnap.exists()) {
    const newProfile: Record<string, unknown> = {
      uid,
      name,
      email,
      portalRole,
      authProvider: 'google',
      accessibilityPref,
      loginCount: 1,
      isLoggedIn: true,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    };
    if (photoURL) {
      newProfile.photoURL = photoURL;
    }
    if (disabilityProfile) {
      newProfile.disabilityProfile = disabilityProfile;
    }
    if (teachingProfiles && teachingProfiles.length > 0) {
      newProfile.teachingProfiles = teachingProfiles;
    }

    try {
      await setDoc(userRef, newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
  } else {
    const data = existingSnap.data();
    loginCount = (typeof data.loginCount === 'number' ? data.loginCount : 0) + 1;
    if (
      !options?.accessibilityPref &&
      (data.accessibilityPref === 'large-text' ||
        data.accessibilityPref === 'voice-nav' ||
        data.accessibilityPref === 'standard')
    ) {
      accessibilityPref = data.accessibilityPref;
    }
    if (
      !options?.disabilityProfile &&
      (data.disabilityProfile === 'standard' ||
        data.disabilityProfile === 'deaf' ||
        data.disabilityProfile === 'blind' ||
        data.disabilityProfile === 'no-hands' ||
        data.disabilityProfile === 'ocd' ||
        data.disabilityProfile === 'stammering')
    ) {
      disabilityProfile = data.disabilityProfile;
    }
    if (!options?.teachingProfiles && Array.isArray(data.teachingProfiles)) {
      teachingProfiles = data.teachingProfiles.filter(
        (v: unknown): v is DisabilityProfile =>
          v === 'standard' ||
          v === 'deaf' ||
          v === 'blind' ||
          v === 'no-hands' ||
          v === 'ocd' ||
          v === 'stammering'
      );
    }

    const updates: Record<string, unknown> = {
      name,
      email,
      portalRole,
      loginCount: increment(1),
      isLoggedIn: true,
      lastLoginAt: serverTimestamp(),
    };
    if (photoURL) {
      updates.photoURL = photoURL;
    }
    if (options?.accessibilityPref) {
      updates.accessibilityPref = options.accessibilityPref;
    }
    if (options?.disabilityProfile) {
      updates.disabilityProfile = options.disabilityProfile;
    }
    if (options?.teachingProfiles) {
      updates.teachingProfiles = options.teachingProfiles.slice(0, 6);
    }

    try {
      await updateDoc(userRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }

  // Create a login audit record under /users/{uid}/loginLogs/{logId}
  const randomSuffix = Math.random().toString(36).slice(2, 10).replace(/[^a-zA-Z0-9]/g, 'x');
  const logId = `log_${Date.now()}_${randomSuffix}`;
  const logPath = `users/${uid}/loginLogs/${logId}`;
  const logRef = doc(db, 'users', uid, 'loginLogs', logId);

  try {
    await setDoc(logRef, {
      uid,
      email,
      displayName: name,
      portalRole,
      authProvider: 'google',
      userAgent: sanitizeUserAgent(),
      status: 'active',
      loggedInAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, logPath);
  }

  return {
    logId,
    user: {
      id: uid,
      name,
      email,
      role: portalRole,
      accessibilityPref,
      disabilityProfile,
      teachingProfiles,
      photoURL,
      authProvider: 'google',
      loginCount,
      isLoggedIn: true,
      lastLoginAt: new Date().toISOString(),
    },
  };
}

export async function fetchUserLoginInfoFromFirestore(
  uid: string
): Promise<{ profile: UserAccount | null; logs: LoginLogRecord[] }> {
  const userPath = `users/${uid}`;
  let profile: UserAccount | null = null;

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      profile = {
        id: uid,
        name: typeof data.name === 'string' ? data.name : 'EduCare User',
        email: typeof data.email === 'string' ? data.email : '',
        role: data.portalRole === 'teacher' ? 'teacher' : 'student',
        accessibilityPref:
          data.accessibilityPref === 'large-text' || data.accessibilityPref === 'voice-nav'
            ? data.accessibilityPref
            : 'standard',
        disabilityProfile:
          data.disabilityProfile === 'standard' ||
          data.disabilityProfile === 'deaf' ||
          data.disabilityProfile === 'blind' ||
          data.disabilityProfile === 'no-hands' ||
          data.disabilityProfile === 'ocd' ||
          data.disabilityProfile === 'stammering'
            ? data.disabilityProfile
            : undefined,
        teachingProfiles: Array.isArray(data.teachingProfiles)
          ? data.teachingProfiles.filter(
              (v: unknown): v is DisabilityProfile =>
                v === 'standard' ||
                v === 'deaf' ||
                v === 'blind' ||
                v === 'no-hands' ||
                v === 'ocd' ||
                v === 'stammering'
            )
          : undefined,
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
        authProvider: 'google',
        loginCount: typeof data.loginCount === 'number' ? data.loginCount : 1,
        isLoggedIn: Boolean(data.isLoggedIn),
        lastLoginAt: toIsoString(data.lastLoginAt),
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const logsPath = `users/${uid}/loginLogs`;
  const logs: LoginLogRecord[] = [];
  try {
    const logsQuery = query(
      collection(db, 'users', uid, 'loginLogs'),
      where('uid', '==', uid),
      limit(15)
    );
    const snapshot = await getDocs(logsQuery);
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push({
        id: docSnap.id,
        email: typeof data.email === 'string' ? data.email : '',
        displayName: typeof data.displayName === 'string' ? data.displayName : '',
        portalRole: data.portalRole === 'teacher' ? 'teacher' : 'student',
        authProvider: 'google',
        status: data.status === 'signed_out' ? 'signed_out' : 'active',
        loggedInAt: toIsoString(data.loggedInAt) || new Date().toISOString(),
        signedOutAt: toIsoString(data.signedOutAt),
      });
    });
    logs.sort((a, b) => new Date(b.loggedInAt).getTime() - new Date(a.loggedInAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, logsPath);
  }

  return { profile, logs: logs.slice(0, 8) };
}

export async function recordLogoutInFirestore(
  uid: string,
  activeLogId: string | null
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      isLoggedIn: false,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  if (activeLogId) {
    const logPath = `users/${uid}/loginLogs/${activeLogId}`;
    try {
      await updateDoc(doc(db, 'users', uid, 'loginLogs', activeLogId), {
        status: 'signed_out',
        signedOutAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, logPath);
    }
  }
}

export async function updateUserPreferencesInFirestore(
  uid: string,
  updates: {
    disabilityProfile?: DisabilityProfile;
    teachingProfiles?: DisabilityProfile[];
    accessibilityPref?: AccessibilityPref;
  }
): Promise<void> {
  const userPath = `users/${uid}`;
  const payload: Record<string, unknown> = {};
  if (updates.disabilityProfile) payload.disabilityProfile = updates.disabilityProfile;
  if (updates.teachingProfiles) payload.teachingProfiles = updates.teachingProfiles.slice(0, 6);
  if (updates.accessibilityPref) payload.accessibilityPref = updates.accessibilityPref;
  if (Object.keys(payload).length === 0) return;

  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function deleteUserLoginDataInFirestore(uid: string): Promise<void> {
  const logsPath = `users/${uid}/loginLogs`;
  try {
    const logsQuery = query(
      collection(db, 'users', uid, 'loginLogs'),
      where('uid', '==', uid),
      limit(100)
    );
    const snapshot = await getDocs(logsQuery);
    for (const docSnap of snapshot.docs) {
      const logDocPath = `${logsPath}/${docSnap.id}`;
      try {
        await deleteDoc(doc(db, 'users', uid, 'loginLogs', docSnap.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, logDocPath);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, logsPath);
  }

  const userPath = `users/${uid}`;
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, userPath);
  }
}

// --- Study Notes (Teacher -> Student persistent Firestore collection) ---

export function subscribeToStudyNotes(
  onNotes: (notes: StudyMaterial[]) => void
): Unsubscribe {
  if (!auth.currentUser) {
    return () => {};
  }

  const notesPath = 'studyNotes';
  const notesQuery = query(
    collection(db, notesPath),
    where('visibility', '==', 'published'),
    limit(100)
  );

  return onSnapshot(
    notesQuery,
    (snapshot) => {
      const items: Array<{ note: StudyMaterial; sortMs: number }> = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const iso = toIsoString(data.createdAt) || new Date().toISOString();
        const sortMs = Date.parse(iso) || 0;
        items.push({
          sortMs,
          note: {
            id: docSnap.id,
            title: typeof data.title === 'string' ? data.title : 'Untitled Note',
            subject: typeof data.subject === 'string' ? data.subject : 'General',
            readTime: typeof data.readTime === 'string' ? data.readTime : '1 min read',
            content: typeof data.content === 'string' ? data.content : '',
            fileName: typeof data.fileName === 'string' ? data.fileName : undefined,
            uploadedBy: typeof data.uploadedBy === 'string' ? data.uploadedBy : 'EduCare Teacher',
            teacherUid: typeof data.teacherUid === 'string' ? data.teacherUid : undefined,
            targetProfiles: Array.isArray(data.targetProfiles)
              ? data.targetProfiles.filter(
                  (v: unknown): v is DisabilityProfile =>
                    v === 'standard' ||
                    v === 'deaf' ||
                    v === 'blind' ||
                    v === 'no-hands' ||
                    v === 'ocd' ||
                    v === 'stammering'
                )
              : undefined,
            source: 'firestore',
            createdAt: iso.slice(0, 10),
          },
        });
      });

      items.sort((a, b) => b.sortMs - a.sortMs);
      onNotes(items.map((entry) => entry.note));
    },
    (error) => {
      if (!auth.currentUser) {
        return;
      }
      handleFirestoreError(error, OperationType.LIST, notesPath);
    }
  );
}

export async function createStudyNoteInFirestore(input: {
  title: string;
  subject: string;
  readTime: string;
  content: string;
  fileName?: string;
  uploadedBy: string;
  teacherUid: string;
  targetProfiles?: DisabilityProfile[];
}): Promise<StudyMaterial> {
  const randomSuffix = Math.random().toString(36).slice(2, 10).replace(/[^a-zA-Z0-9]/g, 'x');
  const noteId = `note_${Date.now()}_${randomSuffix}`;
  const notePath = `studyNotes/${noteId}`;

  const cleanTitle = input.title.trim().slice(0, 160);
  const cleanSubject = (input.subject.trim() || 'General').slice(0, 80);
  const cleanReadTime = (input.readTime.trim() || '1 min read').slice(0, 40);
  const cleanContent = input.content.trim().slice(0, 20000);
  const cleanUploadedBy = (input.uploadedBy.trim() || 'EduCare Teacher').slice(0, 120);
  const cleanFileName = input.fileName?.trim().slice(0, 200);
  const cleanTargets = input.targetProfiles?.slice(0, 6);

  const payload: Record<string, unknown> = {
    title: cleanTitle,
    subject: cleanSubject,
    readTime: cleanReadTime,
    content: cleanContent,
    uploadedBy: cleanUploadedBy,
    teacherUid: input.teacherUid,
    visibility: 'published',
    createdAt: serverTimestamp(),
  };

  if (cleanFileName) {
    payload.fileName = cleanFileName;
  }
  if (cleanTargets && cleanTargets.length > 0) {
    payload.targetProfiles = cleanTargets;
  }

  try {
    await setDoc(doc(db, 'studyNotes', noteId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, notePath);
  }

  return {
    id: noteId,
    title: cleanTitle,
    subject: cleanSubject,
    readTime: cleanReadTime,
    content: cleanContent,
    fileName: cleanFileName,
    uploadedBy: cleanUploadedBy,
    teacherUid: input.teacherUid,
    targetProfiles: cleanTargets,
    source: 'firestore',
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

export async function deleteStudyNoteFromFirestore(noteId: string): Promise<void> {
  const notePath = `studyNotes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'studyNotes', noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, notePath);
  }
}
