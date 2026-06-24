'use client';
import { useState } from 'react';
import { UserIcon, XIcon } from './Icons';

export interface UserInfo { email: string; name: string; isGuest: boolean; }

interface LoginModalProps { onDone: (user: UserInfo) => void; }

export default function LoginModal({ onDone }: LoginModalProps) {
  const [mode,     setMode]     = useState<'choice' | 'login'>('choice');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const continueGuest = () =>
    onDone({ email: '', name: 'Guest', isGuest: true });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setLoading(true); setError('');
    try {
      const r  = await fetch('/api/kapruka-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (d.success) {
        onDone({ email, name: d.name || email.split('@')[0], isGuest: false });
      } else {
        setError(d.message || 'Incorrect email or password.');
      }
    } catch {
      setError('Could not reach Kapruka. Continuing as guest…');
      setTimeout(continueGuest, 1800);
    } finally { setLoading(false); }
  };

  const btn = (onClick: () => void, label: string, primary: boolean) => (
    <button type="button" onClick={onClick}
      style={{
        width: '100%', padding: '13px 0', borderRadius: 12,
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        background: primary ? 'var(--c-primary-container)' : 'transparent',
        color:      primary ? 'var(--c-on-primary-container)' : 'var(--c-on-surface-variant)',
        border: primary ? 'none' : '1px solid rgba(74,68,81,0.45)',
        transition: 'opacity 0.15s, transform 0.15s',
        marginBottom: 10,
      }}
      onMouseOver={e => { e.currentTarget.style.opacity = '0.88'; }}
      onMouseOut={e =>  { e.currentTarget.style.opacity = '1';    }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10,7,24,0.92)', backdropFilter: 'blur(10px)',
    }}>
      <div style={{
        width: 360, borderRadius: 22, overflow: 'hidden',
        background: 'var(--c-surface-container)',
        border: '1px solid rgba(74,68,81,0.35)',
        boxShadow: '0 28px 72px rgba(0,0,0,0.70)',
      }}>

        {/* Shader banner */}
        <div style={{ position: 'relative', height: 90, overflow: 'hidden' }}>
          {/* Shader canvas — reuse SidebarShader inline via iframe trick or just a CSS gradient */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, #1d0e38 0%, #714aaa 45%, #d7baff 75%, #ffd700 95%)',
            opacity: 0.85,
          }} />
          {/* Logo centred on banner */}
          <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/kapruka-logo.png" alt="Kapruka"
              style={{ height: 52, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.50))' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '22px 28px 26px' }}>
          <h2 className="font-headline" style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-on-surface)', textAlign: 'center', marginBottom: 4 }}>
            Welcome to TARA
          </h2>
          <p style={{ fontSize: 13, color: 'var(--c-on-surface-variant)', textAlign: 'center', marginBottom: 22 }}>
            AI Retail Agent · Kapruka Sri Lanka
          </p>

          {mode === 'choice' ? (
            <>
              {btn(() => setMode('login'), '🔑  Login with Kapruka Account', true)}
              {btn(continueGuest, 'Continue as Guest  →', false)}
              <p style={{ fontSize: 11, color: 'var(--c-outline)', textAlign: 'center', marginTop: 4, lineHeight: 1.5 }}>
                Login to access order history, saved addresses & faster checkout.
              </p>
            </>
          ) : (
            <form onSubmit={handleLogin}>
              <input
                type="email" placeholder="Kapruka email"
                value={email} onChange={e => setEmail(e.target.value)}
                className="cart-input" style={{ marginBottom: 10 }}
                autoFocus
              />
              <input
                type="password" placeholder="Password"
                value={password} onChange={e => setPassword(e.target.value)}
                className="cart-input" style={{ marginBottom: error ? 8 : 16 }}
              />
              {error && (
                <p style={{ fontSize: 12, color: 'var(--c-error)', marginBottom: 12, lineHeight: 1.4 }}>{error}</p>
              )}
              <button type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 12,
                  fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'var(--c-primary-container)', color: 'var(--c-on-primary-container)',
                  border: 'none', marginBottom: 10, opacity: loading ? 0.6 : 1,
                  fontFamily: 'var(--font-body)',
                }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <button type="button" onClick={() => { setMode('choice'); setError(''); }}
                style={{ width: '100%', padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: 'var(--c-on-surface-variant)', border: 'none', fontFamily: 'var(--font-body)' }}>
                ← Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
