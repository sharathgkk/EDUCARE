import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Contrast,
  Keyboard,
  Mic,
  Minus,
  Moon,
  Plus,
  Sun,
  Volume2,
} from 'lucide-react';
import type { ContrastPreset, LanguageCode, ThemeMode } from '../../types';
import type { BlindVoiceState } from '../../hooks/useBlindWakeWord';
import { CONTRAST_PRESETS } from '../../data/educareData';
import { HAPTIC_PATTERN_LABELS, isVibrationSupported } from '../../utils/haptics';

interface AccessibilitySectionProps {
  language: LanguageCode;
  fontSize: number;
  contrast: ContrastPreset;
  theme: ThemeMode;
  voiceStatus: string;
  onStartVoiceNav: () => void;
  onReadPage: () => void;
  onChangeFontSize: (size: number) => void;
  onChangeContrast: (preset: ContrastPreset) => void;
  onToggleTheme: () => void;
  hideSoundControls?: boolean;
  isBlindStudent?: boolean;
  alwaysOnVoice?: boolean;
  isOcdMode?: boolean;
  blindVoiceState?: BlindVoiceState;
}

export const AccessibilitySection: React.FC<AccessibilitySectionProps> = ({
  fontSize,
  contrast,
  theme,
  voiceStatus,
  onStartVoiceNav,
  onReadPage,
  onChangeFontSize,
  onChangeContrast,
  onToggleTheme,
  hideSoundControls = false,
  isBlindStudent = false,
  alwaysOnVoice = false,
  isOcdMode = false,
  blindVoiceState = 'listening',
}) => {
  const showAlwaysOnVoice = isBlindStudent || alwaysOnVoice;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [eyeStatus, setEyeStatus] = useState('Camera is not active.');

  const stopEyeDemo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setEyeStatus('Camera stopped.');
  };

  const startEyeDemo = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEyeStatus('Camera access is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setEyeStatus('Camera preview active. Eye tracking model is not connected.');
    } catch {
      setCameraActive(false);
      setEyeStatus('Camera permission denied or camera unavailable.');
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7">
        <h2 className="text-2xl font-bold text-[#153B70] dark:text-slate-100">
          Accessibility Centre
        </h2>
        <p className="mt-1 text-sm text-[#44566C] dark:text-slate-300">
          {hideSoundControls
            ? 'Customize dark/light theme, contrast presets (Soft Blue, High Contrast Dark, Yellow on Black, Dyslexia Pastel), numeric font size, keyboard shortcuts, and camera preview.'
            : 'Customize voice navigation, read-aloud audio, dark/light theme, contrast presets (Soft Blue, High Contrast Dark, Yellow on Black, Dyslexia Pastel), numeric font size, and eye control camera preview.'}
        </p>
      </div>

      {/* Contrast Presets Section */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Contrast className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />
            <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
              Contrast &amp; Visual Comfort Presets
            </h3>
          </div>
          <span className="text-xs font-semibold text-[#52657C] dark:text-slate-400">
            Active: {CONTRAST_PRESETS.find((p) => p.id === contrast)?.label || 'Default'}
          </span>
        </div>
        <p className="text-sm text-[#44566C] dark:text-slate-300">
          Choose a reading surface tailored for low vision, glare sensitivity, or dyslexia support
          across both Student and Teacher portals.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CONTRAST_PRESETS.map((preset) => {
            const isSelected = contrast === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChangeContrast(preset.id)}
                className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2.5 ${
                  isSelected
                    ? 'border-[#1D6CE0] dark:border-sky-400 bg-[#F0F6FF] dark:bg-sky-950/60 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    data-swatch="true"
                    style={{
                      backgroundColor: preset.swatchBg,
                      color: preset.swatchFg,
                      borderColor: preset.swatchBorder,
                    }}
                    className="inline-flex items-center justify-center px-2.5 py-1 rounded-md border text-xs font-bold tracking-tight"
                    aria-hidden="true"
                  >
                    Aa
                  </span>
                  {isSelected && (
                    <span className="text-[11px] font-bold text-[#1D6CE0] dark:text-sky-400">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-[#153B70] dark:text-slate-100">
                    {preset.label}
                  </div>
                  <p className="mt-0.5 text-xs text-[#52657C] dark:text-slate-400 leading-snug">
                    {preset.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Voice Navigation */}
        {!hideSoundControls && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <Mic className="w-5 h-5 text-[#159B83] dark:text-emerald-400" aria-hidden="true" />
              <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
                {showAlwaysOnVoice ? 'Always-On "Hey AI" / "Hi AI" Navigator' : 'Voice Navigation'}
              </h3>
            </div>
            {showAlwaysOnVoice ? (
              <>
                <p className="text-sm text-[#44566C] dark:text-slate-300">
                  No button needed — your microphone stays continuously active. Simply say{' '}
                  <strong>&ldquo;Hey AI&rdquo;</strong> or <strong>&ldquo;Hi AI&rdquo;</strong>{' '}
                  followed by {isOcdMode ? 'a hand camera command, destination, or study question.' : 'where you want to go or any study question.'}
                </p>
                <div
                  role="status"
                  aria-live="polite"
                  className={
                    isBlindStudent
                      ? 'p-3.5 rounded-xl bg-slate-950 text-amber-200 border-2 border-amber-400/80 text-sm font-semibold space-y-1'
                      : 'p-3.5 rounded-xl bg-[#EAF3FC] dark:bg-slate-800 text-[#153B70] dark:text-sky-200 border-2 border-[#7AA7D9] dark:border-sky-600 text-sm font-semibold space-y-1'
                  }
                >
                  <p className={isBlindStudent ? 'text-amber-300' : 'text-[#153B70] dark:text-sky-300'}>
                    Status:{' '}
                    {blindVoiceState === 'armed'
                      ? 'Armed — listening for your command now'
                      : blindVoiceState === 'needs-gesture'
                        ? 'Tap anywhere or press any key once to activate microphone'
                        : blindVoiceState === 'unsupported'
                          ? 'Voice recognition unavailable in this browser'
                          : 'Always-On Mic Listening for "Hey AI" / "Hi AI"'}
                  </p>
                  {voiceStatus && (
                    <p className={isBlindStudent ? 'text-xs text-slate-200' : 'text-xs text-[#44566C] dark:text-slate-300'}>
                      {voiceStatus}
                    </p>
                  )}
                </div>
                <ul className="space-y-1.5 text-xs text-[#16253B] dark:text-slate-200 bg-[#F8FAFD] dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  {isOcdMode && (
                    <li>
                      &bull; &ldquo;Hey AI calibration wizard&rdquo; / &ldquo;Hey AI start camera&rdquo; /
                      &ldquo;Hey AI stop camera&rdquo; / &ldquo;Repeat step&rdquo; / &ldquo;Reset calibration&rdquo;
                    </li>
                  )}
                  <li>&bull; &ldquo;Hey AI open AI tutoring&rdquo; or &ldquo;Hey AI explain photosynthesis&rdquo;</li>
                  <li>&bull; &ldquo;Hi AI open live classes&rdquo;</li>
                  <li>&bull; &ldquo;Hey AI open study notes&rdquo; / &ldquo;Hey AI open exam&rdquo; / &ldquo;Hey AI results&rdquo;</li>
                  <li>&bull; &ldquo;Hey AI read this page&rdquo; / &ldquo;Hey AI stop audio&rdquo;</li>
                </ul>
                {isBlindStudent && (
                  <div className="p-3.5 rounded-xl bg-[#F8FAFD] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs text-[#16253B] dark:text-slate-200">
                    <p className="font-bold text-[#153B70] dark:text-amber-300">
                      Haptic Vibration Patterns ({isVibrationSupported() ? 'Supported' : 'Device-dependent'})
                    </p>
                    {(['success', 'navigate', 'error', 'wake', 'stop'] as const).map((cue) => (
                      <p key={cue}>
                        <strong>{HAPTIC_PATTERN_LABELS[cue].title}:</strong>{' '}
                        {HAPTIC_PATTERN_LABELS[cue].patternText} &mdash;{' '}
                        {HAPTIC_PATTERN_LABELS[cue].description}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-[#44566C] dark:text-slate-300">
                  Navigate across EduCare by saying commands such as &ldquo;Classes&rdquo;,
                  &ldquo;Materials&rdquo;, &ldquo;Tutor&rdquo;, &ldquo;Sign Language&rdquo;,
                  &ldquo;Exam&rdquo;, &ldquo;Result&rdquo;, or &ldquo;Home&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={onStartVoiceNav}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Mic className="w-4 h-4" aria-hidden="true" />
                  <span>Start Voice Navigation</span>
                </button>
                {voiceStatus && (
                  <p
                    className="p-3 rounded-lg bg-[#E9F4FF] dark:bg-sky-950/60 border border-blue-200 dark:border-sky-800 text-sm text-[#153B70] dark:text-sky-200"
                    aria-live="polite"
                  >
                    {voiceStatus}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {/* Text-to-Speech, Theme & Numeric Font Size */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            {hideSoundControls ? (
              <Sun className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />
            ) : (
              <Volume2 className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />
            )}
            <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
              {hideSoundControls
                ? 'Theme & Numeric Font Size'
                : 'Speech, Theme & Numeric Font Size'}
            </h3>
          </div>
          <p className="text-sm text-[#44566C] dark:text-slate-300">
            {hideSoundControls
              ? 'Adjust exact numeric font size or switch between Light and Dark mode.'
              : 'Adjust exact numeric font size, switch between Light and Dark mode, or listen aloud.'}
          </p>

          <div className="p-4 rounded-xl bg-[#F8FAFD] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="acc-font-slider"
                className="text-sm font-semibold text-[#153B70] dark:text-slate-100"
              >
                Text Size
              </label>
              <span className="font-mono text-sm font-bold text-[#1D6CE0] dark:text-sky-400 tabular-nums">
                {fontSize}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease text size"
                onClick={() => onChangeFontSize(Math.max(75, fontSize - 5))}
                className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-100 flex items-center justify-center cursor-pointer"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>

              <input
                id="acc-font-slider"
                type="range"
                min={75}
                max={150}
                step={5}
                value={fontSize}
                aria-valuetext={`${fontSize}%`}
                onChange={(e) => onChangeFontSize(Number(e.target.value))}
                className="flex-1 accent-[#1D6CE0] cursor-pointer"
              />

              <button
                type="button"
                aria-label="Increase text size"
                onClick={() => onChangeFontSize(Math.min(150, fontSize + 5))}
                className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-100 flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-[#52657C] dark:text-slate-400 tabular-nums px-1">
              <span>75%</span>
              <span>100%</span>
              <span>150%</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {!hideSoundControls && (
              <button
                type="button"
                onClick={onReadPage}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Volume2 className="w-4 h-4" aria-hidden="true" />
                <span>Read Page</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleTheme}
              aria-pressed={theme === 'dark'}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#153B70] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-[#153B70]" aria-hidden="true" />
              )}
              <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
            </button>
          </div>
        </section>

        {/* Eye-Controlled Navigation Preview */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400" aria-hidden="true" />
            <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
              Eye-Controlled Navigation
            </h3>
          </div>
          <p className="text-sm text-[#44566C] dark:text-slate-300">
            Future integration: Eye-tracking technology can help students navigate without using
            their hands.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void startEyeDemo()}
              disabled={cameraActive}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              <span>Start Camera Preview</span>
            </button>

            <button
              type="button"
              onClick={stopEyeDemo}
              disabled={!cameraActive}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#DF922C] hover:bg-[#C67F21] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <CameraOff className="w-4 h-4" aria-hidden="true" />
              <span>Stop Camera</span>
            </button>
          </div>

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Eye control camera preview"
            className="w-full max-w-md aspect-video bg-[#111827] rounded-xl object-cover"
          />

          <div className="p-3.5 rounded-xl bg-[#E9F4FF] dark:bg-sky-950/60 border border-blue-200 dark:border-sky-800 text-sm text-[#153B70] dark:text-sky-200">
            {eyeStatus}
          </div>
          <p className="text-xs text-[#52657C] dark:text-slate-400">
            Note: This preview only displays the camera. Actual eye tracking requires a compatible
            eye-tracking model and calibration.
          </p>
        </section>

        {/* Keyboard Accessibility */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-[#153B70] dark:text-sky-400" aria-hidden="true" />
            <h3 className="text-lg font-bold text-[#153B70] dark:text-slate-100">
              Keyboard Accessibility
            </h3>
          </div>
          <p className="text-sm text-[#44566C] dark:text-slate-300 leading-relaxed">
            Every navigation button, classroom control, study note download, and examination option
            in EduCare supports full keyboard-only operation.
          </p>
          <ul className="space-y-2.5 text-sm text-[#16253B] dark:text-slate-200 bg-[#F8FAFD] dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <li>
              <strong className="font-mono text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 px-2 py-0.5 rounded mr-2">
                Tab
              </strong>
              Move forward through links, tabs, inputs, and buttons.
            </li>
            <li>
              <strong className="font-mono text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 px-2 py-0.5 rounded mr-2">
                Shift + Tab
              </strong>
              Move backward to the previous interactive control.
            </li>
            <li>
              <strong className="font-mono text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 px-2 py-0.5 rounded mr-2">
                Enter / Space
              </strong>
              Activate the currently focused button, radio choice, or link.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};
