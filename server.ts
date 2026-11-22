import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { GoogleGenAI, Type, type Chat, type Content, type GenerateContentResponse } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const DATA_DIR = path.resolve(process.env.EDUCARE_DATA_DIR || process.cwd());

type UserRole = 'student' | 'teacher';
type AccessibilityPref = 'standard' | 'large-text' | 'voice-nav';
type DisabilityProfile = 'standard' | 'deaf' | 'blind' | 'no-hands' | 'ocd' | 'stammering';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  hasLocalPassword?: boolean;
  role: UserRole;
  accessibilityPref?: AccessibilityPref;
  disabilityProfile?: DisabilityProfile;
  teachingProfiles?: DisabilityProfile[];
  subjectSpecialty?: string;
  isLoggedIn: boolean;
  lastLoginAt: string | null;
}

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessibilityPref?: AccessibilityPref;
  disabilityProfile?: DisabilityProfile;
  teachingProfiles?: DisabilityProfile[];
  subjectSpecialty?: string;
  isLoggedIn: boolean;
  lastLoginAt: string | null;
}

interface ExamOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

interface ExamQuestion {
  id: string;
  subject: string;
  prompt: string;
  options: ExamOption[];
  explanation: string;
  createdBy?: string;
}

interface ExamResultRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  submittedAt: string;
  extraTimeUsed: boolean;
}

interface LiveClassSession {
  id: string;
  title: string;
  subject: string;
  meetingUrl: string;
  scheduledAt: string;
  durationMinutes: number;
  teacherName: string;
  teacherEmail: string;
  captionsEnabled: boolean;
  notes?: string;
  createdAt: string;
}

interface StoredStudyNote {
  id: string;
  title: string;
  subject: string;
  readTime: string;
  content: string;
  fileName?: string;
  uploadedBy: string;
  teacherUid: string;
  targetProfiles?: DisabilityProfile[];
  source: 'server';
  createdAt: string;
}

const NOTES_STORE_PATH = path.join(DATA_DIR, '.educare-study-notes.json');

function loadStoredNotes(): StoredStudyNote[] {
  try {
    if (!fs.existsSync(NOTES_STORE_PATH)) return [];
    const raw = fs.readFileSync(NOTES_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredStudyNote[]) : [];
  } catch {
    return [];
  }
}

function saveStoredNotes(notes: StoredStudyNote[]): void {
  try {
    fs.writeFileSync(NOTES_STORE_PATH, JSON.stringify(notes, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist study notes file:', err);
  }
}

const storedStudyNotes: StoredStudyNote[] = loadStoredNotes();

interface StoredStudentDoubt {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentProfile: DisabilityProfile;
  teacherId: string;
  teacherName: string;
  classTitle: string;
  signSequence: string[];
  translatedQuestion: string;
  status: 'pending' | 'answered';
  teacherReply?: string;
  repliedAt?: string;
  createdAt: string;
}

const DOUBTS_STORE_PATH = path.join(DATA_DIR, '.educare-doubts.json');

function loadStoredDoubts(): StoredStudentDoubt[] {
  try {
    if (!fs.existsSync(DOUBTS_STORE_PATH)) return [];
    const raw = fs.readFileSync(DOUBTS_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredStudentDoubt[]) : [];
  } catch {
    return [];
  }
}

function saveStoredDoubts(doubts: StoredStudentDoubt[]): void {
  try {
    fs.writeFileSync(DOUBTS_STORE_PATH, JSON.stringify(doubts, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist student doubts file:', err);
  }
}

const storedDoubts: StoredStudentDoubt[] = loadStoredDoubts();

interface StoredChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderProfile?: DisabilityProfile;
  text: string;
  signGlosses?: string[];
  createdAt: string;
}

const CHAT_STORE_PATH = path.join(DATA_DIR, '.educare-chat.json');

function loadStoredChatMessages(): StoredChatMessage[] {
  try {
    if (!fs.existsSync(CHAT_STORE_PATH)) return [];
    const raw = fs.readFileSync(CHAT_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveStoredChatMessages(messages: StoredChatMessage[]): void {
  try {
    fs.writeFileSync(CHAT_STORE_PATH, JSON.stringify(messages, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist chat messages file:', err);
  }
}

function normalizeChatRoomId(raw: unknown): string {
  if (typeof raw !== 'string') return 'classroom-general';
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'classroom-general';
}

const storedChatMessages: StoredChatMessage[] = loadStoredChatMessages();

const USERS_STORE_PATH = path.join(DATA_DIR, '.educare-users.json');
const SESSION_SECRET_PATH = path.join(DATA_DIR, '.educare-session-secret');

function loadOrCreateSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  try {
    if (fs.existsSync(SESSION_SECRET_PATH)) {
      const existing = fs.readFileSync(SESSION_SECRET_PATH, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SESSION_SECRET_PATH, generated, 'utf8');
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_COOKIE = 'educare_session';
const SESSION_SECRET = loadOrCreateSessionSecret();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (typeof storedHash !== 'string') return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, keyHex] = parts;
    if (!salt || !keyHex || keyHex.length % 2 !== 0) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(derived, storedBuf);
  } catch {
    return false;
  }
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accessibilityPref: user.accessibilityPref,
    disabilityProfile: user.disabilityProfile,
    teachingProfiles: user.teachingProfiles,
    subjectSpecialty: user.subjectSpecialty,
    isLoggedIn: user.isLoggedIn,
    lastLoginAt: user.lastLoginAt,
  };
}

function signSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, iat: Date.now() }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as { uid?: string };
    return typeof decoded.uid === 'string' ? decoded.uid : null;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    const first = forwardedProto.split(',')[0].trim().toLowerCase();
    if (first === 'https') return true;
  }
  return req.secure;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE, {
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

const demoSessions = new Map<string, StoredUser>();

function getAuthenticatedUser(req: Request): StoredUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const uid = verifySessionToken(token);
  if (!uid) return null;
  return users.find((u) => u.id === uid) ?? demoSessions.get(uid) ?? null;
}

function saveStoredUsers(userList: StoredUser[]): void {
  try {
    fs.writeFileSync(USERS_STORE_PATH, JSON.stringify(userList, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist users file:', err);
  }
}

function loadStoredUsers(): StoredUser[] {
  let loaded: StoredUser[] = [];
  try {
    if (fs.existsSync(USERS_STORE_PATH)) {
      const raw = fs.readFileSync(USERS_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        loaded = (parsed as StoredUser[]).filter(
          (u) =>
            u &&
            typeof u.id === 'string' &&
            typeof u.email === 'string' &&
            typeof u.passwordHash === 'string'
        );
      }
    } else {
      saveStoredUsers([]);
    }
  } catch {
    loaded = [];
    saveStoredUsers([]);
  }
  return loaded;
}

const users: StoredUser[] = loadStoredUsers();

const examQuestions: ExamQuestion[] = [
  {
    id: 'q1',
    subject: 'Java',
    prompt: 'What is Java?',
    options: [
      { id: 'q1-a', label: 'Operating System', isCorrect: false },
      { id: 'q1-b', label: 'Programming Language', isCorrect: true },
      { id: 'q1-c', label: 'Web Browser', isCorrect: false },
    ],
    explanation:
      'Java is an object-oriented programming language used to build cross-platform software.',
    createdBy: 'Prof. Meera Nair',
  },
  {
    id: 'q2',
    subject: 'Python',
    prompt: 'Which keyword is used to define a reusable function in Python?',
    options: [
      { id: 'q2-a', label: 'def', isCorrect: true },
      { id: 'q2-b', label: 'class', isCorrect: false },
      { id: 'q2-c', label: 'import', isCorrect: false },
    ],
    explanation:
      'The def keyword starts a function definition in Python, followed by the function name and parentheses.',
    createdBy: 'Prof. Meera Nair',
  },
  {
    id: 'q3',
    subject: 'Mathematics',
    prompt: 'If 2x + 4 = 12, what is the value of x?',
    options: [
      { id: 'q3-a', label: '2', isCorrect: false },
      { id: 'q3-b', label: '4', isCorrect: true },
      { id: 'q3-c', label: '8', isCorrect: false },
    ],
    explanation: 'Subtracting 4 gives 2x = 8, and dividing both sides by 2 gives x = 4.',
    createdBy: 'Prof. Meera Nair',
  },
  {
    id: 'q4',
    subject: 'Accessibility',
    prompt: 'Which keyboard key moves focus forward between interactive buttons and controls?',
    options: [
      { id: 'q4-a', label: 'Tab', isCorrect: true },
      { id: 'q4-b', label: 'Escape', isCorrect: false },
      { id: 'q4-c', label: 'Caps Lock', isCorrect: false },
    ],
    explanation:
      'Pressing Tab moves keyboard focus to the next interactive control, while Enter or Space activates it.',
    createdBy: 'Prof. Meera Nair',
  },
];

const liveClasses: LiveClassSession[] = [
  {
    id: 'cls-initial-1',
    title: 'Inclusive Computer Science — Live Q&A',
    subject: 'Computer Science',
    meetingUrl: 'https://meet.jit.si/educare-inclusive-cs-room',
    scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16),
    durationMinutes: 45,
    teacherName: 'Prof. Meera Nair',
    teacherEmail: 'teacher@educare.org',
    captionsEnabled: true,
    notes: 'Live captions and screen-reader accessible chat enabled.',
    createdAt: new Date().toISOString(),
  },
];

const examResults: ExamResultRecord[] = [
  {
    id: 'res-seed-1',
    studentId: 'stu-2',
    studentName: 'Divya Krishnan',
    studentEmail: 'divya@educare.org',
    score: 4,
    totalQuestions: 4,
    percentage: 100,
    submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    extraTimeUsed: true,
  },
  {
    id: 'res-seed-2',
    studentId: 'stu-3',
    studentName: 'Sana Fatima',
    studentEmail: 'sana@educare.org',
    score: 3,
    totalQuestions: 4,
    percentage: 75,
    submittedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    extraTimeUsed: false,
  },
];

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDisabilityProfile(value: unknown): DisabilityProfile | undefined {
  if (
    value === 'standard' ||
    value === 'deaf' ||
    value === 'blind' ||
    value === 'no-hands' ||
    value === 'ocd' ||
    value === 'stammering'
  ) {
    return value;
  }
  return undefined;
}

function parseTeachingProfiles(value: unknown): DisabilityProfile[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed: DisabilityProfile[] = [];
  for (const item of value) {
    const valid = parseDisabilityProfile(item);
    if (valid && !parsed.includes(valid)) {
      parsed.push(valid);
    }
    if (parsed.length >= 6) break;
  }
  return parsed;
}

function formatAccommodation(pref?: AccessibilityPref, profile?: DisabilityProfile): string {
  if (profile === 'deaf') return 'Super-Sonic Hearing (Visual, Captions & Sign)';
  if (profile === 'blind') return 'Master of Shadows (Audio & High Contrast)';
  if (profile === 'no-hands') return 'Look Ma, No Hands! (Voice & Hands-Free)';
  if (profile === 'ocd') return 'High-Energy Fingers (Calm & Structured Flow)';
  if (profile === 'stammering') return 'Secret Code Linguist (Type-to-Speak & Zero-Rush)';
  if (pref === 'large-text') return 'Large Text Mode';
  if (pref === 'voice-nav') return 'Voice Navigation';
  return 'Classic Knowledge Seeker';
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('Origin');
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.vary('Origin');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(origin && !allowedOrigins.includes(origin) ? 403 : 204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/auth/session', (req: Request, res: Response) => {
    const found = getAuthenticatedUser(req);
    if (!found) {
      clearSessionCookie(req, res);
      res.json({ user: null });
      return;
    }
    res.json({ user: toPublicUser(found) });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const body = req.body as {
      email?: unknown;
      password?: unknown;
      role?: unknown;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Please enter both your email address and password.' });
      return;
    }

    const found = users.find((u) => u.email.trim().toLowerCase() === email);
    if (!found) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (found.hasLocalPassword === false) {
      res.status(401).json({
        error:
          'This email was linked with Google Sign-In. Click Continue with Google or register a password first.',
      });
      return;
    }

    if (!verifyPassword(password, found.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    found.isLoggedIn = true;
    found.lastLoginAt = new Date().toISOString();
    saveStoredUsers(users);

    const token = signSessionToken(found.id);
    setSessionCookie(req, res, token);
    res.json({ user: toPublicUser(found) });
  });

  app.post('/api/auth/demo', (req: Request, res: Response) => {
    const body = req.body as { role?: unknown };
    const role: UserRole = body.role === 'teacher' ? 'teacher' : 'student';
    const demoId = role === 'teacher' ? 'demo-teacher-ephemeral' : 'demo-student-ephemeral';
    const demoUser: StoredUser =
      role === 'teacher'
        ? {
            id: demoId,
            name: 'Prof. Meera Nair (Demo)',
            email: 'demo.teacher@educare.local',
            passwordHash: '',
            hasLocalPassword: false,
            role: 'teacher',
            teachingProfiles: ['blind', 'deaf'],
            subjectSpecialty: 'Audio-First STEM & Visual Captions',
            isLoggedIn: true,
            lastLoginAt: new Date().toISOString(),
          }
        : {
            id: demoId,
            name: 'Aarav Sharma (Demo)',
            email: 'demo.student@educare.local',
            passwordHash: '',
            hasLocalPassword: false,
            role: 'student',
            accessibilityPref: 'voice-nav',
            isLoggedIn: true,
            lastLoginAt: new Date().toISOString(),
          };

    demoSessions.set(demoId, demoUser);
    const token = signSessionToken(demoUser.id);
    setSessionCookie(req, res, token);
    res.json({ user: toPublicUser(demoUser) });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const body = req.body as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
      role?: unknown;
      accessibilityPref?: unknown;
      disabilityProfile?: unknown;
      teachingProfiles?: unknown;
      subjectSpecialty?: unknown;
    };

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role: UserRole = body.role === 'teacher' ? 'teacher' : 'student';

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      res.status(400).json({
        error:
          'Provide your full name, a valid email address, and a password of at least 6 characters.',
      });
      return;
    }

    const existing = users.find((u) => u.email.trim().toLowerCase() === email);
    if (existing && existing.hasLocalPassword !== false) {
      res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.',
      });
      return;
    }

    const disabilityProfile: DisabilityProfile | undefined =
      role === 'student' ? parseDisabilityProfile(body.disabilityProfile) ?? 'standard' : undefined;

    const teachingProfiles: DisabilityProfile[] | undefined =
      role === 'teacher'
        ? parseTeachingProfiles(body.teachingProfiles) ?? ['standard']
        : undefined;

    const accessibilityPref: AccessibilityPref | undefined =
      role === 'student'
        ? body.accessibilityPref === 'large-text' || body.accessibilityPref === 'voice-nav'
          ? body.accessibilityPref
          : disabilityProfile === 'blind'
            ? 'large-text'
            : disabilityProfile === 'no-hands'
              ? 'voice-nav'
              : 'standard'
        : undefined;

    const subjectSpecialty =
      role === 'teacher'
        ? typeof body.subjectSpecialty === 'string' && body.subjectSpecialty.trim()
          ? body.subjectSpecialty.trim()
          : 'Inclusive Education'
        : undefined;

    let account: StoredUser;
    if (existing) {
      existing.name = name;
      existing.passwordHash = hashPassword(password);
      existing.hasLocalPassword = true;
      existing.role = role;
      existing.accessibilityPref = accessibilityPref;
      existing.disabilityProfile = disabilityProfile;
      existing.teachingProfiles = teachingProfiles;
      existing.subjectSpecialty = subjectSpecialty;
      existing.isLoggedIn = true;
      existing.lastLoginAt = new Date().toISOString();
      account = existing;
    } else {
      account = {
        id: `${role}-${crypto.randomUUID()}`,
        name,
        email,
        passwordHash: hashPassword(password),
        hasLocalPassword: true,
        role,
        accessibilityPref,
        disabilityProfile,
        teachingProfiles,
        subjectSpecialty,
        isLoggedIn: true,
        lastLoginAt: new Date().toISOString(),
      };
      users.push(account);
    }

    saveStoredUsers(users);
    const token = signSessionToken(account.id);
    setSessionCookie(req, res, token);
    res.status(201).json({ user: toPublicUser(account) });
  });

  app.post('/api/auth/google', (req: Request, res: Response) => {
    const body = req.body as {
      uid?: unknown;
      name?: unknown;
      email?: unknown;
      role?: unknown;
      accessibilityPref?: unknown;
      disabilityProfile?: unknown;
      teachingProfiles?: unknown;
      subjectSpecialty?: unknown;
    };

    const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : email;
    const role: UserRole = body.role === 'teacher' ? 'teacher' : 'student';
    const disabilityProfile =
      role === 'student' ? parseDisabilityProfile(body.disabilityProfile) : undefined;
    const teachingProfiles =
      role === 'teacher' ? parseTeachingProfiles(body.teachingProfiles) : undefined;
    const accessibilityPref: AccessibilityPref | undefined =
      role === 'student'
        ? body.accessibilityPref === 'large-text' || body.accessibilityPref === 'voice-nav'
          ? body.accessibilityPref
          : 'standard'
        : undefined;
    const subjectSpecialty =
      role === 'teacher' && typeof body.subjectSpecialty === 'string' && body.subjectSpecialty.trim()
        ? body.subjectSpecialty.trim().slice(0, 120)
        : undefined;

    if (!uid || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Valid Google account details are required.' });
      return;
    }

    let found = users.find((u) => u.id === uid || u.email.trim().toLowerCase() === email);
    if (!found) {
      found = {
        id: uid,
        name,
        email,
        passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
        hasLocalPassword: false,
        role,
        accessibilityPref,
        disabilityProfile,
        teachingProfiles,
        subjectSpecialty: role === 'teacher' ? subjectSpecialty || 'Inclusive Education' : undefined,
        isLoggedIn: true,
        lastLoginAt: new Date().toISOString(),
      };
      users.push(found);
    } else {
      found.name = name;
      found.role = role;
      if (accessibilityPref) {
        found.accessibilityPref = accessibilityPref;
      }
      if (disabilityProfile) {
        found.disabilityProfile = disabilityProfile;
      }
      if (teachingProfiles && teachingProfiles.length > 0) {
        found.teachingProfiles = teachingProfiles;
      }
      if (subjectSpecialty) {
        found.subjectSpecialty = subjectSpecialty;
      }
      found.isLoggedIn = true;
      found.lastLoginAt = new Date().toISOString();
    }

    saveStoredUsers(users);
    const token = signSessionToken(found.id);
    setSessionCookie(req, res, token);
    res.json({ user: toPublicUser(found) });
  });

  app.patch('/api/auth/preferences', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const body = req.body as {
      disabilityProfile?: unknown;
      teachingProfiles?: unknown;
    };

    const nextProfile = parseDisabilityProfile(body.disabilityProfile);
    if (nextProfile) {
      current.disabilityProfile = nextProfile;
    }

    const nextTeaching = parseTeachingProfiles(body.teachingProfiles);
    if (nextTeaching) {
      current.teachingProfiles = nextTeaching;
    }

    if (!demoSessions.has(current.id)) {
      saveStoredUsers(users);
    }
    res.json({ user: toPublicUser(current) });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (current) {
      if (demoSessions.has(current.id)) {
        demoSessions.delete(current.id);
      } else {
        current.isLoggedIn = false;
        saveStoredUsers(users);
      }
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.delete('/api/auth/login-info', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (current) {
      if (demoSessions.has(current.id)) {
        demoSessions.delete(current.id);
      } else {
        const idx = users.findIndex((u) => u.id === current.id);
        if (idx !== -1) {
          users.splice(idx, 1);
          saveStoredUsers(users);
        }
      }
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // Teacher: Student login status & activity
  app.get('/api/teacher/students', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current || current.role !== 'teacher') {
      res.status(403).json({ error: 'Teacher authorization required.' });
      return;
    }

    const studentRows = users
      .filter((u) => u.role === 'student')
      .map((student) => {
        const studentResults = examResults.filter((r) => r.studentId === student.id);
        const avg =
          studentResults.length > 0
            ? `${Math.round(
                studentResults.reduce((sum, r) => sum + r.percentage, 0) /
                  studentResults.length
              )}%`
            : '—';

        return {
          id: student.id,
          studentName: student.name,
          email: student.email,
          isLoggedIn: student.isLoggedIn,
          lastLoginAt: student.lastLoginAt,
          accommodation: formatAccommodation(student.accessibilityPref, student.disabilityProfile),
          examsCompleted: studentResults.length,
          averageScore: avg,
        };
      });

    res.json({ students: studentRows });
  });

  // Public non-PII Teacher directory for superpower matching in Student Portal
  app.get('/api/teachers', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const teacherRows = users
      .filter((u) => u.role === 'teacher')
      .map((t) => ({
        id: t.id,
        name: t.name,
        subjectSpecialty: t.subjectSpecialty || 'Inclusive Education',
        teachingProfiles:
          t.teachingProfiles && t.teachingProfiles.length > 0 ? t.teachingProfiles : ['standard'],
        isLoggedIn: t.isLoggedIn,
      }));

    res.json({ teachers: teacherRows });
  });

  // Live Online Classes (Readable by authenticated users; created/deleted by Teachers)
  app.get('/api/classes/live', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    res.json({ classes: liveClasses });
  });

  app.post('/api/classes/live', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current || current.role !== 'teacher') {
      res.status(403).json({ error: 'Only teachers can create online class links.' });
      return;
    }

    const body = req.body as {
      title?: unknown;
      subject?: unknown;
      meetingUrl?: unknown;
      scheduledAt?: unknown;
      durationMinutes?: unknown;
      captionsEnabled?: unknown;
      notes?: unknown;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const meetingUrl = typeof body.meetingUrl === 'string' ? body.meetingUrl.trim() : '';
    const scheduledAt =
      typeof body.scheduledAt === 'string' && body.scheduledAt.trim()
        ? body.scheduledAt.trim()
        : new Date().toISOString().slice(0, 16);
    const durationNum = Number(body.durationMinutes);
    const durationMinutes =
      Number.isFinite(durationNum) && durationNum >= 15 && durationNum <= 240
        ? Math.round(durationNum)
        : 45;
    const captionsEnabled = body.captionsEnabled !== false;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    if (!title) {
      res.status(400).json({ error: 'Please enter a class title.' });
      return;
    }

    if (!/^https:\/\/\S+$/i.test(meetingUrl)) {
      res.status(400).json({
        error: 'Please enter or generate a valid HTTPS meeting link (starting with https://).',
      });
      return;
    }

    const created: LiveClassSession = {
      id: `cls-${crypto.randomUUID()}`,
      title,
      subject: subject || 'General',
      meetingUrl,
      scheduledAt,
      durationMinutes,
      teacherName: current.name,
      teacherEmail: current.email,
      captionsEnabled,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    liveClasses.unshift(created);
    res.status(201).json({ liveClass: created, classes: liveClasses });
  });

  app.delete('/api/classes/live/:id', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current || current.role !== 'teacher') {
      res.status(403).json({ error: 'Only teachers can remove online class links.' });
      return;
    }

    const idx = liveClasses.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Online class not found.' });
      return;
    }

    liveClasses.splice(idx, 1);
    res.json({ classes: liveClasses });
  });

  // Persistent Study Notes (Attached by Teachers -> Readable by Students until deleted by Teacher)
  app.get('/api/materials', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    res.json({ materials: storedStudyNotes });
  });

  app.post('/api/materials', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current || current.role !== 'teacher') {
      res.status(403).json({ error: 'Only teachers can publish study notes.' });
      return;
    }

    const body = req.body as {
      id?: unknown;
      title?: unknown;
      subject?: unknown;
      readTime?: unknown;
      content?: unknown;
      fileName?: unknown;
      targetProfiles?: unknown;
    };

    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
    const subject =
      typeof body.subject === 'string' && body.subject.trim()
        ? body.subject.trim().slice(0, 80)
        : 'General';
    const content = typeof body.content === 'string' ? body.content.trim().slice(0, 20000) : '';
    const fileName =
      typeof body.fileName === 'string' && body.fileName.trim()
        ? body.fileName.trim().slice(0, 200)
        : undefined;
    const parsedTargets = parseTeachingProfiles(body.targetProfiles);
    const targetProfiles: DisabilityProfile[] =
      parsedTargets && parsedTargets.length > 0
        ? parsedTargets
        : current.teachingProfiles && current.teachingProfiles.length > 0
          ? current.teachingProfiles
          : ['standard'];

    if (!title || !content) {
      res.status(400).json({ error: 'Provide both a note title and content.' });
      return;
    }

    const readTime =
      typeof body.readTime === 'string' && body.readTime.trim()
        ? body.readTime.trim().slice(0, 40)
        : `${Math.max(1, Math.ceil(content.split(/\s+/).length / 150))} min read`;

    const id =
      typeof body.id === 'string' && /^[a-zA-Z0-9_\-]{1,128}$/.test(body.id)
        ? body.id
        : `note_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const created: StoredStudyNote = {
      id,
      title,
      subject,
      readTime,
      content,
      fileName,
      uploadedBy: current.name,
      teacherUid: current.id,
      targetProfiles,
      source: 'server',
      createdAt: new Date().toISOString().slice(0, 10),
    };

    storedStudyNotes.unshift(created);
    saveStoredNotes(storedStudyNotes);
    res.status(201).json({ material: created, materials: storedStudyNotes });
  });

  app.delete('/api/materials/:id', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current || current.role !== 'teacher') {
      res.status(403).json({ error: 'Only teachers can delete study notes.' });
      return;
    }

    const idx = storedStudyNotes.findIndex((m) => m.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Study note not found.' });
      return;
    }

    storedStudyNotes.splice(idx, 1);
    saveStoredNotes(storedStudyNotes);
    res.json({ materials: storedStudyNotes });
  });

  // Exam Questions (Readable by logged-in users; editable by Teachers)
  app.get('/api/exam/questions', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    res.json({ questions: examQuestions });
  });

  app.post('/api/exam/questions', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current || current.role !== 'teacher') {
      res.status(403).json({ error: 'Only teachers can prepare examination questions.' });
      return;
    }

    const body = req.body as {
      subject?: unknown;
      prompt?: unknown;
      options?: unknown;
      explanation?: unknown;
    };

    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const explanation = typeof body.explanation === 'string' ? body.explanation.trim() : '';
    const rawOptions = Array.isArray(body.options) ? body.options : [];

    const validOptions: ExamOption[] = rawOptions
      .map((opt, idx) => {
        const item = opt as { label?: unknown; isCorrect?: unknown };
        const label = typeof item?.label === 'string' ? item.label.trim() : '';
        return {
          id: `q-${Date.now()}-opt-${idx}`,
          label,
          isCorrect: Boolean(item?.isCorrect),
        };
      })
      .filter((opt) => opt.label.length > 0);

    if (!subject || !prompt || validOptions.length < 2) {
      res.status(400).json({
        error: 'Provide a subject, question text, and at least two answer options.',
      });
      return;
    }

    if (!validOptions.some((opt) => opt.isCorrect)) {
      res.status(400).json({ error: 'Mark one option as the correct answer.' });
      return;
    }

    const created: ExamQuestion = {
      id: `q-${crypto.randomUUID()}`,
      subject,
      prompt,
      options: validOptions,
      explanation: explanation || 'Prepared by your teacher.',
      createdBy: current.name,
    };

    examQuestions.push(created);
    res.status(201).json({ question: created, questions: examQuestions });
  });

  app.delete('/api/exam/questions/:id', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current || current.role !== 'teacher') {
      res.status(403).json({ error: 'Only teachers can remove examination questions.' });
      return;
    }
    const targetId = req.params.id;
    const idx = examQuestions.findIndex((q) => q.id === targetId);
    if (idx === -1) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }
    examQuestions.splice(idx, 1);
    res.json({ questions: examQuestions });
  });

  // Exam Results (Students view own results; Teachers view all students' results)
  app.get('/api/exam/results', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const filtered =
      current.role === 'teacher'
        ? examResults
        : examResults.filter((r) => r.studentId === current.id);

    res.json({ results: [...filtered].reverse() });
  });

  app.post('/api/exam/submit', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const body = req.body as {
      answers?: unknown;
      extraTimeUsed?: unknown;
    };

    const answers =
      body.answers && typeof body.answers === 'object'
        ? (body.answers as Record<string, string>)
        : {};

    if (examQuestions.length === 0) {
      res.status(400).json({ error: 'No examination questions are available right now.' });
      return;
    }

    const score = examQuestions.reduce((total, q) => {
      const picked = q.options.find((opt) => opt.id === answers[q.id]);
      return picked?.isCorrect ? total + 1 : total;
    }, 0);

    const totalQuestions = examQuestions.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    const record: ExamResultRecord = {
      id: `res-${crypto.randomUUID()}`,
      studentId: current.id,
      studentName: current.name,
      studentEmail: current.email,
      score,
      totalQuestions,
      percentage,
      submittedAt: new Date().toISOString(),
      extraTimeUsed: Boolean(body.extraTimeUsed),
    };

    examResults.push(record);
    res.status(201).json({ result: record });
  });

  // AI Tutor
  app.post('/api/tutor', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        question?: unknown;
        language?: unknown;
        role?: unknown;
        mode?: unknown;
        jarvisMode?: unknown;
        history?: unknown;
        signSequence?: unknown;
        imageBase64?: unknown;
        mimeType?: unknown;
      };

      const rawQuestion = typeof body.question === 'string' ? body.question.trim() : '';
      const language = typeof body.language === 'string' ? body.language : 'en';
      const role = body.role === 'teacher' ? 'teacher' : 'student';
      const mode = body.mode === 'sign' ? 'sign' : 'standard';
      const jarvisMode = Boolean(body.jarvisMode);
      const historyTurns = Array.isArray(body.history)
        ? body.history
            .filter(
              (item): item is { question?: unknown; answer?: unknown } =>
                Boolean(item) && typeof item === 'object'
            )
            .slice(0, 5)
            .reverse()
            .map((item) => ({
              q: typeof item.question === 'string' ? item.question.trim() : '',
              a: typeof item.answer === 'string' ? item.answer.trim() : '',
            }))
            .filter((item) => item.q && item.a)
        : [];
      const signSequence = Array.isArray(body.signSequence)
        ? body.signSequence
            .map((s) => (typeof s === 'string' ? s.trim() : ''))
            .filter(Boolean)
            .slice(0, 20)
        : [];
      const imageBase64 =
        typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
      const mimeType =
        typeof body.mimeType === 'string' && body.mimeType.startsWith('image/')
          ? body.mimeType
          : 'image/jpeg';

      const question =
        rawQuestion ||
        (signSequence.length > 0
          ? `Student signed the question: ${signSequence.join(' ')}`
          : imageBase64
            ? 'Student sent a sign language webcam gesture asking for help.'
            : '');

      if (!question) {
        res.status(400).json({ error: 'Please enter, sign, or capture a question first.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable the live Gemini AI Tutor.',
        });
        return;
      }

      const languageLabel =
        language === 'kn' ? 'Kannada' : language === 'hi' ? 'Hindi' : 'English';

      const geminiHistory: Content[] = historyTurns.flatMap((turn) => [
        { role: 'user', parts: [{ text: turn.q }] },
        { role: 'model', parts: [{ text: turn.a }] },
      ]);

      if (mode === 'sign') {
        const signPrompt =
          imageBase64 && signSequence.length > 0
            ? `A deaf student asked a study question using sign glosses [${signSequence.join(' -> ')}] and the attached webcam sign frame. Additional note: "${rawQuestion || 'None'}". Answer in ${languageLabel} both in clear visual text and as a step-by-step Sign Language explanation.`
            : imageBase64
              ? `A deaf student captured this webcam frame signing a study question. Additional note: "${rawQuestion || 'None'}". Interpret their question and answer in ${languageLabel} both in clear visual text and as a step-by-step Sign Language explanation.`
              : `A deaf student asked: "${question}". Answer in ${languageLabel} both in clear visual text and as a step-by-step Sign Language explanation.`;

        const chat: Chat = ai.chats.create({
          model: 'gemini-4-hydrogen',
          history: geminiHistory,
          config: {
            systemInstruction: `You are EduCare's AI Sign Language Personal Learning Tutor for deaf students. Explain academic concepts clearly and encouragingly in ${languageLabel} using 100% visual, sound-free language (never mention listening or audio). Provide: (1) a clear, concise visual explanation with one concrete example (80-140 words), and (2) 5 to 7 sequential Sign Language steps (gloss, motion type from [wave, chin, lift, book, question, circle], meaning, handshape, movement, expression) so an animated sign avatar can perform the entire lesson visually.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                answer: {
                  type: Type.STRING,
                  description:
                    'Clear, encouraging visual explanation with one concrete example (no audio references).',
                },
                signSteps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      gloss: {
                        type: Type.STRING,
                        description: 'Uppercase sign language gloss label (1-3 words).',
                      },
                      motion: {
                        type: Type.STRING,
                        description: 'One of: wave, chin, lift, book, question, circle.',
                      },
                      meaning: {
                        type: Type.STRING,
                        description: 'Short plain meaning of this sign step in the answer.',
                      },
                      handshape: {
                        type: Type.STRING,
                        description: 'Handshape description.',
                      },
                      movement: {
                        type: Type.STRING,
                        description: 'Movement description.',
                      },
                      expression: {
                        type: Type.STRING,
                        description: 'Facial expression / non-manual marker.',
                      },
                    },
                  },
                },
              },
            },
          },
        });

        const messageParts = imageBase64
          ? [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              { text: signPrompt },
            ]
          : signPrompt;

        const response: GenerateContentResponse = await chat.sendMessage({
          message: messageParts,
        });

        const rawJson = response.text?.trim() || '{}';
        let parsed: {
          answer?: string;
          signSteps?: Array<{
            gloss?: string;
            motion?: string;
            meaning?: string;
            handshape?: string;
            movement?: string;
            expression?: string;
          }>;
        } = {};
        try {
          parsed = JSON.parse(rawJson) as typeof parsed;
        } catch {
          parsed = { answer: rawJson };
        }

        const answer = parsed.answer?.trim();
        if (!answer) {
          res
            .status(502)
            .json({ error: 'The AI Sign Tutor returned an empty response. Please try again.' });
          return;
        }

        const validMotions = new Set(['wave', 'chin', 'lift', 'book', 'question', 'circle']);
        const signSteps = Array.isArray(parsed.signSteps)
          ? parsed.signSteps
              .filter((step) => step && typeof step.gloss === 'string' && step.gloss.trim())
              .slice(0, 8)
              .map((step) => ({
                gloss: step.gloss!.trim().toUpperCase(),
                motion: validMotions.has(String(step.motion))
                  ? (step.motion as 'wave' | 'chin' | 'lift' | 'book' | 'question' | 'circle')
                  : 'lift',
                meaning: step.meaning?.trim() || '',
                handshape: step.handshape?.trim() || 'Open dominant hand',
                movement: step.movement?.trim() || 'Articulate smoothly in signing space',
                expression: step.expression?.trim() || 'Clear, attentive facial cue',
              }))
          : [];

        res.json({ answer, signSteps });
        return;
      }

      const systemInstruction =
        role === 'teacher'
          ? `You are EduCare's Inclusive Teaching Assistant. Help educators design accessible lessons, simplified summaries, and adaptive explanations for students with physical disabilities or health conditions. Respond clearly in ${languageLabel} using plain, structured sentences easy to read aloud via screen readers or text-to-speech. Keep answers concise (around 90 to 160 words) with clear bullet points when helpful.`
          : jarvisMode
            ? `You are Jarvis, EduCare's conversational audio-to-audio AI Personal Learning Tutor for a blind student. Speak warmly, directly, and clearly in natural ${languageLabel} prose suitable for text-to-speech. NEVER use markdown formatting, asterisks, bullet symbols, hash headings, or code blocks. Keep each answer concise (around 50 to 95 words) with one vivid spoken example when helpful. Because this is a continuous two-way voice tutoring session, ALWAYS evaluate or respond to what the student just said and end with one short, clear, encouraging question for the student to answer next (either checking their understanding, giving a quick practice prompt, or asking what they want to tackle next).`
            : `You are EduCare's AI Personal Learning Tutor for an inclusive education platform supporting students with physical disabilities and health conditions. Explain academic topics clearly, patiently, and encouragingly in ${languageLabel}. Use simple sentences that work smoothly with text-to-speech screen readers, include one concrete example, and keep explanations concise (around 80 to 150 words).`;

      const chat: Chat = ai.chats.create({
        model: 'gemini-4-hydrogen',
        history: geminiHistory,
        config: {
          systemInstruction,
        },
      });

      const response: GenerateContentResponse = await chat.sendMessage({
        message: question,
      });

      const answer = response.text?.trim();
      if (!answer) {
        res
          .status(502)
          .json({ error: 'The AI Tutor returned an empty response. Please try again.' });
        return;
      }

      res.json({ answer });
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error ? err.message : 'Unable to reach the AI Tutor service.';
      const statusFromErr =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : undefined;

      const isPermissionDenied =
        statusFromErr === 403 ||
        rawMessage.includes('PERMISSION_DENIED') ||
        rawMessage.includes('"code":403');
      const isInvalidKey =
        statusFromErr === 400 &&
        (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('API key'));
      const isRateLimited =
        statusFromErr === 429 ||
        rawMessage.includes('RESOURCE_EXHAUSTED') ||
        rawMessage.includes('"code":429');

      if (isPermissionDenied) {
        res.status(403).json({
          error:
            'The Gemini API free tier is unavailable for the current API key project. Please select a billing-enabled API key in Settings > Secrets.',
        });
        return;
      }

      if (isInvalidKey) {
        res.status(400).json({
          error:
            'The configured GEMINI_API_KEY is invalid. Please check or update your API key in Settings > Secrets.',
        });
        return;
      }

      if (isRateLimited) {
        res.status(429).json({
          error:
            'Gemini API quota limit reached. Please wait a moment or select a billing-enabled API key in Settings > Secrets.',
        });
        return;
      }

      console.error('AI Tutor error:', err);
      res.status(502).json({
        error: 'Unable to reach the Gemini AI Tutor right now. Please try again shortly.',
      });
    }
  });

  // Live Class Sign-Language Doubts (Student -> Assigned Teacher Portal)
  app.get('/api/doubts', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (current.role === 'teacher') {
      const teacherProfiles = current.teachingProfiles ?? ['deaf', 'blind'];
      const assigned = storedDoubts.filter(
        (d) =>
          d.teacherId === current.id ||
          d.teacherName.toLowerCase() === current.name.toLowerCase() ||
          teacherProfiles.includes(d.studentProfile)
      );
      res.json({ doubts: assigned });
      return;
    }

    const mine = storedDoubts.filter((d) => d.studentId === current.id);
    res.json({ doubts: mine });
  });

  app.post('/api/doubts', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const body = req.body as {
      teacherId?: unknown;
      teacherName?: unknown;
      classTitle?: unknown;
      signSequence?: unknown;
      translatedQuestion?: unknown;
    };

    const teacherId = typeof body.teacherId === 'string' ? body.teacherId.trim() : '';
    const teacherName =
      typeof body.teacherName === 'string' && body.teacherName.trim()
        ? body.teacherName.trim()
        : 'Assigned Teacher';
    const classTitle =
      typeof body.classTitle === 'string' && body.classTitle.trim()
        ? body.classTitle.trim()
        : 'Live Online Class';
    const signSequence = Array.isArray(body.signSequence)
      ? body.signSequence
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
          .slice(0, 20)
      : [];
    const translatedQuestion =
      typeof body.translatedQuestion === 'string' ? body.translatedQuestion.trim() : '';

    if (!translatedQuestion) {
      res.status(400).json({
        error: 'Build a sign sequence or capture a sign before sending your doubt.',
      });
      return;
    }

    const created: StoredStudentDoubt = {
      id: `dbt-${crypto.randomUUID()}`,
      studentId: current.id,
      studentName: current.name,
      studentEmail: current.email,
      studentProfile: current.disabilityProfile ?? 'deaf',
      teacherId: teacherId || 'teacher-assigned',
      teacherName,
      classTitle,
      signSequence,
      translatedQuestion,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    storedDoubts.unshift(created);
    saveStoredDoubts(storedDoubts);
    res.status(201).json({ doubt: created });
  });

  app.patch('/api/doubts/:id/reply', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current || current.role !== 'teacher') {
      res.status(403).json({ error: 'Only teachers can reply to student doubts.' });
      return;
    }

    const { id } = req.params;
    const body = req.body as { reply?: unknown };
    const reply = typeof body.reply === 'string' ? body.reply.trim() : '';
    if (!reply) {
      res.status(400).json({ error: 'Please enter a reply for the student.' });
      return;
    }

    const target = storedDoubts.find((d) => d.id === id);
    if (!target) {
      res.status(404).json({ error: 'Doubt not found.' });
      return;
    }

    target.teacherReply = reply;
    target.status = 'answered';
    target.repliedAt = new Date().toISOString();
    saveStoredDoubts(storedDoubts);
    res.json({ doubt: target });
  });

  // AI Sign Language Translator (Camera frame or Sign Sequence -> Natural Language)
  app.post('/api/sign/translate', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        signSequence?: unknown;
        imageBase64?: unknown;
        mimeType?: unknown;
        language?: unknown;
        classTitle?: unknown;
      };

      const signSequence = Array.isArray(body.signSequence)
        ? body.signSequence
            .map((s) => (typeof s === 'string' ? s.trim() : ''))
            .filter(Boolean)
        : [];
      const imageBase64 =
        typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
      const mimeType =
        typeof body.mimeType === 'string' && body.mimeType.startsWith('image/')
          ? body.mimeType
          : 'image/jpeg';
      const language = typeof body.language === 'string' ? body.language : 'en';
      const classTitle =
        typeof body.classTitle === 'string' && body.classTitle.trim()
          ? body.classTitle.trim()
          : 'Live Class';

      if (signSequence.length === 0 && !imageBase64) {
        res.status(400).json({
          error: 'Provide a sign language sequence or capture a camera frame first.',
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to use AI camera sign translation.',
        });
        return;
      }

      const languageLabel =
        language === 'kn' ? 'Kannada' : language === 'hi' ? 'Hindi' : 'English';

      const promptText =
        imageBase64 && signSequence.length > 0
          ? `A deaf student in the live class "${classTitle}" signed the gloss sequence [${signSequence.join(' -> ')}] and also captured the attached webcam frame of their sign gesture. Translate their sign language doubt into one clear, polite, natural-language question in ${languageLabel} to send to their teacher. Output ONLY the translated question.`
          : imageBase64
            ? `A deaf student in the live class "${classTitle}" captured this webcam frame showing a sign language gesture to ask a doubt. Identify the hand gesture / facial cue and translate it into one clear, polite classroom question in ${languageLabel} for their teacher. Output ONLY the translated question.`
            : `A deaf student in the live class "${classTitle}" signed the following sign language gloss sequence: [${signSequence.join(' -> ')}]. Translate this sign language sequence into one clear, polite, natural-language question in ${languageLabel} to send to their teacher. Output ONLY the translated question.`;

      const contents = imageBase64
        ? {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              { text: promptText },
            ],
          }
        : promptText;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction:
            'You are a professional Sign Language Interpreter for an inclusive classroom. Convert student sign language glosses or sign webcam frames into a single clear, respectful question for their teacher. Return only the translated sentence without quotes or extra commentary.',
        },
      });

      const translatedQuestion = response.text?.trim();
      if (!translatedQuestion) {
        res.status(502).json({
          error: 'AI Sign Translator returned an empty response. Please try again.',
        });
        return;
      }

      res.json({ translatedQuestion });
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error ? err.message : 'Unable to reach the AI Sign Translator.';
      const statusFromErr =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : undefined;

      if (
        statusFromErr === 403 ||
        rawMessage.includes('PERMISSION_DENIED') ||
        rawMessage.includes('"code":403')
      ) {
        res.status(403).json({
          error:
            'AI camera/Gemini translation requires a billing-enabled GEMINI_API_KEY in Settings > Secrets. You can still use the instant Sign Sequence Translator below.',
        });
        return;
      }

      console.error('AI Sign Translator error:', err);
      res.status(502).json({
        error: 'Unable to reach the AI Sign Translator right now.',
      });
    }
  });

  // Real-Time Classroom Chat REST Endpoints (for initial sync & resilient delivery)
  interface ChatSocketMeta {
    ws: WebSocket;
    user: StoredUser;
    roomId: string;
  }

  const chatRoomClients = new Map<string, Set<ChatSocketMeta>>();

  function getRoomParticipants(roomId: string) {
    const clients = chatRoomClients.get(roomId);
    if (!clients) return [];
    const seen = new Map<
      string,
      { id: string; name: string; role: UserRole; disabilityProfile?: DisabilityProfile }
    >();
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN && !seen.has(client.user.id)) {
        seen.set(client.user.id, {
          id: client.user.id,
          name: client.user.name,
          role: client.user.role,
          disabilityProfile: client.user.disabilityProfile,
        });
      }
    }
    return Array.from(seen.values());
  }

  function broadcastToChatRoom(roomId: string, payload: unknown, excludeWs?: WebSocket): void {
    const clients = chatRoomClients.get(roomId);
    if (!clients) return;
    const serialized = JSON.stringify(payload);
    for (const client of clients) {
      if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(serialized);
      }
    }
  }

  function appendAndBroadcastChatMessage(
    user: StoredUser,
    roomId: string,
    text: string,
    signGlosses?: string[],
    clientMsgId?: string
  ): StoredChatMessage {
    const trimmedId =
      typeof clientMsgId === 'string' && clientMsgId.trim()
        ? clientMsgId.trim().slice(0, 80)
        : '';
    if (trimmedId) {
      const existing = storedChatMessages.find(
        (m) => m.id === trimmedId && m.roomId === roomId
      );
      if (existing) return existing;
    }

    const message: StoredChatMessage = {
      id: trimmedId || `msg-${crypto.randomUUID()}`,
      roomId,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      senderProfile: user.disabilityProfile,
      text: text.trim().slice(0, 1500),
      signGlosses:
        Array.isArray(signGlosses) && signGlosses.length > 0
          ? signGlosses.map((g) => g.trim()).filter(Boolean).slice(0, 16)
          : undefined,
      createdAt: new Date().toISOString(),
    };

    storedChatMessages.push(message);
    if (storedChatMessages.length > 500) {
      storedChatMessages.splice(0, storedChatMessages.length - 500);
    }
    saveStoredChatMessages(storedChatMessages);

    broadcastToChatRoom(roomId, {
      type: 'chat:message',
      roomId,
      message,
    });

    return message;
  }

  app.get('/api/chat/rooms', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const roomDefs: Array<{ id: string; label: string }> = [
      { id: 'classroom-general', label: 'General Inclusive Classroom' },
      { id: 'teacher-support', label: 'Teacher & Student Support Desk' },
      ...liveClasses.map((cls) => ({
        id: normalizeChatRoomId(cls.id),
        label: cls.title,
      })),
    ];

    const seenIds = new Set<string>();
    const rooms = roomDefs
      .filter((r) => {
        if (seenIds.has(r.id)) return false;
        seenIds.add(r.id);
        return true;
      })
      .map((r) => ({
        id: r.id,
        label: r.label,
        messageCount: storedChatMessages.filter((m) => m.roomId === r.id).length,
        activeUsers: getRoomParticipants(r.id).length,
      }));

    res.json({ rooms });
  });

  app.get('/api/chat/rooms/:roomId/messages', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const roomId = normalizeChatRoomId(req.params.roomId);
    const messages = storedChatMessages.filter((m) => m.roomId === roomId).slice(-100);
    res.json({
      roomId,
      messages,
      participants: getRoomParticipants(roomId),
    });
  });

  app.post('/api/chat/rooms/:roomId/messages', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const roomId = normalizeChatRoomId(req.params.roomId);
    const body = req.body as { text?: unknown; signGlosses?: unknown; id?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'Message text cannot be empty.' });
      return;
    }
    const signGlosses = Array.isArray(body.signGlosses)
      ? body.signGlosses.filter((g): g is string => typeof g === 'string')
      : undefined;
    const clientMsgId = typeof body.id === 'string' ? body.id : undefined;

    const created = appendAndBroadcastChatMessage(
      current,
      roomId,
      text,
      signGlosses,
      clientMsgId
    );
    res.status(201).json({ message: created });
  });

  // Nexconn App Key Config & Server-Side Access Token Issuance Proxy
  type NexconnRegionCode = 'SG' | 'NA' | 'SA' | 'BJ' | 'OM';

  function resolveNexconnAreaCode(raw: string | undefined): NexconnRegionCode {
    const normalized = (raw || 'SG').trim().toUpperCase();
    if (normalized === 'NA' || normalized === 'US' || normalized === 'NORTH_AMERICA') return 'NA';
    if (normalized === 'SA' || normalized === 'SOUTH_AMERICA' || normalized === 'SAU') return 'SA';
    if (normalized === 'BJ' || normalized === 'CN') return 'BJ';
    if (normalized === 'OM') return 'OM';
    return 'SG';
  }

  function getNexconnApiHosts(areaCode: NexconnRegionCode): string[] {
    switch (areaCode) {
      case 'NA':
        return ['api.us-light-api.com', 'api-b.us-light-api.com'];
      case 'SA':
        return ['api.sau-light-api.com', 'api-b.sau-light-api.com'];
      case 'BJ':
        return ['api.cn-bj-api.com', 'api-b.cn-bj-api.com'];
      case 'OM':
        return ['api.om-light-api.com', 'api-b.om-light-api.com'];
      case 'SG':
      default:
        return ['api.sg-light-api.com', 'api-b.sg-light-api.com'];
    }
  }

  function getNexconnServerCredentials() {
    const appKey = (process.env.NEXCONN_APP_KEY || process.env.VITE_NEXCONN_APP_KEY || '').trim();
    const appSecret = (process.env.NEXCONN_APP_SECRET || '').trim();
    const areaCode = resolveNexconnAreaCode(
      process.env.NEXCONN_AREA_CODE || process.env.VITE_NEXCONN_AREA_CODE
    );
    return { appKey, appSecret, areaCode };
  }

  function toNexconnUserId(rawId: string): string {
    const cleaned = rawId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
    return cleaned || 'educareUser1';
  }

  const nexconnTokenCache = new Map<
    string,
    { userId: string; token: string; areaCode: NexconnRegionCode; issuedAt: number }
  >();

  app.get('/api/nexconn/config', (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const { appKey, appSecret, areaCode } = getNexconnServerCredentials();
    res.json({
      configured: Boolean(appKey),
      appKey: appKey || null,
      areaCode,
      tokenServerReady: Boolean(appKey && appSecret),
    });
  });

  app.post('/api/nexconn/token', async (req: Request, res: Response) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const { appKey, appSecret, areaCode } = getNexconnServerCredentials();
    if (!appKey || !appSecret) {
      res.status(503).json({
        configured: Boolean(appKey),
        appKey: appKey || null,
        areaCode,
        tokenServerReady: false,
        error:
          'Nexconn App Key and App Secret are not configured on the server. Add NEXCONN_APP_KEY and NEXCONN_APP_SECRET in environment secrets.',
      });
      return;
    }

    const body = (req.body || {}) as { forceRefresh?: unknown };
    const forceRefresh = Boolean(body.forceRefresh);
    const nexconnUserId = toNexconnUserId(current.id);
    const cacheKey = `${appKey}:${areaCode}:${nexconnUserId}`;

    if (!forceRefresh) {
      const cached = nexconnTokenCache.get(cacheKey);
      if (cached) {
        res.json({
          configured: true,
          appKey,
          areaCode,
          userId: cached.userId,
          token: cached.token,
          cached: true,
        });
        return;
      }
    }

    const hosts = getNexconnApiHosts(areaCode);
    let lastErrorMessage = 'Unable to issue Nexconn access token.';
    let lastStatus = 502;

    for (const host of hosts) {
      const nonce = crypto.randomBytes(9).toString('hex'); // 18 chars max per spec
      const timestamp = String(Date.now());
      const signature = crypto
        .createHash('sha1')
        .update(appSecret + nonce + timestamp)
        .digest('hex');
      const requestId = crypto.randomUUID().replace(/-/g, '');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const apiRes = await fetch(`https://${host}/v4/auth/access-token/issue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'App-Key': appKey,
            Nonce: nonce,
            Timestamp: timestamp,
            Signature: signature,
            'X-Request-ID': requestId,
          },
          body: JSON.stringify({
            userId: nexconnUserId,
            name: (current.name || 'EduCare User').trim().slice(0, 64),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const rawText = await apiRes.text();
        interface NexconnAccessTokenApiResponse {
          code?: number;
          msg?: string;
          message?: string;
          result?: { userId?: string; accessToken?: string };
        }
        let parsed: NexconnAccessTokenApiResponse | null = null;
        try {
          parsed = rawText ? (JSON.parse(rawText) as NexconnAccessTokenApiResponse) : null;
        } catch {
          parsed = null;
        }

        if (apiRes.ok && parsed && parsed.code === 0 && parsed.result?.accessToken) {
          const issuedToken = parsed.result.accessToken;
          const resolvedUserId = parsed.result.userId || nexconnUserId;
          nexconnTokenCache.set(cacheKey, {
            userId: resolvedUserId,
            token: issuedToken,
            areaCode,
            issuedAt: Date.now(),
          });
          res.json({
            configured: true,
            appKey,
            areaCode,
            userId: resolvedUserId,
            token: issuedToken,
            cached: false,
          });
          return;
        }

        lastStatus = apiRes.status >= 400 && apiRes.status < 600 ? apiRes.status : 502;
        lastErrorMessage =
          parsed?.msg ||
          parsed?.message ||
          `Nexconn token API returned HTTP ${apiRes.status}`;

        // Do not retry backup host on client credential errors (e.g., invalid AppKey/Signature)
        if (apiRes.status >= 400 && apiRes.status < 500) {
          break;
        }
      } catch (err: unknown) {
        clearTimeout(timeout);
        lastStatus = 502;
        lastErrorMessage =
          err instanceof Error ? `Nexconn network error: ${err.message}` : lastErrorMessage;
      }
    }

    res.status(lastStatus).json({
      configured: true,
      appKey,
      areaCode,
      tokenServerReady: true,
      error: lastErrorMessage,
    });
  });

  const httpServer = http.createServer(app);
  const chatWss = new WebSocketServer({ noServer: true });

  chatWss.on('connection', (ws: WebSocket, user: StoredUser, initialRoomId: string) => {
    const meta: ChatSocketMeta = { ws, user, roomId: initialRoomId };

    const joinRoom = (nextRoomId: string) => {
      const prevRoom = meta.roomId;
      if (prevRoom && chatRoomClients.has(prevRoom)) {
        chatRoomClients.get(prevRoom)!.delete(meta);
        broadcastToChatRoom(prevRoom, {
          type: 'chat:presence',
          roomId: prevRoom,
          participants: getRoomParticipants(prevRoom),
        });
      }

      meta.roomId = nextRoomId;
      if (!chatRoomClients.has(nextRoomId)) {
        chatRoomClients.set(nextRoomId, new Set());
      }
      chatRoomClients.get(nextRoomId)!.add(meta);

      const history = storedChatMessages.filter((m) => m.roomId === nextRoomId).slice(-100);
      ws.send(
        JSON.stringify({
          type: 'chat:sync',
          roomId: nextRoomId,
          messages: history,
          participants: getRoomParticipants(nextRoomId),
        })
      );

      broadcastToChatRoom(
        nextRoomId,
        {
          type: 'chat:presence',
          roomId: nextRoomId,
          participants: getRoomParticipants(nextRoomId),
        },
        ws
      );
    };

    joinRoom(initialRoomId);

    ws.on('message', (rawBuf) => {
      try {
        const parsed = JSON.parse(rawBuf.toString('utf8')) as {
          type?: string;
          roomId?: unknown;
          text?: unknown;
          signGlosses?: unknown;
          id?: unknown;
          isTyping?: unknown;
        };

        if (parsed.type === 'chat:ping') {
          ws.send(JSON.stringify({ type: 'chat:pong', ts: Date.now() }));
          return;
        }

        if (parsed.type === 'chat:join') {
          joinRoom(normalizeChatRoomId(parsed.roomId));
          return;
        }

        if (parsed.type === 'chat:typing') {
          const targetRoom = normalizeChatRoomId(parsed.roomId ?? meta.roomId);
          broadcastToChatRoom(
            targetRoom,
            {
              type: 'chat:typing',
              roomId: targetRoom,
              userId: user.id,
              userName: user.name,
              isTyping: Boolean(parsed.isTyping),
            },
            ws
          );
          return;
        }

        if (parsed.type === 'chat:send') {
          const targetRoom = normalizeChatRoomId(parsed.roomId ?? meta.roomId);
          const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
          if (!text) return;
          const signGlosses = Array.isArray(parsed.signGlosses)
            ? parsed.signGlosses.filter((g): g is string => typeof g === 'string')
            : undefined;
          const clientMsgId = typeof parsed.id === 'string' ? parsed.id : undefined;

          appendAndBroadcastChatMessage(user, targetRoom, text, signGlosses, clientMsgId);
        }
      } catch {
        // Ignore malformed client frames
      }
    });

    ws.on('close', () => {
      const roomSet = chatRoomClients.get(meta.roomId);
      if (roomSet) {
        roomSet.delete(meta);
        if (roomSet.size === 0) {
          chatRoomClients.delete(meta.roomId);
        } else {
          broadcastToChatRoom(meta.roomId, {
            type: 'chat:presence',
            roomId: meta.roomId,
            participants: getRoomParticipants(meta.roomId),
          });
        }
      }
    });
  });

  httpServer.on('upgrade', (req, socket, head) => {
    const reqUrl = req.url || '';
    if (!reqUrl.startsWith('/ws/chat')) {
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    const uid = token ? verifySessionToken(token) : null;
    const authUser = uid ? users.find((u) => u.id === uid) ?? demoSessions.get(uid) ?? null : null;

    if (!authUser) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    let initialRoom = 'classroom-general';
    try {
      const parsedUrl = new URL(reqUrl, `http://${req.headers.host || 'localhost'}`);
      initialRoom = normalizeChatRoomId(parsedUrl.searchParams.get('roomId'));
    } catch {
      initialRoom = 'classroom-general';
    }

    chatWss.handleUpgrade(req, socket, head, (ws) => {
      chatWss.emit('connection', ws, authUser, initialRoom);
    });
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    console.error('API middleware error:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Server error while processing request. Please try again.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`EduCare server listening on http://${HOST}:${PORT}`);
  });

  const shutdown = () => {
    httpServer.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start EduCare server:', err);
  process.exit(1);
});
