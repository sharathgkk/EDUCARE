import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#159B83] hover:bg-[#11836E] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
      >
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Install Offline App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#153B70] dark:text-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Install App (iOS)</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-heading"
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl space-y-3">
              <h3
                id="ios-install-heading"
                className="text-lg font-bold text-[#153B70] dark:text-slate-100"
              >
                Install EduCare on iPhone / iPad
              </h3>
              <p className="text-sm text-[#44566C] dark:text-slate-300 leading-relaxed">
                1. Tap the <strong>Share</strong> button in the Safari toolbar.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong> for offline access to
                study materials and classes.
              </p>
              <button
                type="button"
                data-nod-confirm="true"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[42px] rounded-xl bg-[#153B70] hover:bg-[#102E59] text-white text-sm font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
