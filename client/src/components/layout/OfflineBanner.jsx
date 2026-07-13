import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useSync from '../../hooks/useSync';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline, pendingCount, syncing, sync } = useSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`text-center py-1 small ${isOnline ? 'bg-info-subtle' : 'bg-warning-subtle'}`}>
      {!isOnline && (
        <span className="me-2 d-inline-flex align-items-center gap-1">
          <AlertTriangle size={14} /> {t('common.offline')}
        </span>
      )}
      {pendingCount > 0 && (
        <span>
          {t('common.pendingSync', { count: pendingCount })}
          {isOnline && (
            <button className="btn btn-sm btn-link p-0 ms-2" onClick={sync} disabled={syncing}>
              {syncing ? t('common.loading') : t('common.syncNow')}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
