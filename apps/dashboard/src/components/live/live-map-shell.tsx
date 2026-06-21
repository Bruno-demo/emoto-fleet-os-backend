'use client';

import dynamic from 'next/dynamic';
import { useTranslation } from '../i18n/LanguageProvider';

function LoadingLiveMap() {
  const { t } = useTranslation();
  return (
    <div className="h-[80vh] min-h-[640px] rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
      {t('Loading live map...')}
    </div>
  );
}

const LiveMapPanel = dynamic(
  () => import('@/components/live/live-map').then((module) => module.LiveMapPanel),
  {
    ssr: false,
    loading: () => <LoadingLiveMap />,
  },
);

export function LiveMapShell() {
  return <LiveMapPanel />;
}

