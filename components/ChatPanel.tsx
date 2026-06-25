'use client';
import { useState, useRef, useEffect, useCallback, KeyboardEvent, MutableRefObject } from 'react';
import { STRINGS, Lang } from '@/lib/strings';
import { useCart, Product } from '@/context/CartContext';
import { detectExpat, detectExpatCountry } from '@/lib/expat';
import ExpatBanner from './ExpatBanner';
import { MicIcon, SendIcon, AttachIcon, AddCartIcon, CheckIcon, GlobeIcon } from './Icons';

/* ── Types ─────────────────────────────────────────────────── */
interface Message { role: 'user' | 'assistant'; content: string; products?: Product[]; imagePreview?: string; }
interface PendingImage { base64: string; mimeType: string; preview: string; }
interface ChatPanelProps {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  onProductsFound: (products: Product[], quantum?: boolean) => void;
  onSearching: (v: boolean) => void;
  speakerOn: boolean;
  onSpeakerToggle: () => void;
  autoSend?: string;
  onAutoSendDone?: () => void;
  onClearRef?: MutableRefObject<(() => void) | null>;
}

/* ── Utils ─────────────────────────────────────────────────── */
function detectLangClient(text: string): Lang {
  if (/[\u0D80-\u0DFF]/.test(text)) return 'si';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/\b(machang|machan|aiyo|oneda|aney|yako|putha)\b/i.test(text)) return 'tl';
  if (/\b(mama|api|eka|ekak|ona|nehe|koheda|mokada|puluwan|bohoma|hariyata|gedara|amma|thaththa|akka|aiya|nangi|malli|hondai|hari|tika|godak|isthuti|ayubowan)\b/i.test(text)) return 'sl';
  if (/\b(la|neh|ne|da)\s*[.!?,]?\s*$/im.test(text.trim())) return 'tl';
  return 'en';
}
function cleanResponse(t: string) {
  return t.replace(/<search_query>[\s\S]*?<\/search_query>/g,'').replace(/<[^>]+>/g,'').replace(/```[\s\S]*?```/g,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/^#{1,6}\s+/gm,'').trim();
}
function extractQuery(t: string) { const m = t.match(/<search_query>([\s\S]*?)<\/search_query>/); return m ? m[1].trim() : null; }
function proxyImg(url: string) { if (!url) return ''; return url.includes('kapruka.com') ? `/api/img?url=${encodeURIComponent(url)}` : url; }
const SPEECH_LANG: Record<Lang,string> = { si:'si-LK',sl:'si-LK',ta:'ta-IN',tl:'en-US',en:'en-US' };
const LANG_OPTS: { key:Lang; label:string }[] = [
  {key:'si',label:'🇱🇰 සිං'},{key:'sl',label:'🇱🇰 SL'},
  {key:'ta',label:'🇱🇰 த'},{key:'tl',label:'🇱🇰 TL'},{key:'en',label:'🇬🇧 EN'},
];

/* ── Inline chat card — with lazy image fetch ───────────────── */
function InlineChatCard({ product, lang, onViewDetail }: {
  product: Product & { url?: string };
  lang: Lang;
  onViewDetail?: (id: string, url: string) => void;
}) {
  const { addItem, items } = useCart();
  const s = STRINGS[lang];
  const [added,   setAdded]   = useState(false);
  const [imgOk,   setImgOk]   = useState<boolean | null>(null);
  const [lazyImg, setLazyImg] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const inCart  = items.some(i => i.id === product.id);

  /* Lazy-fetch image from /api/product if search result has no image */
  useEffect(() => {
    const src = proxyImg(product.image || lazyImg);
    if (src || !product.id) return;
    let cancelled = false;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      fetch('/api/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id }),
      })
        .then(r => r.json())
        .then(d => { if (!cancelled) setLazyImg(d?.product?.image || d?.product?.image_url || ''); })
        .catch(() => {});
    }, { rootMargin: '60px' });
    if (cardRef.current) obs.observe(cardRef.current);
    return () => { cancelled = true; obs.disconnect(); };
  }, [product.id, product.image, lazyImg]);

  const imgSrc = proxyImg(product.image || lazyImg);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({ id: product.id, name: product.name, price: product.price, image: product.image });
    setAdded(true); setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div ref={cardRef} className="chat-product-card"
      onClick={() => onViewDetail?.(product.id, product.url ?? '')}
      role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onViewDetail?.(product.id, product.url ?? ''); }}>
      <div style={{ position:'relative', height:110, background:'var(--c-surface-container)', overflow:'hidden' }}>
        {imgOk !== true && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:'2rem', opacity:0.08 }}>📦</span>
          </div>
        )}
        {imgSrc && imgOk !== false && (
          <img src={imgSrc} alt={product.name} loading="lazy"
            style={{ width:'100%', height:'100%', objectFit:'cover', opacity:imgOk===true?1:0, transition:'opacity 0.35s' }}
            onLoad={() => setImgOk(true)} onError={() => setImgOk(false)}
          />
        )}
        {inCart && (
          <div style={{ position:'absolute', top:5, right:5, background:'var(--c-primary-container)', color:'var(--c-on-primary-container)', borderRadius:9999, padding:'1px 6px', fontSize:10, fontWeight:800 }}>✓</div>
        )}
      </div>
      <div style={{ padding:'8px 10px' }}>
        <p className="line-clamp-2" style={{ fontSize:12, fontWeight:700, color:'var(--c-on-surface)', lineHeight:1.3 }}>{product.name}</p>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
          <span className="product-price" style={{ fontSize:12 }}>{s.lkr} {product.price.toLocaleString('si-LK')}</span>
          <button onClick={handleAdd} title={s.addToCart}
            style={{ width:28, height:28, borderRadius:8, flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:added?'rgba(34,197,94,0.20)':'var(--c-surface-container-lowest)', color:added?'#4ade80':'var(--c-primary)', border:'1px solid rgba(74,68,81,0.30)', transition:'all 0.15s' }}
            onMouseOver={e => { if(!added){ e.currentTarget.style.background='var(--c-primary-container)'; e.currentTarget.style.color='var(--c-on-primary-container)'; }}}
            onMouseOut={e => { if(!added){ e.currentTarget.style.background='var(--c-surface-container-lowest)'; e.currentTarget.style.color='var(--c-primary)'; }}}>
            {added ? <CheckIcon size={13}/> : <AddCartIcon size={13}/>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main ChatPanel ─────────────────────────────────────────── */
export default function ChatPanel({
  lang, onLangChange, onProductsFound, onSearching,
  autoSend, onAutoSendDone, onClearRef,
}: ChatPanelProps) {
  const s = STRINGS[lang];
  const { addItem } = useCart();

  const buildInitial = useCallback((l: Lang): Message[] => {
    const msgs: Message[] = [{ role:'assistant', content:STRINGS[l].welcomeMsg }];
    if (new Date().getMonth() === 5) msgs.push({ role:'assistant', content:STRINGS[l].fathersDayHint });
    return msgs;
  }, []);

  const [messages,     setMessages]     = useState<Message[]>(() => buildInitial(lang));
  const [input,        setInput]        = useState('');
  const [streaming,    setStreaming]     = useState(false);
  const [convLang,     setConvLang]     = useState<Lang>(lang);
  const [listening,    setListening]    = useState(false);
  const [voiceOk,      setVoiceOk]      = useState(false);
  const [expatMode,    setExpatMode]    = useState(false);
  const [expatCountry, setExpatCountry] = useState('');
  const [showExpat,    setShowExpat]    = useState(false);
  const [lastOrder,    setLastOrder]    = useState<{ items:{id:string;name:string;price:number;image:string}[] }|null>(null);
  const [reorderDone,  setReorderDone]  = useState(false);
  const [modalId,      setModalId]      = useState<string|null>(null);
  const [modalUrl,     setModalUrl]     = useState('');
  /* Image upload state */
  const [pendingImg,   setPendingImg]   = useState<PendingImage|null>(null);
  const [visionLoading,setVisionLoading]= useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef    = useRef<AbortController|null>(null);
  const recRef      = useRef<unknown>(null);
  const fileInputRef= useRef<HTMLInputElement>(null);

  /* Expose clear to parent */
  useEffect(() => {
    if (onClearRef) onClearRef.current = () => {
      setMessages(buildInitial(lang)); setReorderDone(false); setExpatMode(false); setShowExpat(false); setPendingImg(null);
    };
  }, [onClearRef, lang, buildInitial]);

  useEffect(() => {
    setVoiceOk(!!(typeof window !== 'undefined' && ((window as unknown as Record<string,unknown>).SpeechRecognition || (window as unknown as Record<string,unknown>).webkitSpeechRecognition)));
    try { const raw = localStorage.getItem('tara_last_order'); if (raw) setLastOrder(JSON.parse(raw)); } catch { /**/ }
  }, []);

  /* KEY FIX: only sync convLang, NEVER reset messages on lang change */
  useEffect(() => { setConvLang(lang); }, [lang]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, streaming]);
  useEffect(() => {
    const ta = textareaRef.current; if (!ta) return;
    ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 112)}px`;
  }, [input]);

  /* Auto-send from Browse panel */
  useEffect(() => {
    if (autoSend?.trim()) { sendMessage(autoSend); onAutoSendDone?.(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

  /* ── Image helpers ──────────────────────────────────────── */
  const handleFileSelect = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB.'); return; }
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      const base64 = result.split(',')[1];
      setPendingImg({ base64, mimeType: file.type, preview: result });
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const f = items[i].getAsFile(); if (f) { handleFileSelect(f); e.preventDefault(); } break;
      }
    }
  };

  /* ── Vision search ──────────────────────────────────────── */
  const runVisionSearch = useCallback(async (img: PendingImage) => {
    setVisionLoading(true);
    setPendingImg(null);
    const userMsg: Message = { role:'user', content:'Find similar products for this image', imagePreview: img.preview };
    setMessages(prev => [...prev, userMsg]);
    const thinkingMsg: Message = { role:'assistant', content:'🔍 Analysing your image…' };
    setMessages(prev => [...prev, thinkingMsg]);

    try {
      const r = await fetch('/api/vision-search', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ imageBase64: img.base64, mimeType: img.mimeType }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);

      const desc = d.description || 'product';
      const query = d.query || 'gift';

      setMessages(prev => {
        const c = [...prev];
        c[c.length-1] = { role:'assistant', content:`I can see **${desc}**. Searching Kapruka for similar products…` };
        return c;
      });

      onSearching(true);
      const sr = await fetch('/api/search', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ primary: query }),
      });
      const sd = await sr.json();
      if (sd.products?.length) {
        onProductsFound(sd.products, sd.quantum);
        setMessages(prev => {
          const c = [...prev];
          c[c.length-1] = {
            ...c[c.length-1],
            content: `I can see **${desc}**. Here are matching products on Kapruka:`,
            products: sd.products.slice(0,4),
          };
          return c;
        });
      } else {
        setMessages(prev => {
          const c = [...prev];
          c[c.length-1] = { role:'assistant', content:`I can see **${desc}**, but couldn't find an exact match. Try describing it in the chat!` };
          return c;
        });
      }
    } catch (err) {
      setMessages(prev => {
        const c = [...prev];
        c[c.length-1] = { role:'assistant', content:`⚠️ Couldn't analyse the image. Try describing the product in words!` };
        return c;
      });
    } finally { setVisionLoading(false); onSearching(false); }
  }, [onProductsFound, onSearching]);

  /* ── Send text message ──────────────────────────────────── */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const detected = detectLangClient(text);
    setConvLang(detected);
    if (detected !== lang) onLangChange(detected);

    const isNewExpat = !expatMode && detectExpat(text);
    if (isNewExpat) { setExpatMode(true); setExpatCountry(detectExpatCountry(text)); setShowExpat(true); }

    const history = [...messages, { role:'user' as const, content:text }];
    setMessages(history); setInput(''); setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages:history, expatMode: expatMode||isNewExpat, lang:detected }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error('API error');

      const reader = res.body!.getReader(); const decoder = new TextDecoder(); let full = '';
      setMessages(prev => [...prev, { role:'assistant', content:'' }]);

      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        full += decoder.decode(value, { stream:true });
        setMessages(prev => { const c=[...prev]; c[c.length-1]={role:'assistant',content:full}; return c; });
      }

      const visible = cleanResponse(full);
      setMessages(prev => { const c=[...prev]; c[c.length-1]={role:'assistant',content:visible}; return c; });

      /* Search + attach inline products */
      const query = extractQuery(full);
      if (query) {
        onSearching(true);
        try {
          const r2 = await fetch('/api/search', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({primary:query}) });
          const d = await r2.json();
          if (d.products?.length) {
            onProductsFound(d.products, d.quantum);
            setMessages(prev => { const c=[...prev]; c[c.length-1]={...c[c.length-1],products:d.products.slice(0,4)}; return c; });
          }
        } catch {/***/} finally { onSearching(false); }
      }

      /* Order tracking */
      const om = text.match(/\b([A-Z]{2,6}\d{4,}[A-Z0-9]*)\b/);
      if (om) {
        try {
          const r3 = await fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_number:om[1]})});
          if (r3.ok) { const {status}=await r3.json(); if (status) setMessages(prev=>[...prev,{role:'assistant',content:`📦 Order ${om[1]}: ${status}`}]); }
        } catch {/***/}
      }
    } catch (err: unknown) {
      if ((err as Error).name!=='AbortError') setMessages(prev=>[...prev,{role:'assistant',content:'⚠️ Something went wrong. Please try again.'}]);
    } finally { setStreaming(false); }
  }, [messages, streaming, lang, expatMode, onLangChange, onProductsFound, onSearching]);

  const startListening = async () => {
    if (!voiceOk) return;
    try { await navigator.mediaDevices.getUserMedia({ audio:true }); } catch { alert('Allow microphone access.'); return; }
    const SR = (window as unknown as Record<string,unknown>).SpeechRecognition ?? (window as unknown as Record<string,unknown>).webkitSpeechRecognition;
    const rec = new (SR as new() => { lang:string; interimResults:boolean; onresult:unknown; onerror:unknown; onend:unknown; start:()=>void })();
    rec.lang = SPEECH_LANG[convLang]; rec.interimResults = false;
    rec.onresult = (e:{results:ArrayLike<ArrayLike<{transcript:string}>>}) => { setListening(false); sendMessage((e.results[0] as ArrayLike<{transcript:string}>)[0].transcript); };
    rec.onerror = () => setListening(false); rec.onend = () => setListening(false);
    recRef.current = rec; (rec as {start:()=>void}).start(); setListening(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input.trim()); }
  };

  const handleSend = () => {
    if (pendingImg) { runVisionSearch(pendingImg); return; }
    sendMessage(input.trim());
  };

  const hasUserMsgs = messages.some(m => m.role==='user');
  const chipClasses = ['chip-secondary','chip-primary','chip-neutral','chip-neutral'];
  const TypingDots = (
    <span className="flex gap-1.5 items-center" style={{height:18}}>
      {[0,200,400].map(d=><span key={d} className="dot-bounce rounded-full"
        style={{width:7,height:7,background:'var(--c-primary-container)',animationDelay:`${d}ms`}}/>)}
    </span>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'transparent' }}>

      {/* ── Messages ───────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 8px' }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>
          {showExpat && <ExpatBanner country={expatCountry} onDismiss={()=>setShowExpat(false)}/>}

          {messages.map((msg,i)=>(
            <div key={i}
              className={`flex gap-3 ${msg.role==='user'?'justify-end animate-slide-in-right':'animate-slide-in-left'}`}
              style={{marginBottom:12}}>

              {msg.role==='assistant' && (
                <img src="/kapruka-logo.png" alt="TARA"
                  style={{width:28,height:28,borderRadius:'50%',objectFit:'contain',flexShrink:0,marginTop:2,background:'var(--c-secondary)',padding:3}}
                  onError={e=>{(e.target as HTMLImageElement).style.display='none';}}
                />
              )}

              <div style={{display:'flex',flexDirection:'column',gap:4,maxWidth:msg.role==='user'?480:undefined,flex:msg.role==='assistant'?1:undefined,minWidth:0}}>
                {/* User image preview */}
                {msg.role==='user' && msg.imagePreview && (
                  <div style={{display:'flex',justifyContent:'flex-end',marginBottom:4}}>
                    <img src={msg.imagePreview} alt="Uploaded"
                      style={{maxHeight:120,maxWidth:200,borderRadius:12,objectFit:'cover',border:'1px solid rgba(215,186,255,0.30)'}}/>
                  </div>
                )}
                <div className={msg.role==='user'?'bubble-user':'bubble-tara'}
                  style={{padding:'12px 15px',fontSize:15,lineHeight:1.6,wordBreak:'break-word'}}>
                  {msg.content || (streaming && i===messages.length-1 ? TypingDots : '')}
                  {/* Inline products */}
                  {msg.role==='assistant' && msg.products && msg.products.length>0 && (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginTop:14}}>
                      {msg.products.map(p=>(
                        <InlineChatCard key={p.id} product={p as Product&{url?:string}} lang={lang}
                          onViewDetail={(id,url)=>{setModalId(id);setModalUrl(url);}}/>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing */}
          {(streaming||visionLoading) && messages[messages.length-1]?.role!=='assistant' && (
            <div className="flex gap-3 animate-slide-in-left" style={{marginBottom:12}}>
              <img src="/kapruka-logo.png" alt="TARA"
                style={{width:28,height:28,borderRadius:'50%',objectFit:'contain',flexShrink:0,background:'var(--c-secondary)',padding:3}}
                onError={e=>{(e.target as HTMLImageElement).style.display='none';}}
              />
              <div className="bubble-tara" style={{padding:'12px 15px'}}>{TypingDots}</div>
            </div>
          )}

          {/* Reorder card */}
          {!hasUserMsgs && !reorderDone && lastOrder && lastOrder.items.length>0 && (
            <div className="flex gap-3 animate-slide-in-left" style={{animationDelay:'400ms',marginBottom:12}}>
              <img src="/kapruka-logo.png" alt="TARA"
                style={{width:28,height:28,borderRadius:'50%',objectFit:'contain',flexShrink:0,marginTop:2,background:'var(--c-secondary)',padding:3}}
                onError={e=>{(e.target as HTMLImageElement).style.display='none';}}
              />
              <div className="bubble-tara overflow-hidden" style={{maxWidth:360,borderColor:'rgba(197,205,101,0.35)'}}>
                <div style={{padding:'12px 15px 8px'}}>
                  <p style={{fontSize:14,lineHeight:1.6}}>{s.reorderPrompt}</p>
                  {lastOrder.items[0]?.name && <p className="gradient-text-gold" style={{fontSize:12,fontWeight:700,marginTop:2}}>{lastOrder.items[0].name}{lastOrder.items.length>1?` +${lastOrder.items.length-1} more`:''}</p>}
                </div>
                <div style={{display:'flex',borderTop:'1px solid rgba(74,68,81,0.30)'}}>
                  <button onClick={()=>{lastOrder.items.forEach(i=>addItem({id:i.id,name:i.name,price:i.price,image:i.image}));setReorderDone(true);setMessages(prev=>[...prev,{role:'assistant',content:s.reorderAdded}]);}}
                    style={{flex:1,padding:'9px',fontSize:12,fontWeight:700,color:'var(--c-secondary)',background:'transparent',cursor:'pointer',transition:'background 0.15s',fontFamily:'var(--font-body)',border:'none'}}>🔄 {s.reorderBtn}</button>
                  <button onClick={()=>setReorderDone(true)} style={{padding:'9px 12px',fontSize:12,borderLeft:'1px solid rgba(74,68,81,0.30)',color:'var(--c-outline)',cursor:'pointer',background:'transparent',border:'none'}}>✕</button>
                </div>
              </div>
            </div>
          )}

          {/* Quick chips */}
          {!hasUserMsgs && !streaming && (
            <div style={{display:'flex',flexWrap:'wrap',gap:8,paddingLeft:40,paddingBottom:8}} className="animate-slide-in-left">
              {s.quickChips.map((chip,idx)=>(
                <button key={chip} onClick={()=>sendMessage(chip)} className={`action-chip ${chipClasses[idx%chipClasses.length]}`}>{chip}</button>
              ))}
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
      </div>

      {/* Language bar */}
      <div style={{flexShrink:0,padding:'8px 16px',borderTop:'1px solid rgba(74,68,81,0.20)',background:'rgba(21,16,36,0.65)',backdropFilter:'blur(8px)'}}>
        <div style={{maxWidth:760,margin:'0 auto',display:'flex',alignItems:'center',gap:8,overflowX:'auto'}} className="scrollbar-none">
          <GlobeIcon style={{color:'var(--c-outline)',flexShrink:0}}/>
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            {LANG_OPTS.map(o=>(
              <button key={o.key} onClick={()=>{onLangChange(o.key);setConvLang(o.key);}}
                className={`lang-pill${convLang===o.key?' active':''}`}
                style={{transform:convLang===o.key?'scale(1.05)':'scale(1)',whiteSpace:'nowrap'}}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Input bar ─────────────────────────────────────────── */}
      <div style={{flexShrink:0,padding:'10px 16px',paddingBottom:'max(10px,env(safe-area-inset-bottom))',borderTop:'1px solid rgba(74,68,81,0.15)',background:'rgba(21,16,36,0.65)',backdropFilter:'blur(12px)'}}>
        <div style={{maxWidth:760,margin:'0 auto'}}>

          {/* Image preview strip */}
          {pendingImg && (
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,padding:'6px 10px',background:'rgba(44,39,60,0.80)',borderRadius:12,border:'1px solid rgba(215,186,255,0.25)'}}>
              <img src={pendingImg.preview} alt="Preview"
                style={{height:52,width:52,objectFit:'cover',borderRadius:8,border:'1px solid rgba(215,186,255,0.30)',flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:12,fontWeight:600,color:'var(--c-on-surface)'}}>Image ready</p>
                <p style={{fontSize:11,color:'var(--c-on-surface-variant)'}}>Press send to search for this product</p>
              </div>
              <button onClick={()=>setPendingImg(null)} style={{color:'var(--c-outline)',background:'transparent',border:'none',cursor:'pointer',fontSize:18,lineHeight:1}}>✕</button>
            </div>
          )}

          <div className="chat-input-bar" style={{display:'flex',alignItems:'flex-end',gap:6,padding:'10px 14px'}}>
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}}
              onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFileSelect(f); e.target.value=''; }}/>

            {/* Camera / attach icon — clicks file input */}
            <button
              title="Upload or paste an image to search"
              onClick={()=>fileInputRef.current?.click()}
              style={{color:pendingImg?'var(--c-secondary)':'var(--c-on-surface-variant)',cursor:'pointer',flexShrink:0,background:'transparent',border:'none',padding:2,display:'flex',transition:'color 0.15s'}}>
              {pendingImg
                ? <span style={{fontSize:18}}>🖼️</span>
                : <AttachIcon/>}
            </button>

            <textarea ref={textareaRef} value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={pendingImg ? 'Add a note (optional) or press Send…' : s.chatPlaceholder}
              disabled={streaming||visionLoading} rows={1}
              style={{flex:1,background:'transparent',border:'none',outline:'none',resize:'none',fontSize:15,lineHeight:1.5,color:'var(--c-on-surface)',scrollbarWidth:'none',minHeight:24,fontFamily:'var(--font-body)',paddingBottom:2}}/>

            {voiceOk && !pendingImg && (
              <button onClick={listening?()=>{(recRef.current as {stop:()=>void})?.stop();setListening(false);}:startListening}
                disabled={streaming}
                style={{width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:listening?'#ef4444':'transparent',color:listening?'white':'var(--c-on-surface-variant)',cursor:'pointer',flexShrink:0,border:'none',position:'relative',transition:'all 0.18s'}}>
                {listening&&<span style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(239,68,68,0.4)',animation:'quantum-pulse 1s ease-in-out infinite'}}/>}
                <MicIcon size={18}/>
              </button>
            )}

            <button onClick={handleSend}
              disabled={(!input.trim()&&!pendingImg)||streaming||visionLoading}
              className="btn-primary"
              style={{width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,opacity:((!input.trim()&&!pendingImg)||streaming||visionLoading)?0.4:1,boxShadow:(input.trim()||pendingImg)&&!streaming?'0 4px 12px rgba(189,147,249,0.30)':'none'}}>
              <SendIcon size={18}/>
            </button>
          </div>

          <p style={{textAlign:'center',fontSize:10,color:'var(--c-outline)',marginTop:5,letterSpacing:'0.08em',textTransform:'uppercase',fontWeight:700}}>
            {listening?<span style={{color:'#ef4444'}}>🎙 Listening…</span>:visionLoading?<span style={{color:'var(--c-primary)'}}>✦ Analysing image…</span>:'Paste image or Shift+Enter for new line • TARA Protocol'}
          </p>
        </div>
      </div>

      {modalId && <ProductModalWrapper productId={modalId} productUrl={modalUrl} lang={lang} onClose={()=>{setModalId(null);setModalUrl('');}}/>}
    </div>
  );
}

function ProductModalWrapper({productId,productUrl,lang,onClose}:{productId:string;productUrl:string;lang:Lang;onClose:()=>void}) {
  const [Comp,setComp]=useState<React.ComponentType<{productId:string;productUrl:string;lang:Lang;onClose:()=>void}>|null>(null);
  useEffect(()=>{import('./ProductModal').then(m=>setComp(()=>m.default));},[]);
  if (!Comp) return null;
  return <Comp productId={productId} productUrl={productUrl} lang={lang} onClose={onClose}/>;
}
