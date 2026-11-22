import React, { useEffect, useState } from 'react';
import { BookOpen, Download, Paperclip, Sparkles, Square, Volume2, WifiOff } from 'lucide-react';
import type { DisabilityProfile, LanguageCode, StudyMaterial, UserRole } from '../../types';
import { DISABILITY_SUPPORT_OPTIONS } from '../../data/educareData';
import { downloadPlainTextNote, speakAloud, stopSpeaking } from '../../utils/speech';

interface MaterialsSectionProps {
  language: LanguageCode;
  userRole: UserRole;
  studentProfile?: DisabilityProfile;
  hideSoundControls?: boolean;
  materials: StudyMaterial[];
  voiceSelectedMaterial?: { id: number; materialId: string } | null;
  isOnline?: boolean;
}

export const MaterialsSection: React.FC<MaterialsSectionProps> = ({
  language,
  userRole,
  studentProfile,
  hideSoundControls = false,
  materials,
  voiceSelectedMaterial = null,
  isOnline = true,
}) => {
  const profileMeta = studentProfile
    ? DISABILITY_SUPPORT_OPTIONS.find((opt) => opt.id === studentProfile)
    : undefined;
  const [readingText, setReadingText] = useState(
    'Education helps every student learn without barriers. Paste or type any paragraph here to hear it read aloud clearly.'
  );
  const [speechRate, setSpeechRate] = useState<number>(1);
  const [ttsNotice, setTtsNotice] = useState('');
  const [previewNote, setPreviewNote] = useState<StudyMaterial | null>(materials[0] ?? null);

  useEffect(() => {
    setPreviewNote((current) => {
      if (!current) return materials[0] ?? null;
      const stillExists = materials.find((m) => m.id === current.id);
      return stillExists ?? materials[0] ?? null;
    });
  }, [materials]);

  useEffect(() => {
    if (!voiceSelectedMaterial) return;
    const found = materials.find((m) => m.id === voiceSelectedMaterial.materialId);
    if (found) {
      setPreviewNote(found);
      setReadingText(found.content);
    }
  }, [voiceSelectedMaterial, materials]);

  const handleReadAloud = () => {
    setTtsNotice('');
    if (!readingText.trim()) {
      setTtsNotice('Please enter some text in the box first.');
      return;
    }
    const ok = speakAloud(readingText, language, speechRate);
    if (!ok) {
      setTtsNotice('Text-to-Speech is unavailable in this browser.');
    } else {
      setTtsNotice('Reading text aloud.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#153B70] dark:text-slate-100">Study Materials</h2>
          <p className="mt-1 text-sm text-[#44566C] dark:text-slate-300">
            {userRole === 'student' && profileMeta
              ? `Showing study notes uploaded specifically for ${profileMeta.funnyTitle} (${profileMeta.clearLabel}).`
              : 'Download accessible plain-text notes for offline study or listen to them using built-in Text-to-Speech.'}
          </p>
        </div>
        {userRole === 'student' && profileMeta && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-700 text-xs font-bold text-amber-900 dark:text-amber-300 shrink-0">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{profileMeta.funnyTitle}</span>
          </span>
        )}
      </div>

      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-4 py-3 text-sm font-medium text-amber-950 dark:text-amber-200 flex items-center gap-2.5"
        >
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            Internet connection unavailable — showing cached study materials saved by your Service
            Worker for offline reading and Text-to-Speech.
          </span>
        </div>
      )}

      {/* Offline Study Notes */}
      {materials.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          <p className="text-base font-semibold text-[#153B70] dark:text-slate-100">
            No study notes uploaded for {profileMeta?.funnyTitle || 'your superpower'} yet.
          </p>
          <p className="mt-1 text-sm text-[#52657C] dark:text-slate-400">
            Notes uploaded by your matched teachers will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {materials.map((item) => (
            <article
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between"
            >
              <div>
                <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">
                  {item.subject} · {item.readTime}
                </p>
                <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100 mt-1">
                  {item.title}
                </h3>
                {item.uploadedBy && (
                  <p className="mt-1 text-xs font-semibold text-[#0F6E5D] dark:text-emerald-400">
                    Teacher: {item.uploadedBy}
                  </p>
                )}
                {item.fileName && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#1E66BE] dark:text-sky-400">
                    <Paperclip className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.fileName}</span>
                  </p>
                )}
                <p className="mt-2 text-sm text-[#44566C] dark:text-slate-300 line-clamp-3 leading-relaxed">
                  {item.content}
                </p>
              </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadPlainTextNote(item.title, item.content)}
                className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Download</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewNote(item);
                  setReadingText(item.content);
                }}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#153B70] dark:text-slate-200 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Load</span>
              </button>
            </div>
            </article>
          ))}
        </div>
      )}

      {/* Note Preview + Optional Text-to-Speech Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          className={`${
            hideSoundControls ? 'lg:col-span-12' : 'lg:col-span-5'
          } bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3`}
        >
          <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
            Selected Note Preview
          </h3>
          {previewNote ? (
            <>
              <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">
                {previewNote.title} · {previewNote.uploadedBy || 'EduCare Faculty'} ·{' '}
                {previewNote.createdAt}
              </p>
              <pre className="whitespace-pre-wrap font-sans text-sm text-[#16253B] dark:text-slate-200 leading-relaxed bg-[#F8FAFD] dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 max-h-72 overflow-y-auto">
                {previewNote.content}
              </pre>
            </>
          ) : (
            <p className="text-sm text-[#52657C] dark:text-slate-400">
              Select a note above to preview its contents.
            </p>
          )}
        </section>

        {!hideSoundControls && (
          <section className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                Text-to-Speech Reader
              </h3>
              <p className="text-sm text-[#44566C] dark:text-slate-300">
                Paste or load any study text to listen at your preferred reading speed.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label
                htmlFor="tts-rate"
                className="text-xs font-semibold text-[#52657C] dark:text-slate-400"
              >
                Speed
              </label>
              <select
                id="tts-rate"
                value={speechRate}
                onChange={(e) => setSpeechRate(Number(e.target.value))}
                className="min-h-[40px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 tabular-nums"
              >
                <option value={0.8}>0.8x</option>
                <option value={1}>1.0x</option>
                <option value={1.25}>1.25x</option>
              </select>
            </div>
          </div>

          <textarea
            aria-label="Text to listen aloud"
            rows={5}
            value={readingText}
            onChange={(e) => setReadingText(e.target.value)}
            placeholder="Enter text to listen..."
            className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 text-base leading-relaxed focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleReadAloud}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Volume2 className="w-4 h-4" aria-hidden="true" />
              <span>Read Aloud</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setTtsNotice('Audio stopped.');
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#16253B] dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Stop Audio</span>
            </button>

            {ttsNotice && (
              <span className="text-sm text-[#52657C] dark:text-slate-400">{ttsNotice}</span>
            )}
          </div>
          </section>
        )}
      </div>
    </div>
  );
};
