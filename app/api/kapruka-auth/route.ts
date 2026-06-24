import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 10, 60_000))
    return NextResponse.json({ success: false, message: 'Too many attempts.' }, { status: 429 });

  const { email, password } = await req.json();
  if (!email || !password)
    return NextResponse.json({ success: false, message: 'Email and password required.' }, { status: 400 });

  try {
    // Attempt Kapruka customer login via their web flow
    const formData = new URLSearchParams({
      'login[username]': email,
      'login[password]': password,
      form_key: 'tara_agent',
    });

    const r = await fetch('https://www.kapruka.com/customer/account/loginPost/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':   'Mozilla/5.0 (compatible; TARA-Agent/1.0)',
        'Referer':      'https://www.kapruka.com/customer/account/login/',
        'Origin':       'https://www.kapruka.com',
      },
      body: formData.toString(),
      redirect: 'manual',   // catch redirect instead of following
      signal: AbortSignal.timeout(8_000),
    });

    // Kapruka redirects to account page on success, login page on failure
    const location = r.headers.get('location') ?? '';
    const success  = r.status === 302 && !location.includes('/login');

    if (success) {
      // Extract name from Set-Cookie or location if possible
      const cookie = r.headers.get('set-cookie') ?? '';
      const name   = email.split('@')[0]; // fallback
      return NextResponse.json({ success: true, name });
    }

    return NextResponse.json({
      success: false,
      message: 'Incorrect email or password. Please check your Kapruka credentials.',
    });
  } catch {
    // Network error — tell the client gracefully
    return NextResponse.json({
      success: false,
      message: 'Could not reach Kapruka servers. Please try again or continue as guest.',
    }, { status: 503 });
  }
}
