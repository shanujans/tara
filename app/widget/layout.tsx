/**
 * app/widget/layout.tsx
 *
 * Minimal segment layout for the /widget iframe route.
 *
 * In Next.js App Router, segment layouts compose on top of the root layout —
 * they don't replace it. The root app/layout.tsx keeps providing context
 * providers (CartProvider, LanguageProvider, etc.) which the widget page needs.
 *
 * What this layout does:
 *   • Sets widget-specific metadata (no indexing — iframe content shouldn't be
 *     crawled as a standalone page)
 *   • Applies global CSS that strips any root-level padding/margin so the
 *     widget fills the iframe exactly
 *   • Does NOT add any nav, headers, or chrome of its own
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TARA Widget',
  description: 'TARA AI Shopping Assistant — embedded widget for Kapruka.com',
  robots: { index: false, follow: false },
};

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/*
        Inline style tag strips any padding/margin the root layout may apply
        to <body> or <main>, ensuring the widget fills the iframe with no gaps.
        Using a <style> tag here rather than a CSS module so this scoped reset
        is applied only within the /widget segment.
      */}
      <style>{`
        /* Widget-specific global reset — scoped to /widget route */
        html, body {
          height: 100%;
          height: 100dvh;
          overflow: hidden;
          margin: 0 !important;
          padding: 0 !important;
          background: #0d0d1a !important;
        }

        /* If root layout wraps children in a container with padding, cancel it */
        body > * {
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>
      {children}
    </>
  );
}
