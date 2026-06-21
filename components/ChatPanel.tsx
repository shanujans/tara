'use client';
import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { STRINGS, Lang } from '@/lib/strings';
import { useCart, Product } from '@/context/CartContext';
import { detectExpat, detectExpatCountry } from '@/lib/expat';
import ExpatBanner from './ExpatBanner';

interface Message { role: 'user' | 'assistant'; content: string; }

interface CartItem { id: string; name: string; price: number; image: string; qty?: number; }
interface LastOrder  { order_id: string; items: CartItem[]; date: string; }

interface ChatPanelProps {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  onProductsFound: (products: Product[], quantum?: boolean) => void;
  onSearching: (v: boolean) => void;
  speakerOn: boolean;
  onSpeakerToggle: () => void;
}

type DetectedLang = Lang;

function detectLangClient(text: string): DetectedLang {
  if (/[\u0D80-\u0DFF]/.test(text)) return 'si';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/\b(machang|machan|aiyo|oneda|aney|yako|putha)\b/i.test(text)) return 'tl';
  if (/\b(mama|api|eka|ekak|ona|nehe|koheda|mokada|puluwan|bohoma|hariyata|hadanna|karanna|balanna|ganna|denna|yanawa|thiyenawa|gedara|amma|thaththa|akka|aiya|nangi|malli|hondai|hari|tika|godak|wage|wela|isthuti|ayubowan|inna|yawanna|ganna|tiyenawa|wenawa)\b/i.test(text)) return 'sl';
  if (/\b(la|neh|ne|da)\s*[.!?,]?\s*$/im.test(text.trim())) return 'tl';
  return 'en';
}

function cleanResponse(text: string): string {
  return text
    .replace(/<search_query>[\s\S]*?<\/search_query>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

function extractQuery(text: string): string | null {
  const m = text.match(/<search_query>([\s\S]*?)<\/search_query>/);
  return m ? m[1].trim() : null;
}

const SPEECH_LANG: Record<Lang, string> = { si: 'si-LK', sl: 'si-LK', ta: 'ta-IN', tl: 'en-US', en: 'en-US' };

/* Language pill config — gradient style for active */
const LANG_OPTIONS: { key: Lang; label: string }[] = [
  { key: 'si', label: '🇱🇰 සිං' },
  { key: 'sl', label: '🇱🇰 SL'  },
  { key: 'ta', label: '🇱🇰 த'   },
  { key: 'tl', label: '🇱🇰 TL'  },
  { key: 'en', label: '🇬🇧 EN'  },
];

export default function ChatPanel({
  lang, onLangChange, onProductsFound, onSearching, speakerOn,
}: ChatPanelProps) {
  const s = STRINGS[lang];
  const { addItem } = useCart();

  const buildInitial = useCallback((l: Lang): Message[] => {
    const msgs: Message[] = [{ role: 'assistant', content: STRINGS[l].welcomeMsg }];
    if (new Date().getMonth() === 5) {
      msgs.push({ role: 'assistant', content: STRINGS[l].fathersDayHint });
    }
    return msgs;
  }, []);

  const [messages,     setMessages]     = useState<Message[]>(() => buildInitial(lang));
  const [input,        setInput]        = useState('');
  const [streaming,    setStreaming]    = useState(false);
  const [convLang,     setConvLang]     = useState<Lang>(lang);
  const [listening,    setListening]    = useState(false);
  const [voiceOk,      setVoiceOk]      = useState(false);
  const [expatMode,    setExpatMode]    = useState(false);
  const [expatCountry, setExpatCountry] = useState('');
  const [showExpat,    setShowExpat]    = useState(false);
  const [lastOrder,    setLastOrder]    = useState<LastOrder | null>(null);
  const [reorderDone,  setReorderDone]  = useState(false);

  const bottomRef        = useRef<HTMLDivElement>(null);
  const textareaRef      = useRef<HTMLTextAreaElement>(null);
  const abortRef         = useRef<AbortController | null>(null);
  const recRef           = useRef<unknown>(null);
  const sessionStartRef  = useRef<number | null>(null);

  useEffect(() => {
    setVoiceOk(!!(
      typeof window !== 'undefined' &&
      ((window as unknown as Record<string, unknown>).SpeechRecognition ||
       (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
    ));
    try {
      const raw = localStorage.getItem('tara_last_order');
      if (raw) setLastOrder(JSON.parse(raw));
    } catch { /* */ }
  }, []);

  useEffect(() => {
    setMessages(buildInitial(lang));
    setConvLang(lang);
  }, [lang, buildInitial]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 112)}px`;
  }, [input]);

  const speak = useCallback((text: string) => {
    if (!speakerOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 300));
    u.lang = SPEECH_LANG[convLang] ?? 'en-US';
    window.speechSynthesis.speak(u);
  }, [speakerOn, convLang]);

  const handleReorder = () => {
    if (!lastOrder) return;
    lastOrder.items.forEach(i => addItem({ id: i.id, name: i.name, price: i.price, image: i.image }));
    setReorderDone(true);
    setMessages(prev => [...prev, { role: 'assistant', content: s.reorderAdded }]);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    if (!messages.some(m => m.role === 'user')) {
      sessionStartRef.current = Date.now();
      try { localStorage.setItem('tara_session_start', String(Date.now())); } catch { /* */ }
    }

    const detected = detectLangClient(text);
    setConvLang(detected);
    if (detected !== lang) onLangChange(detected);

    const isNewExpat = !expatMode && detectExpat(text);
    const effectiveExpatMode = expatMode || isNewExpat;
    if (isNewExpat) {
      const country = detectExpatCountry(text);
      setExpatMode(true); setExpatCountry(country); setShowExpat(true);
    }

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history, expatMode: effectiveExpatMode, lang: detected }),
        signal:  abortRef.current.signal,
      });
      if (!res.ok) throw new Error('API error');

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const c = [...prev];
          c[c.length - 1] = { role: 'assistant', content: full };
          return c;
        });
      }

      const visible = cleanResponse(full);
      setMessages(prev => {
        const c = [...prev];
        c[c.length - 1] = { role: 'assistant', content: visible };
        return c;
      });
      speak(visible);

      const query = extractQuery(full);
      if (query) {
        onSearching(true);
        try {
          const r2 = await fetch('/api/search', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ primary: query }),
          });
          const d = await r2.json();
          if (d.products?.length) onProductsFound(d.products, d.quantum);
        } catch { /* silent */ }
        finally { onSearching(false); }
      }

      const orderMatch = text.match(/\b([A-Z]{2,6}\d{4,}[A-Z0-9]*)\b/);
      if (orderMatch) {
        try {
          const r3 = await fetch('/api/track', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_number: orderMatch[1] }),
          });
          if (r3.ok) {
            const { status } = await r3.json();
            if (status) setMessages(prev => [...prev, { role: 'assistant', content: `📦 Order ${orderMatch[1]}: ${status}` }]);
          }
        } catch { /* silent */ }
      }

    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Something went wrong. Please try again.' }]);
      }
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, lang, expatMode, onLangChange, onProductsFound, onSearching, speak, s.reorderAdded]);

  const startListening = async () => {
    if (!voiceOk) return;
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { alert('Allow microphone access.'); return; }
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ??
               (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    const rec = new (SR as new () => { lang: string; interimResults: boolean; onresult: unknown; onerror: unknown; onend: unknown; start: () => void; })();
    rec.lang           = SPEECH_LANG[convLang] ?? 'en-US';
    rec.interimResults = false;
    rec.onresult       = (e: { results: { 0: { 0: { transcript: string } } }[] }) => { setListening(false); sendMessage(e.results[0][0].transcript); };
    rec.onerror        = () => setListening(false);
    rec.onend          = () => setListening(false);
    recRef.current     = rec;
    rec.start();
    setListening(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input.trim()); }
  };

  const hasUserMsgs = messages.some(m => m.role === 'user');
  const showReorder = !hasUserMsgs && !reorderDone && lastOrder && lastOrder.items.length > 0;
  const reorderItemName = lastOrder?.items[0]?.name ?? '';

  /* ── Typing dots shared node ──────────────────────────── */
  const TypingDots = (
    <span className="flex gap-1 items-center" style={{ height: 16 }}>
      {[0, 200, 400].map(d => (
        <span key={d} className="dot-bounce rounded-full"
          style={{ width: 6, height: 6, background: 'var(--t-purple-light, #6b4dab)', animationDelay: `${d}ms` }} />
      ))}
    </span>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: 'transparent' }}>

      {/* ── Messages ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">

        {showExpat && (
          <ExpatBanner country={expatCountry} onDismiss={() => setShowExpat(false)} />
        )}

        {messages.map((msg, i) => (
          <div key={i}
            className={`flex gap-2.5 ${msg.role === 'user'
              ? 'justify-end animate-slide-in-right'
              : 'justify-start animate-slide-in-left'}`}
          >
            {/* TARA avatar */}
            {msg.role === 'assistant' && (
              <div className="tara-avatar flex-shrink-0 mt-0.5" style={{ width: 28, height: 28 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 900 }}>T</span>
              </div>
            )}

            {/* Bubble */}
            <div className={`max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
              msg.role === 'user' ? 'bubble-user' : 'bubble-tara'
            }`}
              style={{ color: msg.role === 'user' ? 'var(--t-charcoal)' : 'var(--t-text-1)' }}
            >
              {msg.content || (streaming && i === messages.length - 1 ? TypingDots : '')}
            </div>
          </div>
        ))}

        {/* Standalone typing indicator */}
        {streaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-2.5 justify-start animate-slide-in-left">
            <div className="tara-avatar flex-shrink-0" style={{ width: 28, height: 28 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 900 }}>T</span>
            </div>
            <div className="bubble-tara px-4 py-3">{TypingDots}</div>
          </div>
        )}

        {/* Reorder card */}
        {showReorder && (
          <div className="flex gap-2.5 justify-start animate-slide-in-left" style={{ animationDelay: '400ms' }}>
            <div className="tara-avatar flex-shrink-0 mt-0.5" style={{ width: 28, height: 28 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 900 }}>T</span>
            </div>
            <div className="max-w-[82%] bubble-tara overflow-hidden" style={{ borderColor: 'var(--t-border-gold)' }}>
              <div className="px-3.5 pt-2.5 pb-2">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--t-text-1)' }}>
                  {s.reorderPrompt}
                </p>
                {reorderItemName && (
                  <p className="text-xs font-semibold mt-0.5 line-clamp-1 gradient-text-gold">
                    {reorderItemName}{lastOrder && lastOrder.items.length > 1
                      ? ` +${lastOrder.items.length - 1} more` : ''}
                  </p>
                )}
              </div>
              <div className="flex" style={{ borderTop: '1px solid var(--t-border)' }}>
                <button onClick={handleReorder}
                  className="flex-1 py-2 text-xs font-bold transition-colors"
                  style={{ color: 'var(--t-gold)' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(250,229,85,0.08)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                >
                  🔄 {s.reorderBtn}
                </button>
                <button onClick={() => setReorderDone(true)}
                  className="px-3 py-2 text-xs transition-colors"
                  style={{ borderLeft: '1px solid var(--t-border)', color: 'var(--t-text-4)' }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick chips */}
        {!hasUserMsgs && !streaming && (
          <div className="flex flex-wrap gap-2 mt-1 animate-slide-in-left" style={{ animationDelay: '600ms' }}>
            {s.quickChips.map(chip => (
              <button key={chip}
                onClick={() => {
                  if (chip.includes('✈️') || chip.includes('abroad') || chip.includes('Wideshayen') || chip.includes('வெளிநாட்டில்')) {
                    setExpatMode(true); setExpatCountry('🌍 Overseas'); setShowExpat(true);
                    sendMessage(chip);
                  } else {
                    sendMessage(chip);
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '7px 14px',
                  borderRadius: 9999,
                  fontSize: '0.775rem',
                  color: '#c9b8d8',
                  background: 'rgba(26,18,58,0.75)',
                  border: '1px solid rgba(107,77,171,0.28)',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  transition: 'all 0.18s ease',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(64,41,112,0.35)'; e.currentTarget.style.borderColor = 'rgba(107,77,171,0.55)'; e.currentTarget.style.color = '#F5E9E2'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(26,18,58,0.75)'; e.currentTarget.style.borderColor = 'rgba(107,77,171,0.28)'; e.currentTarget.style.color = '#c9b8d8'; }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Language bar ─────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: '8px 12px',
          borderTop: '1px solid rgba(107,77,171,0.30)',
          borderBottom: '1px solid rgba(107,77,171,0.30)',
          background: 'rgba(5,3,15,0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {/* Globe icon */}
          <span style={{ color: '#52436a', fontSize: '0.8rem', flexShrink: 0, marginRight: 2 }}>🌐</span>

          {LANG_OPTIONS.map(o => {
            const isActive = convLang === o.key;
            return (
              <button
                key={o.key}
                onClick={() => { onLangChange(o.key); setConvLang(o.key); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '5px 13px',
                  borderRadius: 9999,
                  fontSize: '0.7rem',
                  fontWeight: isActive ? 700 : 600,
                  letterSpacing: '0.01em',
                  border: isActive
                    ? '1px solid transparent'
                    : '1px solid rgba(107,77,171,0.30)',
                  background: isActive
                    ? 'linear-gradient(135deg,#402970,#6b4dab)'
                    : 'rgba(26,18,58,0.55)',
                  color: isActive ? '#fff' : '#8878a0',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: isActive ? '0 2px 10px rgba(64,41,112,0.40)' : 'none',
                  transition: 'all 0.18s ease',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Input bar ────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: '10px 12px',
        borderTop: '1px solid rgba(107,77,171,0.30)',
        background: 'rgba(5,3,15,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'rgba(17,11,46,0.90)',
          border: '1px solid rgba(107,77,171,0.32)',
          borderRadius: 18,
          padding: '8px 12px',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={s.chatPlaceholder}
            disabled={streaming}
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed max-h-28 py-0.5"
            style={{
              color: 'var(--t-text-1)',
              scrollbarWidth: 'none',
              minHeight: '22px',
            }}
          />

          {/* Send button */}
          <button
            onClick={() => sendMessage(input.trim())}
            disabled={!input.trim() || streaming}
            className="flex-shrink-0 flex items-center justify-center rounded-xl transition-all active:scale-90 mb-0.5"
            style={{
              width: 34, height: 34,
              background: input.trim() && !streaming
                ? 'var(--t-grad-purple)'
                : 'rgba(26,18,58,0.6)',
              color: input.trim() && !streaming ? 'white' : 'var(--t-text-4)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Mic button */}
          {voiceOk && (
            <button
              onClick={listening
                ? () => { (recRef.current as { stop: () => void })?.stop(); setListening(false); }
                : startListening}
              disabled={streaming}
              className="flex-shrink-0 flex items-center justify-center rounded-xl transition-all mb-0.5 relative"
              style={{
                width: 34, height: 34,
                background: listening ? '#ef4444' : 'rgba(26,18,58,0.6)',
                color: listening ? 'white' : 'var(--t-text-3)',
              }}
            >
              {listening && (
                <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping"
                  style={{ opacity: 0.5 }} />
              )}
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="4" y="0.5" width="5" height="7" rx="2.5" fill="currentColor"/>
                <path d="M1.5 6.5a5 5 0 0010 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="6.5" y1="11.5" x2="6.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        <p className="text-xs text-center mt-1.5">
          {listening
            ? <span className="font-medium animate-pulse" style={{ color: '#ef4444' }}>🎙 Listening…</span>
            : <span style={{ color: 'var(--t-text-4)' }}>Shift+Enter for new line</span>
          }
        </p>
      </div>
    </div>
  );
}
