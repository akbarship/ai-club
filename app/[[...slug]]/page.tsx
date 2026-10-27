'use client';

import dynamic from 'next/dynamic';

// The mini app runs entirely in the browser (it needs window.Telegram), so it is never server-rendered.
const ClientApp = dynamic(() => import('@/client/ClientApp'), {
  ssr: false,
  loading: () => (
    <div className="center-screen">
      <div className="spinner" />
    </div>
  ),
});

export default function Page() {
  return <ClientApp />;
}
