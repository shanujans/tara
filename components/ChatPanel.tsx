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
  if (/\b(la|neh|ne|da)\s*[.!?,]?\s*$/im.test(text.trim())) return 'tl';
  if (/\b(bohoma|hariyata|puluwan|mokada|ekak|apita|oyata)\b/i.test(text)) return 'tl';
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

const SPEECH_LANG: Record<Lang, string> = { si: 'si-LK', ta: 'ta-IN', tl: 'en-US', en: 'en-US' };

const LANG_OPTIONS: { key: Lang; label: string; active: string }[] = [
  { key: 'si', label: '🇱🇰 සිං', active: 'bg-green-600 text-white' },
  { key: 'ta', label: '🇱🇰 த',   active: 'bg-orange-500 text-white' },
  { key: 'tl', label: '🇱🇰 TL',  active: 'bg-amber-400 text-slate-900' },
  { key: 'en', label: '🇬🇧 EN',  active: 'bg-blue-600 text-white' },
];

export default function ChatPanel({
  lang, onLangChange, onProductsFound, onSearching, speakerOn,
}: ChatPanelProps) {
  const s = STRINGS[lang];
  const { addItem } = useCart();

  // ── Build initial messages (welcome + Father's Day hint in June) ──────────
  const buildInitial = useCallback((l: Lang): Message[] => {
    const msgs: Message[] = [{ role: 'assistant', content: STRINGS[l].welcomeMsg }];
    if (new Date().getMonth() === 5) { // June = month 5
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
  const [showPicker,   setShowPicker]   = useState(false);
  // Reorder state
  const [lastOrder,    setLastOrder]    = useState<LastOrder | null>(null);
  const [reorderDone,  setReorderDone]  = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const recRef      = useRef<unknown>(null);
  // Session start time — set on first user message
  const sessionStartRef = useRef<number | null>(null);

  // Voice support detection
  useEffect(() => {
    setVoiceOk(!!(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    ));
  }, []);

  // ── Check localStorage for previous order (reorder loop) ─────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tara_last_order');
      if (raw) {
        const order: LastOrder = JSON.parse(raw);
        // Only show if order was placed in last 90 days
        const age = Date.now() - new Date(order.date).getTime();
        if (age < 90 * 24 * 60 * 60 * 1000 && order.items?.length) {
          setLastOrder(order);
        }
      }
    } catch { /* ignore localStorage errors */ }
  }, []);

  // ── Reset welcome when lang changes (before first user message) ──────────
  useEffect(() => {
    setMessages(prev => {
      if (prev.some(m => m.role === 'user')) return prev;
      return buildInitial(lang);
    });
    setConvLang(lang);
  }, [lang, buildInitial]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const speak = useCallback((text: string) => {
    if (!speakerOn || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt   = new SpeechSynthesisUtterance(text.replace(/[✦*#<>]/g, '').trim());
    const voices = window.speechSynthesis.getVoices();
    const pref   = SPEECH_LANG[convLang] ?? 'en-US';
    const match  = voices.find(v => v.lang.startsWith(pref.split('-')[0]));
    if (match) utt.voice = match;
    utt.rate = 1.05;
    window.speechSynthesis.speak(utt);
  }, [speakerOn, convLang]);

  // ── Reorder: rebuild cart from last order ─────────────────────────────────
  const handleReorder = () => {
    if (!lastOrder) return;
    lastOrder.items.forEach(item => {
      addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
    });
    setReorderDone(true);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `${STRINGS[convLang].reorderAdded} 🛒`,
    }]);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;

    // Start session timer on FIRST user message
    if (!messages.some(m => m.role === 'user')) {
      sessionStartRef.current = Date.now();
      try { localStorage.setItem('tara_session_start', String(Date.now())); } catch { /* */ }
    }

    const detected = detectLangClient(text);
    setConvLang(detected);
    if (detected !== lang) onLangChange(detected);

    if (!expatMode && detectExpat(text)) {
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
        body:    JSON.stringify({ messages: history, expatMode, lang: detected }),
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

      // Search only if AI included a <search_query> tag
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

      // Order tracking
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
  };

  const startListening = async () => {
    if (!voiceOk) return;
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { alert('Allow microphone access.'); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.lang           = SPEECH_LANG[convLang] ?? 'en-US';
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult       = (e: any) => { setListening(false); sendMessage(e.results[0][0].transcript); };
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
  const currentOpt  = LANG_OPTIONS.find(o => o.key === convLang) ?? LANG_OPTIONS[3];

  // Reorder card: show only before user messages, once, if last order exists
  const showReorder = !hasUserMsgs && !reorderDone && lastOrder && lastOrder.items.length > 0;
  const reorderItemName = lastOrder?.items[0]?.name ?? '';

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {showExpat && <ExpatBanner country={expatCountry} onDismiss={() => setShowExpat(false)} />}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end animate-slide-in-right' : 'justify-start animate-slide-in-left'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
                <span className="text-slate-900 text-xs font-black">T</span>
              </div>
            )}
            <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
              msg.role === 'user'
                ? 'bg-amber-400 text-slate-900 font-medium rounded-br-sm'
                : 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-bl-sm'
            }`}>
              {msg.content || (streaming && i === messages.length - 1
                ? <span className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full dot-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full dot-bounce" style={{ animationDelay: '200ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full dot-bounce" style={{ animationDelay: '400ms' }} />
                  </span>
                : ''
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {streaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-2 justify-start animate-slide-in-left">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-slate-900 text-xs font-black">T</span>
            </div>
            <div className="bg-slate-800 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-bl-sm">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full dot-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full dot-bounce" style={{ animationDelay: '200ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full dot-bounce" style={{ animationDelay: '400ms' }} />
              </span>
            </div>
          </div>
        )}

        {/* ── Reorder card (self-sustaining loop) ─────────────────────────── */}
        {showReorder && (
          <div className="flex gap-2 justify-start animate-slide-in-left" style={{ animationDelay: '400ms' }}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
              <span className="text-slate-900 text-xs font-black">T</span>
            </div>
            <div className="max-w-[82%] bg-slate-800 border border-amber-400/30 rounded-2xl rounded-bl-sm overflow-hidden">
              <div className="px-3.5 pt-2.5 pb-2">
                <p className="text-slate-100 text-sm leading-relaxed">
                  {s.reorderPrompt}
                </p>
                {reorderItemName && (
                  <p className="text-amber-400 text-xs font-semibold mt-0.5 line-clamp-1">
                    {reorderItemName}{lastOrder && lastOrder.items.length > 1 ? ` +${lastOrder.items.length - 1} more` : ''}
                  </p>
                )}
              </div>
              <div className="flex border-t border-slate-700/50">
                <button
                  onClick={handleReorder}
                  className="flex-1 py-2 text-xs font-bold text-amber-400 hover:bg-amber-400/10 transition-colors"
                >
                  🔄 {s.reorderBtn}
                </button>
                <button
                  onClick={() => setReorderDone(true)}
                  className="px-3 py-2 text-xs text-slate-500 hover:text-slate-300 border-l border-slate-700/50 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick chips — before first user message */}
        {!hasUserMsgs && !streaming && (
          <div className="flex flex-wrap gap-2 mt-1 animate-slide-in-left" style={{ animationDelay: '600ms' }}>
            {s.quickChips.map(chip => (
              <button key={chip} onClick={() => sendMessage(chip)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 hover:border-amber-400/50 px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95">
                {chip}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Lang badge */}
      <div className="px-3 pt-1 pb-0.5 flex justify-end relative">
        <button
          onClick={() => setShowPicker(v => !v)}
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full transition-all duration-300 flex items-center gap-1 ${currentOpt.active}`}
        >
          {currentOpt.label}
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        {showPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
            <div className="absolute right-3 bottom-full mb-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-20">
              {LANG_OPTIONS.map(o => (
                <button key={o.key} onClick={() => { onLangChange(o.key); setConvLang(o.key); setShowPicker(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold hover:bg-slate-700 transition-colors text-left ${o.key === convLang ? 'text-amber-400' : 'text-slate-300'}`}>
                  <span className={`w-2 h-2 rounded-full ${o.key === convLang ? 'bg-amber-400' : 'bg-slate-600'}`} />
                  {o.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 px-3 py-2.5">
        <div className="flex gap-2 items-end bg-slate-800 border border-slate-700 rounded-2xl px-3 py-2 focus-within:border-amber-400/50 transition-colors">
          <textarea ref={textareaRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={s.chatPlaceholder}
            disabled={streaming}
            rows={1}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none outline-none leading-relaxed max-h-28 py-0.5"
            style={{ scrollbarWidth: 'none', minHeight: '22px' }}
          />
          <button onClick={() => sendMessage(input.trim())} disabled={!input.trim() || streaming}
            className="flex-shrink-0 w-8 h-8 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {voiceOk && (
            <button onClick={listening ? () => { (recRef.current as { stop: () => void })?.stop(); setListening(false); } : startListening}
              disabled={streaming}
              className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all mb-0.5 relative ${listening ? 'bg-red-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
              {listening && <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-60" />}
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
            ? <span className="text-red-400 font-medium animate-pulse">🎙 Listening…</span>
            : <span className="text-slate-600">Shift+Enter for new line</span>
          }
        </p>
      </div>
    </div>
  );
}