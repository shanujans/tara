'use client';
import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { STRINGS, Lang, detectLang } from '@/lib/strings';
import { Product } from '@/context/CartContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  onProductsFound: (products: Product[], quantum?: boolean) => void;
  onSearching: (loading: boolean) => void;
  speakerOn: boolean;
  onSpeakerToggle: () => void;
}

function cleanAllTags(text: string): string {
  return text.replace(/<(search_query|quantum_search)[^>]*>[\s\S]*?<\/\1>/g, '').trim();
}

const SPEECH_LANG: Record<Lang, string> = {
  si: 'si-LK', ta: 'ta-IN', tl: 'en-US', en: 'en-US',
};

const LANG_BADGE = {
  si: { label: '🇱🇰 සිං', color: 'bg-green-600 text-white' },
  ta: { label: '🇱🇰 த',   color: 'bg-orange-500 text-white' },
  tl: { label: '🇱🇰 TL',  color: 'bg-amber-400 text-slate-900' },
  en: { label: '🇱🇰 EN',  color: 'bg-blue-600 text-white' },
};

export default function ChatPanel({
  lang,
  onLangChange,
  onProductsFound,
  onSearching,
  speakerOn,
}: ChatPanelProps) {
  const s = STRINGS[lang];

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: s.welcomeMsg },
  ]);
  const [input, setInput]           = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectedLang, setDetectedLang] = useState<Lang>('en');
  const [listening, setListening]   = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef    = useRef<AbortController | null>(null);
  // recognitionRef line (unchanged from the earlier replacement)
  const recognitionRef = useRef<unknown>(null);

  // voiceSupported (unchanged)
  const voiceSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognitionEvent || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Speak TARA response
  const speak = useCallback((text: string) => {
    if (!speakerOn || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/<[^>]*>/g, '').replace(/[✦*#]/g, '').trim();
    if (!clean) return;
    const utt = new SpeechSynthesisUtterance(clean);
    const voices = window.speechSynthesis.getVoices();
    const preferred = SPEECH_LANG[lang] ?? 'en-US';
    const match = voices.find(v => v.lang.startsWith(preferred.split('-')[0]));
    if (match) utt.voice = match;
    utt.rate = 1.05;
    window.speechSynthesis.speak(utt);
  }, [speakerOn, lang]);

  // stopListening – FIXED: type assertion on recognitionRef.current
  const stopListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognitionRef.current as any)?.stop();
    setListening(false);
  };

  // handleSendWithText – now defined BEFORE startListening
  const handleSendWithText = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const localDetected = detectLang(text);
    if (localDetected !== lang) onLangChange(localDetected);

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error('API error');

      const responseLang = res.headers.get('X-Detected-Lang') as Lang | null;
      if (responseLang) setDetectedLang(responseLang);

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText  = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: fullText };
          return copy;
        });
      }

      // Clean tags from display
      const visibleText = cleanAllTags(fullText);
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: visibleText };
        return copy;
      });

      // Speak response
      speak(visibleText);

      // Search products
      const sqMatch = fullText.match(/<search_query>([\s\S]*?)<\/search_query>/);
      const query   = sqMatch ? sqMatch[1].trim() : text;

      onSearching(true);
      try {
        const res2 = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ primary: query, alternative: query, creative: query }),
        });
        const { products } = await res2.json();
        onProductsFound(products);
      } catch { /* silent */ }
      finally { onSearching(false); }

      // Order tracking — detect order number pattern
      const orderMatch = fullText.match(/\b([A-Z]{2,6}\d{4,}[A-Z0-9]*)\b/);
      if (orderMatch) {
        // silently attempt track — fail safe
        try {
          const MCP = process.env.NEXT_PUBLIC_MCP_URL ?? 'https://mcp.kapruka.com/mcp';
          const r = await fetch(MCP, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
            body: JSON.stringify({ tool: 'track_order', params: { order_number: orderMatch[1] } }),
          });
          if (r.ok) {
            const { status } = await r.json();
            if (status) {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: `📦 Order ${orderMatch[1]}: ${status}`,
              }]);
            }
          }
        } catch { /* silent */ }
      }

    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: '⚠️ Something went wrong. Please try again.' },
        ]);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  // startListening – MOVED after handleSendWithText to avoid closure issue
  const startListening = () => {
    if (!voiceSupported) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.lang = SPEECH_LANG[lang] ?? 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript as string;
      setInput(transcript);
      setListening(false);
      setTimeout(() => handleSendWithText(transcript), 150);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend   = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const handleSend = () => handleSendWithText(input.trim());

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-amber-400/20">
                <span className="text-slate-900 text-xs font-black">T</span>
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-amber-400 text-slate-900 font-medium rounded-br-sm'
                  : 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-bl-sm'
              }`}
            >
              {msg.content || (isStreaming && i === messages.length - 1 ? (
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              ) : '')}
            </div>
          </div>
        ))}

        {/* Typing indicator when waiting for first chunk */}
        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-400/20">
              <span className="text-slate-900 text-xs font-black">T</span>
            </div>
            <div className="bg-slate-800 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-bl-sm">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Language badge */}
      <div className="px-4 pt-1 flex justify-end">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full transition-all duration-500 ${LANG_BADGE[detectedLang].color}`}>
          {LANG_BADGE[detectedLang].label}
        </span>
      </div>

      {/* Input area */}
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="flex gap-2 items-end bg-slate-800 border border-slate-700 rounded-2xl px-3 py-2 focus-within:border-amber-400/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={s.chatPlaceholder}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none outline-none leading-relaxed max-h-32 py-0.5"
            style={{ scrollbarWidth: 'none', minHeight: '24px' }}
            disabled={isStreaming}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex-shrink-0 w-8 h-8 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 rounded-xl flex items-center justify-center transition-all duration-200 hover:shadow-md hover:shadow-amber-400/30 active:scale-90 mb-0.5"
            aria-label={s.sendBtn}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Mic button */}
          {voiceSupported && (
            <button
              onClick={listening ? stopListening : startListening}
              disabled={isStreaming}
              className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 mb-0.5 relative ${
                listening
                  ? 'bg-red-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
              aria-label={listening ? 'Stop listening' : 'Voice input'}
            >
              {listening && (
                <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-60" />
              )}
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="4" y="0.5" width="5" height="7" rx="2.5" fill="currentColor"/>
                <path d="M1.5 6.5a5 5 0 0010 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="6.5" y1="11.5" x2="6.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Hint text */}
        <p className="text-xs text-center mt-2 transition-all duration-300">
          {listening
            ? <span className="text-red-400 font-medium animate-pulse">🎙 TARA is listening...</span>
            : <span className="text-slate-600">{s.typing} · Shift+Enter for new line</span>
          }
        </p>
      </div>
    </div>
  );
}