/**
 * /api/feedback/route.ts
 *
 * Receives 👎 feedback from chat UI and appends a structured entry to
 * mistakes.md in the project root (or /tmp/mistakes.md on Vercel).
 * Useful for QA, debugging, and future troubleshooting of TARA responses.
 */
import { NextRequest, NextResponse } from 'next/server';
import { appendFile, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

interface FeedbackBody {
  category:  string;
  issue:     string;
  response:  string;
  context:   { role: string; content: string }[];
  lang:      string;
  timestamp: string;
}

// Project root in dev; /tmp in Vercel (ephemeral but writable)
const FILE_PATH = (() => {
  try {
    // In Next.js dev/build, cwd is the project root
    return join(process.cwd(), 'mistakes.md');
  } catch {
    return '/tmp/mistakes.md';
  }
})();

const HEADER = `# TARA Mistakes Log

Issues reported by users via 👎 feedback.
Use this file to debug and improve TARA responses over time.

---
`;

function buildEntry(body: FeedbackBody, num: number): string {
  const ts = new Date(body.timestamp).toLocaleString('en-LK', {
    timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short',
  });

  const ctx = (body.context ?? [])
    .map(m => `  > **${m.role === 'user' ? 'User' : 'TARA'}:** ${m.content.slice(0, 300)}${m.content.length > 300 ? '…' : ''}`)
    .join('\n');

  const badResponse = (body.response ?? '').slice(0, 600);

  return [
    `\n## Issue #${num} — ${ts}`,
    '',
    `**Category:** ${body.category || 'Uncategorised'}`,
    `**Language:** ${(body.lang ?? 'en').toUpperCase()}`,
    '',
    `**User reported:**`,
    `> ${body.issue?.trim() || '(no description provided)'}`,
    '',
    `**TARA response that triggered this:**`,
    `> ${badResponse.replace(/\n/g, '\n> ')}`,
    '',
    `**Conversation context (last ${body.context?.length ?? 0} messages):**`,
    ctx || '  *(no context)*',
    '',
    '---',
    '',
  ].join('\n');
}

export async function POST(req: NextRequest) {
  let body: FeedbackBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    // Read existing file to count issues; create with header if absent
    let existing = '';
    try {
      existing = await readFile(FILE_PATH, 'utf-8');
    } catch {
      await writeFile(FILE_PATH, HEADER, 'utf-8');
      existing = HEADER;
    }

    const issueNum = (existing.match(/^## Issue #/gm) ?? []).length + 1;
    const entry    = buildEntry(body, issueNum);

    await appendFile(FILE_PATH, entry, 'utf-8');

    console.log(`[feedback] Issue #${issueNum} saved → ${FILE_PATH}`);
    return NextResponse.json({ success: true, issue: issueNum, path: FILE_PATH });

  } catch (err) {
    console.error('[feedback] write failed:', err);
    return NextResponse.json({ error: 'Could not save feedback' }, { status: 500 });
  }
}
