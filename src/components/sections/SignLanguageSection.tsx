import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { LanguageCode, SignLesson } from '../../types';
import { SIGN_LESSONS } from '../../data/educareData';
import { speakAloud } from '../../utils/speech';

interface SignLanguageSectionProps {
  language: LanguageCode;
  hideSoundControls?: boolean;
}

function SignGestureIllustration({ type }: { type: SignLesson['gestureType'] }) {
  return (
    <svg
      viewBox="0 0 120 96"
      className="w-full h-28 rounded-xl bg-[#F1F6FC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2"
      aria-hidden="true"
    >
      {type === 'hello' && (
        <g
          className="stroke-[#153B70] dark:stroke-sky-300"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M40 72V42c0-4 6-4 6 0v14" />
          <path d="M46 54V32c0-4 6-4 6 0v22" />
          <path d="M52 54V30c0-4 6-4 6 0v24" />
          <path d="M58 55V34c0-4 6-4 6 0v25c0 12-6 20-16 20H44c-6 0-10-4-10-10V54c0-4 6-4 6 0" />
          <path d="M72 34c8 4 14 10 16 18" stroke="#159B83" strokeDasharray="3 3" />
          <path d="M84 48l4 5 5-4" stroke="#159B83" />
        </g>
      )}
      {type === 'thankyou' && (
        <g
          className="stroke-[#153B70] dark:stroke-sky-300"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="42" cy="30" r="10" className="fill-[#E9F4FF] dark:fill-slate-700" />
          <path d="M46 44l22 6c4 1 3 7-1 6l-18-4" />
          <path d="M56 54l16 10" stroke="#38BDF8" strokeDasharray="3 3" />
          <path d="M68 65l5 0-1-5" stroke="#38BDF8" />
        </g>
      )}
      {type === 'help' && (
        <g
          className="stroke-[#153B70] dark:stroke-sky-300"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M30 68h52c3 0 5 5 0 5H34c-4 0-6-5-4-5z"
            className="fill-[#E9F4FF] dark:fill-slate-700"
          />
          <rect
            x="46"
            y="42"
            width="22"
            height="22"
            rx="5"
            className="fill-white dark:fill-slate-900"
          />
          <path d="M57 42V28c0-4 6-4 6 0v14" />
          <path d="M84 56V32" stroke="#159B83" strokeDasharray="3 3" />
          <path d="M79 37l5-5 5 5" stroke="#159B83" />
        </g>
      )}
      {type === 'communication' && (
        <g
          className="stroke-[#153B70] dark:stroke-sky-300"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M42 36c-8 0-12 6-12 12s4 12 12 12" />
          <path d="M78 36c8 0 12 6 12 12s-4 12-12 12" />
          <path d="M48 48h24" stroke="#DF922C" strokeDasharray="3 3" />
          <path d="M67 43l5 5-5 5" stroke="#DF922C" />
          <path d="M53 43l-5 5 5 5" stroke="#DF922C" />
        </g>
      )}
      {type === 'yes' && (
        <g
          className="stroke-[#153B70] dark:stroke-sky-300"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect
            x="46"
            y="34"
            width="26"
            height="24"
            rx="7"
            className="fill-[#E9F4FF] dark:fill-slate-700"
          />
          <path d="M46 46h26" />
          <path d="M84 32v28" stroke="#159B83" strokeDasharray="3 3" />
          <path d="M79 55l5 5 5-5" stroke="#159B83" />
          <path d="M79 37l5-5 5 5" stroke="#159B83" />
        </g>
      )}
      {type === 'question' && (
        <g
          className="stroke-[#153B70] dark:stroke-sky-300"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M48 68V48c0-3 4-4 6-2" />
          <path d="M52 30c6-4 14 0 14 6 0 5-7 7-7 13" stroke="#38BDF8" />
          <circle cx="59" cy="56" r="2" fill="#38BDF8" stroke="none" />
        </g>
      )}
    </svg>
  );
}

export const SignLanguageSection: React.FC<SignLanguageSectionProps> = ({
  language,
  hideSoundControls = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const categories = ['All', 'Greeting', 'Courtesy', 'Support', 'Classroom', 'Response'];

  const visibleLessons =
    selectedCategory === 'All'
      ? SIGN_LESSONS
      : SIGN_LESSONS.filter((lesson) => lesson.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#153B70] dark:text-slate-100">
            Sign Language Learning Support
          </h2>
          <p className="mt-1 text-sm text-[#44566C] dark:text-slate-300">
            Learn essential classroom and everyday sign language gestures through clear visual
            diagrams and step-by-step instructions.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-white dark:bg-slate-900 text-[#153B70] dark:text-slate-100 shadow-sm'
                  : 'text-[#52657C] dark:text-slate-400 hover:text-[#153B70] dark:hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleLessons.map((lesson) => (
          <article
            key={lesson.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <SignGestureIllustration type={lesson.gestureType} />
              <div>
                <p className="text-xs font-medium text-[#52657C] dark:text-slate-400">
                  {lesson.category}
                </p>
                <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100 mt-0.5">
                  {lesson.word}
                </h3>
                <p className="text-sm text-[#44566C] dark:text-slate-300 mt-1">{lesson.summary}</p>
              </div>

              <ol className="space-y-1.5 text-sm text-[#16253B] dark:text-slate-200 list-decimal list-inside pt-1">
                {lesson.steps.map((step, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {!hideSoundControls && (
              <button
                type="button"
                onClick={() =>
                  speakAloud(
                    `${lesson.word}. ${lesson.summary} Steps: ${lesson.steps.join(' ')}`,
                    language
                  )
                }
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#153B70] dark:text-slate-200 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Volume2 className="w-4 h-4" aria-hidden="true" />
                <span>Hear Instructions</span>
              </button>
            )}
          </article>
        ))}
      </div>

      <p className="text-xs text-[#52657C] dark:text-slate-400 px-1">
        Future development: Integrate full sign language video demonstrations and camera-based sign
        recognition feedback.
      </p>
    </div>
  );
};
