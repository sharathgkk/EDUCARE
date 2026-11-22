import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ClipboardList,
  Clock,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Volume2,
  XCircle,
} from 'lucide-react';
import type { ExamQuestion, ExamResultRecord, LanguageCode, UserRole } from '../../types';
import { speakAloud } from '../../utils/speech';
import { apiFetch } from '../../services/api';

interface ExamSectionProps {
  language: LanguageCode;
  userRole: UserRole;
  questions: ExamQuestion[];
  results: ExamResultRecord[];
  initialTab?: 'exam' | 'results' | 'prepare';
  onRefreshData: () => Promise<void>;
  onQuestionCreated: (questions: ExamQuestion[]) => void;
  onQuestionDeleted: (questions: ExamQuestion[]) => void;
  onResultSubmitted: (result: ExamResultRecord) => void;
  hideSoundControls?: boolean;
  isNoHandsMode?: boolean;
}

export const ExamSection: React.FC<ExamSectionProps> = ({
  language,
  userRole,
  questions,
  results,
  initialTab,
  onRefreshData,
  onQuestionCreated,
  onQuestionDeleted,
  onResultSubmitted,
  hideSoundControls = false,
  isNoHandsMode = false,
}) => {
  const defaultTab = userRole === 'teacher' ? 'results' : 'exam';
  const [activeTab, setActiveTab] = useState<'exam' | 'results' | 'prepare'>(
    initialTab || defaultTab
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else {
      setActiveTab(userRole === 'teacher' ? 'results' : 'exam');
    }
  }, [initialTab, userRole]);

  // Student Exam Taking State
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [extraTime, setExtraTime] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [validationError, setValidationError] = useState('');
  const [latestScore, setLatestScore] = useState<ExamResultRecord | null>(null);

  // Teacher Question Builder State
  const [qSubject, setQSubject] = useState('Computer Science');
  const [qPrompt, setQPrompt] = useState('');
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');
  const [opt3, setOpt3] = useState('');
  const [opt4, setOpt4] = useState('');
  const [correctIndex, setCorrectIndex] = useState(0);
  const [qExplanation, setQExplanation] = useState('');
  const [builderStatus, setBuilderStatus] = useState('');
  const [savingQuestion, setSavingQuestion] = useState(false);

  useEffect(() => {
    if (userRole !== 'student' || activeTab !== 'exam' || submitted) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [userRole, activeTab, submitted]);

  const toggleExtraTime = () => {
    setExtraTime((prev) => {
      const next = !prev;
      setSecondsLeft(next ? 600 : 300);
      return next;
    });
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatTimestamp = (iso: string) => {
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

  const executeExamSubmit = useCallback(async () => {
    setSubmittingExam(true);
    try {
      const res = await apiFetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ answers, extraTimeUsed: extraTime }),
      });
      const data = (await res.json()) as { result?: ExamResultRecord; error?: string };
      if (!res.ok || !data.result) {
        setValidationError(data.error || 'Unable to submit examination.');
        return;
      }
      setLatestScore(data.result);
      setSubmitted(true);
      onResultSubmitted(data.result);
    } catch {
      setValidationError('Network error while submitting examination.');
    } finally {
      setSubmittingExam(false);
    }
  }, [answers, extraTime, onResultSubmitted]);

  useEffect(() => {
    if (!confirmSubmitOpen) return;
    const handleNodConfirm = (event: Event) => {
      event.preventDefault();
      setConfirmSubmitOpen(false);
      void executeExamSubmit();
    };
    window.addEventListener('educare:nod-confirm', handleNodConfirm);
    return () => window.removeEventListener('educare:nod-confirm', handleNodConfirm);
  }, [confirmSubmitOpen, executeExamSubmit]);

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      setValidationError(
        `Please select an answer for all ${questions.length} questions before submitting.`
      );
      return;
    }

    if (isNoHandsMode) {
      setConfirmSubmitOpen(true);
      return;
    }

    await executeExamSubmit();
  };

  const handleResetExam = () => {
    setAnswers({});
    setSubmitted(false);
    setLatestScore(null);
    setValidationError('');
    setSecondsLeft(extraTime ? 600 : 300);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuilderStatus('');

    const rawOptions = [opt1, opt2, opt3, opt4].map((label, idx) => ({
      label: label.trim(),
      isCorrect: idx === correctIndex,
    }));

    const filledOptions = rawOptions.filter((o) => o.label.length > 0);
    if (!qSubject.trim() || !qPrompt.trim() || filledOptions.length < 2) {
      setBuilderStatus('Enter a subject, question prompt, and at least two answer options.');
      return;
    }

    if (!filledOptions.some((o) => o.isCorrect)) {
      setBuilderStatus('Select one of the filled options as the correct answer.');
      return;
    }

    setSavingQuestion(true);
    try {
      const res = await apiFetch('/api/exam/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: qSubject.trim(),
          prompt: qPrompt.trim(),
          options: filledOptions,
          explanation: qExplanation.trim(),
        }),
      });
      const data = (await res.json()) as { questions?: ExamQuestion[]; error?: string };
      if (!res.ok || !data.questions) {
        setBuilderStatus(data.error || 'Could not save question.');
        return;
      }
      onQuestionCreated(data.questions);
      setQPrompt('');
      setOpt1('');
      setOpt2('');
      setOpt3('');
      setOpt4('');
      setCorrectIndex(0);
      setQExplanation('');
      setBuilderStatus('Question added to the live examination bank.');
    } catch {
      setBuilderStatus('Network error while saving question.');
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      const res = await apiFetch(`/api/exam/questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await res.json()) as { questions?: ExamQuestion[]; error?: string };
      if (res.ok && data.questions) {
        onQuestionDeleted(data.questions);
      }
    } catch {
      // ignore transient errors
    }
  };

  // TEACHER VIEW: Examination Results + Prepare Questions
  if (userRole === 'teacher') {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#C67F21] dark:text-amber-400 mb-1">
              Teacher Examination Management
            </p>
            <h2 className="text-2xl font-bold text-[#153B70] dark:text-slate-100">
              Examination Results & Question Preparation
            </h2>
            <p className="mt-1 text-sm text-[#44566C] dark:text-slate-300">
              Review student examination results and prepare questions for upcoming assessments.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Teacher examination views"
            className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'results'}
              onClick={() => setActiveTab('results')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'results'
                  ? 'bg-[#153B70] dark:bg-sky-600 text-white shadow-sm'
                  : 'text-[#52657C] dark:text-slate-300 hover:text-[#153B70] dark:hover:text-white'
              }`}
            >
              <Award className="w-4 h-4" aria-hidden="true" />
              <span>Examination Results ({results.length})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'prepare'}
              onClick={() => setActiveTab('prepare')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'prepare'
                  ? 'bg-[#DF922C] text-white shadow-sm'
                  : 'text-[#52657C] dark:text-slate-300 hover:text-[#153B70] dark:hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" aria-hidden="true" />
              <span>Prepare Questions ({questions.length})</span>
            </button>
          </div>
        </div>

        {activeTab === 'results' && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                  Student Examination Results
                </h3>
                <p className="text-sm text-[#44566C] dark:text-slate-300">
                  All submitted scores and accommodations across students.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onRefreshData()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Refresh Results</span>
              </button>
            </div>

            {results.length === 0 ? (
              <p className="text-sm text-[#52657C] dark:text-slate-400 py-6">
                No students have submitted an examination yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-[#52657C] dark:text-slate-400">
                      <th className="py-3 pr-4">Student</th>
                      <th className="py-3 pr-4">Email</th>
                      <th className="py-3 pr-4">Score</th>
                      <th className="py-3 pr-4">Percentage</th>
                      <th className="py-3 pr-4">Extra Time</th>
                      <th className="py-3">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[#16253B] dark:text-slate-200">
                    {results.map((res) => (
                      <tr key={res.id}>
                        <td className="py-3 pr-4 font-semibold text-[#153B70] dark:text-slate-100">
                          {res.studentName}
                        </td>
                        <td className="py-3 pr-4 text-[#44566C] dark:text-slate-400">
                          {res.studentEmail}
                        </td>
                        <td className="py-3 pr-4 font-mono tabular-nums">
                          {res.score} / {res.totalQuestions}
                        </td>
                        <td
                          className={`py-3 pr-4 font-mono font-semibold tabular-nums ${
                            res.percentage >= 70
                              ? 'text-[#159B83] dark:text-emerald-400'
                              : 'text-[#C67F21] dark:text-amber-400'
                          }`}
                        >
                          {res.percentage}%
                        </td>
                        <td className="py-3 pr-4 text-[#44566C] dark:text-slate-300">
                          {res.extraTimeUsed ? 'Used (10 min)' : 'Standard (5 min)'}
                        </td>
                        <td className="py-3 text-[#52657C] dark:text-slate-400 tabular-nums">
                          {formatTimestamp(res.submittedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'prepare' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                Prepare New Exam Question
              </h3>
              <form onSubmit={(e) => void handleAddQuestion(e)} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="prep-subject"
                    className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                  >
                    Subject
                  </label>
                  <input
                    id="prep-subject"
                    type="text"
                    required
                    value={qSubject}
                    onChange={(e) => setQSubject(e.target.value)}
                    placeholder="e.g. Java, Python, Mathematics"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prep-prompt"
                    className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                  >
                    Question Prompt
                  </label>
                  <textarea
                    id="prep-prompt"
                    rows={2}
                    required
                    value={qPrompt}
                    onChange={(e) => setQPrompt(e.target.value)}
                    placeholder="Enter the question clearly for students and screen readers..."
                    className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#16253B] dark:text-slate-200">
                    Answer Options (select the correct one)
                  </p>
                  {[
                    { val: opt1, set: setOpt1, idx: 0, label: 'Option 1 (required)' },
                    { val: opt2, set: setOpt2, idx: 1, label: 'Option 2 (required)' },
                    { val: opt3, set: setOpt3, idx: 2, label: 'Option 3 (optional)' },
                    { val: opt4, set: setOpt4, idx: 3, label: 'Option 4 (optional)' },
                  ].map((item) => (
                    <div key={item.idx} className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="correct-opt"
                        aria-label={`Mark option ${item.idx + 1} as correct`}
                        checked={correctIndex === item.idx}
                        onChange={() => setCorrectIndex(item.idx)}
                        className="w-4 h-4 accent-[#159B83] shrink-0"
                      />
                      <input
                        type="text"
                        value={item.val}
                        onChange={(e) => item.set(e.target.value)}
                        placeholder={item.label}
                        className="flex-1 min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label
                    htmlFor="prep-explanation"
                    className="block text-sm font-semibold text-[#16253B] dark:text-slate-200 mb-1"
                  >
                    Explanation (shown after submission)
                  </label>
                  <input
                    id="prep-explanation"
                    type="text"
                    value={qExplanation}
                    onChange={(e) => setQExplanation(e.target.value)}
                    placeholder="Short explanation to help students learn..."
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingQuestion}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>{savingQuestion ? 'Adding Question...' : 'Add Question to Exam'}</span>
                </button>

                {builderStatus && (
                  <p
                    className="p-3 rounded-lg bg-[#E9F4FF] dark:bg-sky-950/60 border border-blue-200 dark:border-sky-800 text-sm text-[#153B70] dark:text-sky-200"
                    aria-live="polite"
                  >
                    {builderStatus}
                  </p>
                )}
              </form>
            </section>

            <section className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                  Prepared Exam Questions ({questions.length})
                </h3>
              </div>

              <div className="space-y-3">
                {questions.map((q, index) => (
                  <article
                    key={q.id}
                    className="p-4 rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-[#52657C] dark:text-slate-400 tabular-nums">
                          Q{index + 1} · {q.subject}
                        </p>
                        <h4 className="text-sm font-bold text-[#153B70] dark:text-slate-100 mt-0.5">
                          {q.prompt}
                        </h4>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove question ${index + 1}`}
                        onClick={() => void handleDeleteQuestion(q.id)}
                        className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                    <ul className="text-xs text-[#44566C] dark:text-slate-300 space-y-1">
                      {q.options.map((opt) => (
                        <li key={opt.id}>
                          {opt.isCorrect ? '✓ ' : '· '}
                          <span
                            className={
                              opt.isCorrect
                                ? 'font-semibold text-[#159B83] dark:text-emerald-400'
                                : ''
                            }
                          >
                            {opt.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }

  // STUDENT VIEW: Take Exam + Student Results
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#153B70] dark:text-slate-100">
            {activeTab === 'results'
              ? 'Student Examination Results'
              : 'Online Practice Examination'}
          </h2>
          <p className="mt-1 text-sm text-[#44566C] dark:text-slate-300">
            {activeTab === 'results'
              ? 'Review your completed examination scores, percentages, and accommodations.'
              : 'Keyboard-accessible assessment with question read-aloud and extra time accommodation.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div
            role="tablist"
            aria-label="Student examination views"
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'exam'}
              onClick={() => setActiveTab('exam')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'exam'
                  ? 'bg-[#153B70] dark:bg-sky-600 text-white shadow-sm'
                  : 'text-[#52657C] dark:text-slate-300 hover:text-[#153B70] dark:hover:text-white'
              }`}
            >
              Take Exam
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'results'}
              onClick={() => setActiveTab('results')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'results'
                  ? 'bg-[#159B83] text-white shadow-sm'
                  : 'text-[#52657C] dark:text-slate-300 hover:text-[#153B70] dark:hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Student Result ({results.length})</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'results' ? (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
              Your Examination History
            </h3>
            <div className="flex items-center gap-2">
              {!hideSoundControls && results.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    speakAloud(
                      `Your latest examination score is ${results[0].score} out of ${results[0].totalQuestions}, which is ${results[0].percentage} percent.`,
                      language
                    )
                  }
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Read Result Aloud</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('exam')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] text-white text-xs font-semibold cursor-pointer"
              >
                Take New Exam
              </button>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center space-y-3">
              <p className="text-sm text-[#44566C] dark:text-slate-300">
                You have not submitted an examination attempt yet.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('exam')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white text-sm font-semibold cursor-pointer"
              >
                Start Practice Examination
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((res, idx) => (
                <article
                  key={res.id}
                  className="p-5 rounded-xl bg-[#F8FAFD] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-[#52657C] dark:text-slate-400 tabular-nums">
                      Attempt #{results.length - idx} · {formatTimestamp(res.submittedAt)}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        res.percentage >= 70
                          ? 'text-[#159B83] dark:text-emerald-400'
                          : 'text-[#C67F21] dark:text-amber-400'
                      }`}
                    >
                      {res.percentage >= 70 ? 'Passed' : 'Needs Review'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#153B70] dark:text-slate-100 font-mono tabular-nums">
                    {res.score} / {res.totalQuestions} ({res.percentage}%)
                  </p>
                  <p className="text-xs text-[#52657C] dark:text-slate-400">
                    Timing: {res.extraTimeUsed ? 'Extra Time (10 min)' : 'Standard Time (5 min)'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-6 py-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#153B70] dark:text-slate-100 tabular-nums">
              <Clock className="w-4 h-4 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />
              <span>Remaining Time: {formatTime(secondsLeft)}</span>
            </div>

            <button
              type="button"
              onClick={toggleExtraTime}
              aria-pressed={extraTime}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                extraTime
                  ? 'bg-[#159B83] text-white border-[#159B83]'
                  : 'border-slate-300 dark:border-slate-700 text-[#153B70] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {extraTime ? 'Extra Time (10 min): On' : 'Standard Time (5 min)'}
            </button>
          </div>

          <form onSubmit={(e) => void handleStudentSubmit(e)} className="space-y-5">
            {questions.map((q, index) => {
              const pickedId = answers[q.id];
              const pickedOption = q.options.find((opt) => opt.id === pickedId);

              return (
                <fieldset
                  key={q.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-[#52657C] dark:text-slate-400 tabular-nums">
                        Question {index + 1} of {questions.length} · {q.subject}
                      </p>
                      <legend className="text-lg font-bold text-[#153B70] dark:text-slate-100 mt-1">
                        {q.prompt}
                      </legend>
                    </div>

                    {!hideSoundControls && (
                      <button
                        type="button"
                        onClick={() =>
                          speakAloud(
                            `Question ${index + 1}. ${q.prompt}. Options: ${q.options
                              .map((o) => o.label)
                              .join(', ')}.`,
                            language
                          )
                        }
                        className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#153B70] dark:text-slate-200 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Read Question</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {q.options.map((opt) => {
                      const isSelected = pickedId === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-3 min-h-[46px] px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#E9F4FF] dark:bg-sky-950/60 border-[#1D6CE0] dark:border-sky-500 text-[#153B70] dark:text-sky-200 font-semibold'
                              : 'bg-[#F8FAFD] dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-[#16253B] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.id}
                            checked={isSelected}
                            disabled={submitted}
                            onChange={() => {
                              setAnswers((prev) => ({ ...prev, [q.id]: opt.id }));
                              setValidationError('');
                            }}
                            className="w-4 h-4 accent-[#1D6CE0]"
                          />
                          <span className="text-sm sm:text-base">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  {submitted && pickedOption && (
                    <div
                      className={`p-3.5 rounded-xl border text-sm flex items-start gap-2.5 ${
                        pickedOption.isCorrect
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                          : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                      }`}
                    >
                      {pickedOption.isCorrect ? (
                        <CheckCircle2
                          className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <XCircle
                          className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      )}
                      <div>
                        <p className="font-semibold">
                          {pickedOption.isCorrect ? 'Correct answer! Well done.' : 'Incorrect answer.'}
                        </p>
                        <p className="mt-0.5">{q.explanation}</p>
                      </div>
                    </div>
                  )}
                </fieldset>
              );
            })}

            {validationError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200"
              >
                {validationError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {!submitted ? (
                <button
                  type="submit"
                  disabled={submittingExam || questions.length === 0}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] disabled:opacity-60 text-white text-base font-semibold transition-colors cursor-pointer"
                >
                  {submittingExam ? 'Submitting...' : 'Submit Answers'}
                </button>
              ) : (
                <>
                  {latestScore && (
                    <div
                      aria-live="polite"
                      className="px-5 py-3 rounded-xl bg-[#E9F4FF] dark:bg-sky-950/60 border border-blue-200 dark:border-sky-800 text-[#153B70] dark:text-sky-200 font-bold text-base tabular-nums"
                    >
                      Score: {latestScore.score} / {latestScore.totalQuestions} (
                      {latestScore.percentage}%)
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('results')}
                    className="min-h-[48px] px-5 py-3 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Award className="w-4 h-4" aria-hidden="true" />
                    <span>Open Student Result</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetExam}
                    className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#153B70] dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    <span>Retake Practice Exam</span>
                  </button>
                </>
              )}
            </div>
          </form>

          {confirmSubmitOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="nod-exam-submit-heading"
              className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4"
            >
              <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#159B83] dark:border-emerald-500 p-6 shadow-2xl space-y-4">
                <h3
                  id="nod-exam-submit-heading"
                  className="text-lg font-bold text-[#153B70] dark:text-slate-100"
                >
                  Confirm Exam Submission
                </h3>
                <p className="text-sm text-[#44566C] dark:text-slate-300 leading-relaxed">
                  Ready to submit all {questions.length} answers? <strong>Nod your head</strong>{' '}
                  (down then up) to confirm <strong>Yes, Submit Exam</strong>, or select Cancel.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmSubmitOpen(false)}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-200 text-sm font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-nod-confirm="true"
                    onClick={() => {
                      setConfirmSubmitOpen(false);
                      void executeExamSubmit();
                    }}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white text-sm font-bold cursor-pointer"
                  >
                    Yes, Submit Exam
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
