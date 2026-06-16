/**
 * app/embed-demo/layout.tsx
 *
 * Server component that provides metadata for the /embed-demo route.
 * The page.tsx itself is 'use client' (needed for extension detection),
 * so metadata lives here instead.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TARA Live Demo — AI Agent for Kapruka.com',
  description:
    'See TARA, the multilingual AI Retail Agent, running live inside Kapruka.com. ' +
    'Install the Chrome extension or explore the interactive demo. Kapruka Agent Challenge — GMEU6.',
};

export default function EmbedDemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
