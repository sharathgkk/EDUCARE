import React, { useState } from 'react';
import {
  Award,
  BookPlus,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  Hand,
  Link2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  Users,
  Video,
} from 'lucide-react';
import type {
  Assignment,
  ContrastPreset,
  DisabilityProfile,
  LanguageCode,
  LiveClassSession,
  SectionId,
  StudentDoubt,
  StudentStatusRecord,
  StudyMaterial,
  UserAccount,
} from '../../types';
import { DISABILITY_SUPPORT_OPTIONS } from '../../data/educareData';
import { apiFetch } from '../../services/api';
import { SuperpowerStudio } from '../SuperpowerStudio';
import { ClassroomChatPanel } from '../ClassroomChatPanel';

interface TeacherSectionProps {
  user: UserAccount;
  language: LanguageCode;
  fontSize: number;
  contrast: ContrastPreset;
  voiceStatus: string;
  publishedClassLink: string;
  liveClasses: LiveClassSession[];
  materials: StudyMaterial[];
  assignmentsCount: number;
  resultsCount: number;
  studentStatuses: StudentStatusRecord[];
  studentDoubts: StudentDoubt[];
  onDoubtReplied: (updated: StudentDoubt) => void;
  onRefreshStatuses: () => Promise<void>;
  onOpenExamTab: (tab: 'results' | 'prepare') => void;
  onPublishClassLink: (link: string) => void;
  onLiveClassesUpdated: (classes: LiveClassSession[]) => void;
  onAddMaterial: (input: {
    title: string;
    subject: string;
    readTime: string;
    content: string;
    fileName?: string;
    targetProfiles?: DisabilityProfile[];
  }) => Promise<void>;
  onDeleteMaterial: (material: StudyMaterial) => Promise<void>;
  onAddAssignment: (assignment: Assignment) => void;
  onUpdateTeachingProfiles: (profiles: DisabilityProfile[]) => void;
  onNavigate: (section: SectionId) => void;
  onStartVoiceNav: () => void;
  onReadPage: () => void;
  onChangeFontSize: (size: number) => void;
  onChangeContrast: (preset: ContrastPreset) => void;
}

export const TeacherSection: React.FC<TeacherSectionProps> = ({
  user,
  language,
  fontSize,
  contrast,
  voiceStatus,
  publishedClassLink,
  liveClasses,
  materials,
  assignmentsCount,
  resultsCount,
  studentStatuses,
  studentDoubts,
  onDoubtReplied,
  onRefreshStatuses,
  onOpenExamTab,
  onPublishClassLink,
  onLiveClassesUpdated,
  onAddMaterial,
  onDeleteMaterial,
  onAddAssignment,
  onUpdateTeachingProfiles,
  onNavigate,
  onStartVoiceNav,
  onReadPage,
  onChangeFontSize,
  onChangeContrast,
}) => {
  const teacherProfiles: DisabilityProfile[] =
    user.teachingProfiles && user.teachingProfiles.length > 0
      ? user.teachingProfiles
      : ['deaf', 'blind'];
  const [activeTeachingPower, setActiveTeachingPower] = useState<DisabilityProfile>(
    teacherProfiles[0] ?? 'deaf'
  );

  const handleToggleTeachingPower = (id: DisabilityProfile) => {
    const exists = teacherProfiles.includes(id);
    if (exists && teacherProfiles.length === 1) return;
    const next = exists
      ? teacherProfiles.filter((item) => item !== id)
      : [...teacherProfiles, id];
    onUpdateTeachingProfiles(next);
    if (!exists) {
      setActiveTeachingPower(id);
    } else if (activeTeachingPower === id) {
      setActiveTeachingPower(next[0] ?? 'standard');
    }
  };
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialSubject, setMaterialSubject] = useState('Computer Science');
  const [materialBody, setMaterialBody] = useState('');
  const [noteTargets, setNoteTargets] = useState<DisabilityProfile[]>(() => [
    teacherProfiles[0] ?? 'blind',
  ]);
  const [noteSaving, setNoteSaving] = useState(false);

  const toggleNoteTarget = (id: DisabilityProfile) => {
    setNoteTargets((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const getPowerTitle = (id: DisabilityProfile) =>
    DISABILITY_SUPPORT_OPTIONS.find((opt) => opt.id === id)?.funnyTitle ?? id;
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const teacherPublishedNotes = materials.filter((m) => m.source !== 'seed');

  const [classTitle, setClassTitle] = useState('');
  const [classSubject, setClassSubject] = useState('Computer Science');
  const [classScheduledAt, setClassScheduledAt] = useState(() =>
    new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [classDuration, setClassDuration] = useState<number>(45);
  const [classLinkInput, setClassLinkInput] = useState(publishedClassLink);
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(true);
  const [classNotes, setClassNotes] = useState('');
  const [classSaving, setClassSaving] = useState<boolean>(false);
  const [classLinkStatus, setClassLinkStatus] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [asgTitle, setAsgTitle] = useState('');
  const [asgSubject, setAsgSubject] = useState('Computer Science');
  const [asgDueDate, setAsgDueDate] = useState('2026-11-28');
  const [asgDetails, setAsgDetails] = useState('');
  const [asgStatus, setAsgStatus] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState('');

  const handleReplyDoubt = async (doubtId: string) => {
    const reply = (replyDrafts[doubtId] || '').trim();
    if (!reply) return;
    setReplyingId(doubtId);
    setReplyError('');
    try {
      const res = await apiFetch(`/api/doubts/${encodeURIComponent(doubtId)}/reply`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reply }),
      });
      const data = (await res.json()) as { doubt?: StudentDoubt; error?: string };
      if (!res.ok || !data.doubt) {
        setReplyError(data.error || 'Could not send reply.');
        return;
      }
      onDoubtReplied(data.doubt);
      setReplyDrafts((prev) => ({ ...prev, [doubtId]: '' }));
    } catch {
      setReplyError('Network error while sending reply.');
    } finally {
      setReplyingId(null);
    }
  };

  const formatLoginTime = (iso: string | null) => {
    if (!iso) return 'Not logged in yet';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadStatus(null);
    if (!file) return;

    if (!materialTitle.trim()) {
      setMaterialTitle(file.name.replace(/\.[^.]+$/, ''));
    }

    if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) {
      const text = await file.text();
      setMaterialBody(text);
    }
  };

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = materialTitle.trim() || selectedFile?.name || '';
    const content =
      materialBody.trim() ||
      (selectedFile ? `Uploaded study resource: ${selectedFile.name}` : '');

    if (!title || !content) {
      setUploadStatus({
        type: 'err',
        text: 'Select a text file or enter a note title and content first.',
      });
      return;
    }

    const effectiveTargets = noteTargets.filter((id) => teacherProfiles.includes(id));
    const finalTargets =
      effectiveTargets.length > 0 ? effectiveTargets : [activeTeachingPower];

    setNoteSaving(true);
    setUploadStatus(null);
    try {
      await onAddMaterial({
        title,
        subject: materialSubject.trim() || 'General',
        readTime: `${Math.max(1, Math.ceil(content.split(/\s+/).length / 150))} min read`,
        content,
        fileName: selectedFile?.name,
        targetProfiles: finalTargets,
      });

      setUploadStatus({
        type: 'ok',
        text: `Saved "${title}" for ${finalTargets.map(getPowerTitle).join(', ')}. It will remain in those students' portals until you delete it.`,
      });
      setSelectedFile(null);
      setMaterialTitle('');
      setMaterialBody('');
    } catch {
      setUploadStatus({
        type: 'err',
        text: 'Could not save study note to the database. Please try again.',
      });
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async (material: StudyMaterial) => {
    setDeletingNoteId(material.id);
    setUploadStatus(null);
    try {
      await onDeleteMaterial(material);
      setUploadStatus({
        type: 'ok',
        text: `Deleted "${material.title}" from the database and Student Portal.`,
      });
    } catch {
      setUploadStatus({
        type: 'err',
        text: 'Unable to delete this note. Only the publishing teacher can remove it.',
      });
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleGenerateRoomLink = () => {
    const baseSlug = (classTitle.trim() || classSubject.trim() || 'educare-live')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 28);
    const suffix = Math.random().toString(36).slice(2, 7);
    const generated = `https://meet.jit.si/educare-${baseSlug || 'room'}-${suffix}`;
    setClassLinkInput(generated);
    setClassLinkStatus({
      type: 'ok',
      text: `Generated instant classroom link: ${generated}`,
    });
  };

  const handleCopyClassLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      setClassLinkStatus({
        type: 'err',
        text: 'Clipboard access blocked. Please copy the URL from the input field.',
      });
    }
  };

  const handleCreateLiveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = classTitle.trim();
    const trimmedUrl = classLinkInput.trim();

    if (!title) {
      setClassLinkStatus({
        type: 'err',
        text: 'Please enter a class title (for example, "Python Accessibility Workshop").',
      });
      return;
    }

    if (!/^https:\/\/\S+$/i.test(trimmedUrl)) {
      setClassLinkStatus({
        type: 'err',
        text: 'Enter a valid HTTPS link or click "Generate Instant Link".',
      });
      return;
    }

    setClassSaving(true);
    setClassLinkStatus(null);
    try {
      const res = await apiFetch('/api/classes/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          subject: classSubject.trim() || 'General',
          meetingUrl: trimmedUrl,
          scheduledAt: classScheduledAt,
          durationMinutes: classDuration,
          captionsEnabled,
          notes: classNotes.trim(),
        }),
      });
      const data = (await res.json()) as {
        classes?: LiveClassSession[];
        liveClass?: LiveClassSession;
        error?: string;
      };
      if (!res.ok || !data.classes) {
        setClassLinkStatus({
          type: 'err',
          text: data.error || 'Could not create online class link.',
        });
        return;
      }

      onLiveClassesUpdated(data.classes);
      onPublishClassLink(trimmedUrl);
      setClassLinkStatus({
        type: 'ok',
        text: `Online class "${title}" created and published to all students.`,
      });
      setClassTitle('');
      setClassNotes('');
    } catch {
      setClassLinkStatus({
        type: 'err',
        text: 'Network error while saving the online class link.',
      });
    } finally {
      setClassSaving(false);
    }
  };

  const handleDeleteLiveClass = async (id: string) => {
    try {
      const res = await apiFetch(`/api/classes/live/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await res.json()) as { classes?: LiveClassSession[]; error?: string };
      if (!res.ok || !data.classes) {
        setClassLinkStatus({
          type: 'err',
          text: data.error || 'Unable to remove online class.',
        });
        return;
      }
      onLiveClassesUpdated(data.classes);
      if (data.classes[0]?.meetingUrl) {
        onPublishClassLink(data.classes[0].meetingUrl);
      }
    } catch {
      setClassLinkStatus({
        type: 'err',
        text: 'Network error while removing online class.',
      });
    }
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asgTitle.trim() || !asgDetails.trim()) {
      setAsgStatus('Please enter both an assignment title and instructions.');
      return;
    }

    onAddAssignment({
      id: `asg-${Date.now()}`,
      title: asgTitle.trim(),
      subject: asgSubject.trim() || 'General',
      dueDate: asgDueDate || '2026-11-30',
      details: asgDetails.trim(),
      createdBy: user.name,
    });

    setAsgStatus(`Assignment "${asgTitle.trim()}" created and shared with students.`);
    setAsgTitle('');
    setAsgDetails('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#C67F21] dark:text-amber-400 mb-1">
            Teacher Workspace · {user.name}
          </p>
          <h2 className="text-2xl font-bold text-[#153B70] dark:text-slate-100">
            Teacher Dashboard
          </h2>
          <p className="mt-1 text-sm text-[#44566C] dark:text-slate-300">
            Monitor student login status, review examination results, prepare exam questions, and
            publish study materials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenExamTab('results')}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#153B70] hover:bg-[#102E59] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Award className="w-4 h-4" aria-hidden="true" />
            <span>Examination Results</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenExamTab('prepare')}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#DF922C] hover:bg-[#C67F21] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <ClipboardList className="w-4 h-4" aria-hidden="true" />
            <span>Prepare Questions</span>
          </button>
        </div>
      </div>

      {/* Teaching Superpowers Multi-Select & Dedicated Studio Controls */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
              Your Teaching Superpowers
            </h3>
            <p className="text-xs text-[#52657C] dark:text-slate-400">
              Choose which learner squads you teach — click any selected power to control its live
              teaching studio &amp; stats below.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#C67F21] dark:text-amber-400 tabular-nums shrink-0">
            {teacherProfiles.length} of {DISABILITY_SUPPORT_OPTIONS.length} selected
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DISABILITY_SUPPORT_OPTIONS.map((option) => {
            const isTaught = teacherProfiles.includes(option.id);
            const isPreviewing = activeTeachingPower === option.id;
            return (
              <div
                key={option.id}
                className={`rounded-xl border-2 p-3.5 transition-all flex flex-col justify-between gap-2.5 ${
                  isPreviewing
                    ? 'border-[#DF922C] bg-amber-50/80 dark:bg-amber-950/35 dark:border-amber-400 shadow-xs'
                    : isTaught
                      ? 'border-[#159B83]/60 bg-[#F3FBF9] dark:bg-emerald-950/25 dark:border-emerald-700'
                      : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFD] dark:bg-slate-800/60 opacity-85'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[#153B70] dark:text-slate-100">
                      {option.funnyTitle}
                    </p>
                    <p className="text-[11px] font-semibold text-[#52657C] dark:text-slate-400">
                      {option.clearLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={isTaught}
                    aria-label={`${isTaught ? 'Remove' : 'Add'} ${option.funnyTitle} from teaching superpowers`}
                    onClick={() => handleToggleTeachingPower(option.id)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 ${
                      isTaught
                        ? 'bg-[#159B83] hover:bg-[#11836E] text-white'
                        : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#153B70] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isTaught && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                    <span>{isTaught ? 'Teaching' : 'Add'}</span>
                  </button>
                </div>

                {isTaught && (
                  <button
                    type="button"
                    onClick={() => setActiveTeachingPower(option.id)}
                    className={`w-full min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      isPreviewing
                        ? 'bg-[#DF922C] text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#153B70] dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isPreviewing ? 'Active Teaching Studio' : 'Open Teaching Controls'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <SuperpowerStudio
          profile={teacherProfiles.includes(activeTeachingPower) ? activeTeachingPower : teacherProfiles[0] ?? 'standard'}
          userRole="teacher"
          language={language}
          fontSize={fontSize}
          contrast={contrast}
          voiceStatus={voiceStatus}
          materialsCount={materials.length}
          assignmentsCount={assignmentsCount}
          resultsCount={resultsCount}
          allowedProfiles={teacherProfiles}
          onSelectProfile={(next) => setActiveTeachingPower(next)}
          onNavigate={onNavigate}
          onStartVoiceNav={onStartVoiceNav}
          onReadPage={onReadPage}
          onChangeFontSize={onChangeFontSize}
          onChangeContrast={onChangeContrast}
        />
      </section>

      {/* Live Class Sign-Language Doubts Inbox */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-[#0D9488]/30 dark:border-teal-500/35 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Hand className="w-5 h-5 text-[#0D9488] dark:text-teal-300" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                Sign-Language Student Doubts Inbox ({studentDoubts.length})
              </h3>
              <p className="text-xs text-[#52657C] dark:text-slate-400">
                Doubts asked in sign language during live classes, translated into clear language by
                the AI agent and routed to your portal.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void onRefreshStatuses()}
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh Doubts</span>
          </button>
        </div>

        {replyError && (
          <p className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            {replyError}
          </p>
        )}

        {studentDoubts.length === 0 ? (
          <p className="text-sm text-[#52657C] dark:text-slate-400 py-2">
            No sign-language doubts received yet. When a student signs a doubt in Live Class, its
            translated question will appear here immediately.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentDoubts.map((item) => (
              <article
                key={item.id}
                className="p-4 rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[#153B70] dark:text-slate-100">
                      {item.studentName}
                    </p>
                    <p className="text-xs text-[#52657C] dark:text-slate-400">
                      {getPowerTitle(item.studentProfile)} · {item.classTitle}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold shrink-0 ${
                      item.status === 'answered'
                        ? 'text-[#0F766E] dark:text-emerald-400'
                        : 'text-[#C67F21] dark:text-amber-400'
                    }`}
                  >
                    {item.status === 'answered' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>{item.status === 'answered' ? 'Answered' : 'Needs Reply'}</span>
                  </span>
                </div>

                {item.signSequence.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-[#52657C] dark:text-slate-400">
                      Signed by Student:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {item.signSequence.map((s, idx) => (
                        <span
                          key={`${item.id}-t-${idx}`}
                          className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-700 text-[10px] font-bold text-[#0F766E] dark:text-teal-300"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] font-semibold text-[#1D6CE0] dark:text-sky-400 mb-0.5">
                    Translated Doubt:
                  </span>
                  <p className="text-sm font-medium text-[#153B70] dark:text-slate-100">
                    &ldquo;{item.translatedQuestion}&rdquo;
                  </p>
                </div>

                {item.teacherReply ? (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
                    <span className="font-bold block mb-0.5">Your Reply:</span>
                    <span>{item.teacherReply}</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyDrafts[item.id] || ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="Write a clear visual reply for the student..."
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:border-[#0D9488] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={replyingId === item.id || !(replyDrafts[item.id] || '').trim()}
                      onClick={() => void handleReplyDoubt(item.id)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{replyingId === item.id ? 'Sending...' : 'Reply'}</span>
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Real-Time Classroom & Student Chat */}
      <ClassroomChatPanel
        currentUser={user}
        language={language}
        liveClasses={liveClasses}
        initialRoomId={liveClasses[0]?.id || 'classroom-general'}
        title="Live Classroom & Student Support Chat"
        subtitle="Real-time WebSocket messaging with students across active classes and the support desk."
      />

      {/* Student Login Status Table */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#153B70] dark:text-sky-400" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                Student Login Status & Progress
              </h3>
              <p className="text-xs text-[#52657C] dark:text-slate-400">
                Live session status and timestamp when each student logged in.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void onRefreshStatuses()}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh Status</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-[#52657C] dark:text-slate-400">
                <th className="py-3 pr-4">Student</th>
                <th className="py-3 pr-4">Login Status</th>
                <th className="py-3 pr-4">Last Login Time</th>
                <th className="py-3 pr-4">Learning Support</th>
                <th className="py-3 pr-4">Exams</th>
                <th className="py-3">Avg Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[#16253B] dark:text-slate-200">
              {studentStatuses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-6 text-center text-sm text-[#52657C] dark:text-slate-400"
                  >
                    No student login records in the database yet. Students will appear here after they register or sign in.
                  </td>
                </tr>
              ) : (
                studentStatuses.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-[#153B70] dark:text-slate-100">
                      {row.studentName}
                    </div>
                    <div className="text-xs text-[#52657C] dark:text-slate-400">{row.email}</div>
                  </td>
                  <td className="py-3 pr-4">
                    {row.isLoggedIn ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F6E5D] dark:text-emerald-400">
                        <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Logged In</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52657C] dark:text-slate-400">
                        <UserX className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Logged Out</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-[#16253B] dark:text-slate-300 tabular-nums">
                    {formatLoginTime(row.lastLoginAt)}
                  </td>
                  <td className="py-3 pr-4 text-[#44566C] dark:text-slate-300">
                    {row.accommodation}
                  </td>
                  <td className="py-3 pr-4 font-mono tabular-nums">{row.examsCompleted}</td>
                  <td className="py-3 font-mono tabular-nums font-semibold text-[#159B83] dark:text-emerald-400">
                    {row.averageScore}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Study Materials */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Upload className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />
            <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
              Upload Study Materials
            </h3>
          </div>

          <form onSubmit={(e) => void handleUploadMaterial(e)} className="space-y-3.5">
            <div>
              <label
                htmlFor="teacher-file-upload"
                className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
              >
                Optional Text File (.txt / .md)
              </label>
              <input
                id="teacher-file-upload"
                type="file"
                accept=".txt,.md,.csv,text/plain"
                onChange={(e) => void handleFileChange(e)}
                className="w-full text-sm text-[#44566C] dark:text-slate-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:bg-[#F1F6FC] dark:file:bg-slate-800 file:text-[#153B70] dark:file:text-slate-200 file:font-semibold hover:file:bg-[#E2ECF9] dark:hover:file:bg-slate-700 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="mat-title"
                  className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                >
                  Note Title
                </label>
                <input
                  id="mat-title"
                  type="text"
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  placeholder="e.g. Data Structures Summary"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="mat-subject"
                  className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                >
                  Subject
                </label>
                <input
                  id="mat-subject"
                  type="text"
                  value={materialSubject}
                  onChange={(e) => setMaterialSubject(e.target.value)}
                  placeholder="Computer Science"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="mat-body"
                className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
              >
                Study Note Content
              </label>
              <textarea
                id="mat-body"
                rows={4}
                value={materialBody}
                onChange={(e) => setMaterialBody(e.target.value)}
                placeholder="Write or paste accessible study notes for students..."
                className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1.5">
                Assign Note to Student Superpowers
              </span>
              <p className="text-xs text-[#52657C] dark:text-slate-400 mb-2">
                Only students with the selected superpower(s) will see this note.
              </p>
              <div className="flex flex-wrap gap-2">
                {teacherProfiles.map((powerId) => {
                  const active = noteTargets.includes(powerId);
                  const meta = DISABILITY_SUPPORT_OPTIONS.find((opt) => opt.id === powerId);
                  return (
                    <button
                      key={powerId}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleNoteTarget(powerId)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#DF922C] border-[#DF922C] text-white'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-[#153B70] dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                      <span>{meta?.funnyTitle ?? powerId}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={noteSaving}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {noteSaving ? 'Saving Note...' : 'Publish Study Material'}
            </button>

            {uploadStatus && (
              <p
                className={`p-3 rounded-lg border text-sm ${
                  uploadStatus.type === 'err'
                    ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                    : 'bg-[#E9F4FF] dark:bg-sky-950/60 border-blue-200 dark:border-sky-800 text-[#153B70] dark:text-sky-200'
                }`}
                aria-live="polite"
              >
                {uploadStatus.text}
              </p>
            )}
          </form>

          {/* Teacher-Published Persistent Notes List */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#52657C] dark:text-slate-400">
                Attached Notes in Student Portal ({teacherPublishedNotes.length})
              </p>
              <span className="text-xs text-[#52657C] dark:text-slate-400">
                Stored until deleted
              </span>
            </div>

            {teacherPublishedNotes.length === 0 ? (
              <p className="text-xs text-[#52657C] dark:text-slate-400 bg-[#F8FAFD] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
                No teacher notes attached yet. Any note you publish above will stay in the Student
                Portal until you delete it here.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {teacherPublishedNotes.map((note) => {
                  const canDelete =
                    note.source !== 'firestore' || !note.teacherUid || note.teacherUid === user.id;
                  return (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-xl bg-[#F8FAFD] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#153B70] dark:text-slate-100 truncate">
                          {note.title}
                        </p>
                        <p className="text-xs text-[#52657C] dark:text-slate-400 mt-0.5">
                          {note.subject} · {note.readTime} · {note.createdAt}
                          {note.fileName ? ` · File: ${note.fileName}` : ''}
                        </p>
                        {note.targetProfiles && note.targetProfiles.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {note.targetProfiles.map((tp) => (
                              <span
                                key={tp}
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              >
                                For: {getPowerTitle(tp)}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-[#44566C] dark:text-slate-300 mt-1 line-clamp-2">
                          {note.content}
                        </p>
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          disabled={deletingNoteId === note.id}
                          aria-label={`Delete ${note.title}`}
                          onClick={() => void handleDeleteNote(note)}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/60 disabled:opacity-50 text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{deletingNoteId === note.id ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Assignments + Create Online Class Link */}
        <div className="space-y-6">
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Video className="w-5 h-5 text-[#159B83] dark:text-emerald-400" aria-hidden="true" />
                <div>
                  <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                    Create Online Class Link
                  </h3>
                  <p className="text-xs text-[#52657C] dark:text-slate-400">
                    Generate an instant room link or paste your Zoom / Google Meet URL for students.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={(e) => void handleCreateLiveClass(e)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="live-class-title"
                    className="block text-xs font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                  >
                    Class Title
                  </label>
                  <input
                    id="live-class-title"
                    type="text"
                    value={classTitle}
                    onChange={(e) => setClassTitle(e.target.value)}
                    placeholder="e.g. Python Functions Live Session"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="live-class-subject"
                    className="block text-xs font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                  >
                    Subject
                  </label>
                  <input
                    id="live-class-subject"
                    type="text"
                    value={classSubject}
                    onChange={(e) => setClassSubject(e.target.value)}
                    placeholder="Computer Science"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="live-class-time"
                    className="block text-xs font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                  >
                    Date &amp; Time
                  </label>
                  <input
                    id="live-class-time"
                    type="datetime-local"
                    value={classScheduledAt}
                    onChange={(e) => setClassScheduledAt(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="live-class-duration"
                    className="block text-xs font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                  >
                    Duration
                  </label>
                  <select
                    id="live-class-duration"
                    value={classDuration}
                    onChange={(e) => setClassDuration(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none cursor-pointer"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label
                    htmlFor="live-class-url"
                    className="text-xs font-semibold text-[#16253B] dark:text-slate-200"
                  >
                    Meeting Link (HTTPS)
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRoomLink}
                    className="text-xs font-semibold text-[#1D6CE0] dark:text-sky-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Generate Instant Link</span>
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="live-class-url"
                    type="url"
                    value={classLinkInput}
                    onChange={(e) => setClassLinkInput(e.target.value)}
                    placeholder="https://meet.jit.si/educare-live-room"
                    className="flex-1 min-h-[42px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCopyClassLink('draft', classLinkInput)}
                    className="min-h-[42px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {copiedId === 'draft' ? (
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

              <input
                type="text"
                aria-label="Session accessibility notes"
                value={classNotes}
                onChange={(e) => setClassNotes(e.target.value)}
                placeholder="Optional notes (e.g. Sign interpreter available, slides attached)"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
              />

              <label className="flex items-center gap-2 text-xs font-medium text-[#16253B] dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={captionsEnabled}
                  onChange={(e) => setCaptionsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#159B83] cursor-pointer"
                />
                <span>Live captions &amp; screen-reader support enabled</span>
              </label>

              <button
                type="submit"
                disabled={classSaving}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#159B83] hover:bg-[#11836E] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Link2 className="w-4 h-4" aria-hidden="true" />
                <span>{classSaving ? 'Creating Link...' : 'Create & Publish Class Link'}</span>
              </button>

              {classLinkStatus && (
                <p
                  className={`p-3 rounded-lg border text-sm ${
                    classLinkStatus.type === 'err'
                      ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                      : 'bg-[#E9F4FF] dark:bg-sky-950/60 border-blue-200 dark:border-sky-800 text-[#153B70] dark:text-sky-200'
                  }`}
                  aria-live="polite"
                >
                  {classLinkStatus.text}
                </p>
              )}
            </form>

            {/* Created Online Class Links List */}
            {liveClasses.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <p className="text-xs font-semibold text-[#52657C] dark:text-slate-400">
                  Active Online Class Links ({liveClasses.length})
                </p>
                <div className="space-y-2.5">
                  {liveClasses.map((cls) => (
                    <div
                      key={cls.id}
                      className="p-3.5 rounded-xl bg-[#F8FAFD] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-[#153B70] dark:text-slate-100">
                            {cls.title}
                          </p>
                          <p className="text-xs text-[#52657C] dark:text-slate-400">
                            {cls.subject} · {cls.durationMinutes} min ·{' '}
                            {cls.captionsEnabled ? 'Captions On' : 'Standard'} ·{' '}
                            {formatLoginTime(cls.scheduledAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleCopyClassLink(cls.id, cls.meetingUrl)}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
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

                          <a
                            href={cls.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#1D6CE0] hover:bg-[#1659BD] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>

                          <button
                            type="button"
                            aria-label={`Remove ${cls.title}`}
                            onClick={() => void handleDeleteLiveClass(cls.id)}
                            className="min-h-[34px] px-2 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/60 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-[#1E66BE] dark:text-sky-400 break-all">
                        {cls.meetingUrl}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <BookPlus className="w-5 h-5 text-[#DF922C] dark:text-amber-400" aria-hidden="true" />
              <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                Create Assignment
              </h3>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  aria-label="Assignment title"
                  value={asgTitle}
                  onChange={(e) => setAsgTitle(e.target.value)}
                  placeholder="Assignment title"
                  className="sm:col-span-2 min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                />
                <input
                  type="date"
                  aria-label="Due date"
                  value={asgDueDate}
                  onChange={(e) => setAsgDueDate(e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                />
              </div>

              <input
                type="text"
                aria-label="Assignment subject"
                value={asgSubject}
                onChange={(e) => setAsgSubject(e.target.value)}
                placeholder="Subject (e.g. Mathematics)"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
              />

              <textarea
                rows={3}
                aria-label="Assignment details"
                value={asgDetails}
                onChange={(e) => setAsgDetails(e.target.value)}
                placeholder="Enter clear, accessible assignment instructions..."
                className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
              />

              <button
                type="submit"
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#DF922C] hover:bg-[#C67F21] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Create Assignment
              </button>

              {asgStatus && (
                <p
                  className="p-3 rounded-lg bg-[#E9F4FF] dark:bg-sky-950/60 border border-blue-200 dark:border-sky-800 text-sm text-[#153B70] dark:text-sky-200"
                  aria-live="polite"
                >
                  {asgStatus}
                </p>
              )}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
