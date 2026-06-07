'use client';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { STRINGS, Lang, detectLang } from '@/lib/strings';
import { Product } from '@/context/CartContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  onProductsFound: (products: Product[]) => void;
  onSearching: (loading: boolean) => void;
}

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || 'https://mcp.kapruka.com/mcp';

async function searchProducts(query: string): Promise<Product[]> {
  try {
    const r = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'search_products', params: { query, limit: 8 } }),
    });
    if (!r.ok) throw new Error('MCP error');
    const data = await r.json();
    // Map Kapruka MCP response to Product shape
    const raw = data.products || data.results || data.data || [];
    return raw.map((p: Record<string, unknown>, idx: number) => ({
      id: String((p.id as string | number) || idx),
      name: String(p.name || p.title || 'Product'),
      price: Number(p.price || p.amount || 0),
      image: String(p.image || p.imageUrl || p.thumbnail || ''),
      url: String(p.url || p.link || ''),
    }));
  } catch {
    // Fallback mock products for demo / MCP unavailable
    return generateMockProducts(query);
  }
}

function generateMockProducts(query: string): Product[] {
  const items = [
    { name: `${query} - Premium Pack`, price: 2450, img: 'https://placehold.co/300x300/1e293b/f59e0b?text=Product+1' },
    { name: `${query} - Standard`, price: 1890, img: 'https://placehold.co/300x300/1e293b/f59e0b?text=Product+2' },
    { name: `${query} - Value Pack`, price: 3200, img: 'https://placehold.co/300x300/1e293b/f59e0b?text=Product+3' },
    { name: `Best ${query} Sri Lanka`, price: 1650, img: 'https://placehold.co/300x300/1e293b/f59e0b?text=Product+4' },
    { name: `${query} - Kapruka Pick`, price: 2100, img: 'https://placehold.co/300x300/1e293b/f59e0b?text=Product+5' },
    { name: `${query} - Gift Set`, price: 4500, img: 'https://placehold.co/300x300/1e293b/f59e0b?text=Product+6' },
  ];
  return items.map((it, i) => ({
    id: `mock-${i}-${Date.now()}`,
    name: it.name,
    price: it.price,
    image: it.img,
  }));
}

function extractSearchQuery(text: string): string | null {
  const match = text.match(/<search_query>([\s\S]*?)<\/search_query>/);
  return match ? match[1].trim() : null;
}

function cleanMessage(text: string): string {
  return text.replace(/<search_query>[\s\S]*?<\/search_query>/g, '').trim();
}

export default function ChatPanel({ lang, onLangChange, onProductsFound, onSearching }: ChatPanelProps) {
  const s = STRINGS[lang];
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: s.welcomeMsg },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    // Detect language from user input
    const detectedLang = detectLang(text);
    if (detectedLang !== lang) onLangChange(detectedLang);

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

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

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

      // Extract search query and fetch products
      const query = extractSearchQuery(fullText);
      if (query) {
        // Clean the displayed message
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: cleanMessage(fullText) };
          return copy;
        });
        onSearching(true);
        const products = await searchProducts(query);
        onProductsFound(products);
        onSearching(false);
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

        {/* Typing indicator (while waiting for first chunk) */}
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

      {/* Input area */}
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="flex gap-2 items-end bg-slate-800 border border-slate-700 rounded-2xl px-3 py-2 focus-within:border-amber-400/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={s.chatPlaceholder}
            rows={1}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none outline-none leading-relaxed max-h-32 py-0.5"
            style={{ scrollbarWidth: 'none' }}
            disabled={isStreaming}
          />
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
        </div>
        <p className="text-slate-600 text-xs text-center mt-2">
          {s.typing} · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
