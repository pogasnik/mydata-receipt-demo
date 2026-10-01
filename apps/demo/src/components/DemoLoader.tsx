'use client';

import dynamic from 'next/dynamic';

// Client-only: the form defaults to today's date in the visitor's time zone,
// which a build-time prerender cannot know.
const DemoApp = dynamic(() => import('./DemoApp'), {
  ssr: false,
  loading: () => (
    <p className="loading" role="status">
      Φόρτωση… <span className="label-en">Loading</span>
    </p>
  ),
});

export function DemoLoader() {
  return <DemoApp />;
}
