import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  cachedMaterialsCount?: number;
  cachedClassesCount?: number;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  cachedMaterialsCount,
  cachedClassesCount,
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  const hasCounts =
    typeof cachedMaterialsCount === 'number' && typeof cachedClassesCount === 'number';

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed bottom-4 left-4 z-50 max-w-sm flex items-start gap-2.5 rounded-xl bg-amber-500 dark:bg-amber-400 px-3.5 py-2.5 text-xs font-bold text-slate-950 shadow-xl border-2 border-slate-950/20"
    >
      <WifiOff className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p className="leading-snug">Offline Mode — Cached study notes &amp; classes active.</p>
        {hasCounts && (
          <p className="text-[11px] font-semibold opacity-90 mt-0.5 tabular-nums">
            {cachedMaterialsCount} materials · {cachedClassesCount} classes available offline
          </p>
        )}
      </div>
    </div>
  );
};
