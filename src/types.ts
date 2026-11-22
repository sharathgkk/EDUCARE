export type UserRole = 'student' | 'teacher';

export type ThemeMode = 'light' | 'dark';

export type ContrastPreset =
  | 'default'
  | 'soft-blue'
  | 'high-contrast-dark'
  | 'yellow-on-black'
  | 'dyslexia-pastel';

export type LanguageCode = 'en' | 'kn' | 'hi';

export type SectionId =
  | 'home'
  | 'classes'
  | 'materials'
  | 'tutor'
  | 'access'
  | 'sign'
  | 'exam'
  | 'teacher';

export type AccessibilityPref = 'standard' | 'large-text' | 'voice-nav';

export type DisabilityProfile =
  | 'standard'
  | 'deaf'
  | 'blind'
  | 'no-hands'
  | 'ocd'
  | 'stammering';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessibilityPref?: AccessibilityPref;
  disabilityProfile?: DisabilityProfile;
  teachingProfiles?: DisabilityProfile[];
  subjectSpecialty?: string;
  lastLoginAt?: string | null;
  isLoggedIn?: boolean;
  photoURL?: string;
  authProvider?: 'local' | 'google';
  loginCount?: number;
}

export interface LoginLogRecord {
  id: string;
  email: string;
  displayName: string;
  portalRole: UserRole;
  authProvider: 'google';
  status: 'active' | 'signed_out';
  loggedInAt: string;
  signedOutAt: string | null;
}

export interface StudyMaterial {
  id: string;
  title: string;
  subject: string;
  readTime: string;
  content: string;
  fileName?: string;
  uploadedBy?: string;
  teacherUid?: string;
  targetProfiles?: DisabilityProfile[];
  source?: 'firestore' | 'server' | 'seed';
  createdAt: string;
}

export interface MatchedTeacher {
  id: string;
  name: string;
  subjectSpecialty: string;
  teachingProfiles: DisabilityProfile[];
  isLoggedIn: boolean;
}

export interface RecordedLesson {
  id: string;
  title: string;
  subject: string;
  duration: string;
  instructor: string;
  captionsAvailable: boolean;
  transcript: string;
}

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  details: string;
  createdBy: string;
}

export interface ExamOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface ExamQuestion {
  id: string;
  subject: string;
  prompt: string;
  options: ExamOption[];
  explanation: string;
  createdBy?: string;
}

export interface ExamResultRecord {
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

export interface StudentStatusRecord {
  id: string;
  studentName: string;
  email: string;
  isLoggedIn: boolean;
  lastLoginAt: string | null;
  accommodation: string;
  examsCompleted: number;
  averageScore: string;
}

export interface SignLesson {
  id: string;
  word: string;
  category: string;
  summary: string;
  steps: string[];
  gestureType: 'hello' | 'thankyou' | 'help' | 'communication' | 'yes' | 'question';
}

export interface LiveClassSession {
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

export interface StudentDoubt {
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

export type ChatConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'unauthorized';

export interface ChatParticipant {
  id: string;
  name: string;
  role: UserRole;
  disabilityProfile?: DisabilityProfile;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderProfile?: DisabilityProfile;
  text: string;
  signGlosses?: string[];
  createdAt: string;
  pending?: boolean;
}

export interface ChatRoomInfo {
  id: string;
  label: string;
  messageCount: number;
  activeUsers: number;
}
