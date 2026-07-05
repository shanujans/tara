'use client';

// ─── Data shape ──────────────────────────────────────────────────────────────
export interface InvoiceLineItem {
  id: string; name: string; price: number; qty: number; image?: string;
}

export interface InvoiceData {
  state: 'unpaid' | 'paid';
  orderId: string;
  orderDate: string;          // ISO string (includes time)
  checkoutUrl?: string;
  qrCode?: string;            // data URI — generated from checkoutUrl via qrcode pkg
  giftCardImage?: string;     // data URI — AI-generated via /api/generate-gift-card
  items: InvoiceLineItem[];
  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;
  deliveryDate: string;
  specialInstructions?: string;
  deliveryFee?: number;
  grandTotal: number;
  occasion?: string;
  giftMessage?: string;
  senderName?: string;
  senderEmail?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PURPLE  = '#422B75';
const SALMON  = '#F5E9E2';
const SKY     = '#DCF0FA';
const MINT    = '#E3F4E8';

function fmtLKR(n: number) {
  return `LKR ${n.toLocaleString('si-LK')}`;
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return iso; }
}
function proxyImg(url: string) {
  if (!url) return '';
  if (url.includes('kapruka.com')) return `/api/img?url=${encodeURIComponent(url)}`;
  return url;
}

const EYEBROW: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: '#64748b', marginBottom: 6,
};
const SECTION_HEAD: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.07em', color: '#64748b', marginBottom: 10,
};

// ─── Component ───────────────────────────────────────────────────────────────
// All styles are INLINE — required for html2canvas capture. Width fixed at 794px.
export default function InvoiceTemplate({ data }: { data: InvoiceData }) {
  const isPaid   = data.state === 'paid';
  const subtotal = data.items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div style={{
      width: 794, background: '#FDFDFD', color: '#0f172a', padding: '36px 40px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      lineHeight: 1.4,
    }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 20, marginBottom: 20 }}>

        {/* Left: brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 auto', minWidth: 250 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kapruka-logo.png" crossOrigin="anonymous" alt="K"
            style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: PURPLE, letterSpacing: '-0.01em' }}>KAPRUKA</span>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>×</span>
              
              {/* TARA Avatar - Widened wrapper so it centers horizontally without overlapping text */}
              <div style={{ width: 50, height: 28, position: 'relative', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/cartoon.jpg" crossOrigin="anonymous" alt="TARA"
                  style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    left: 0, 
                    width: 50,       
                    height: 50,      
                    borderRadius: '50%', 
                    objectFit: 'cover'
                  }} />
              </div>

              <span style={{ fontSize: 14, fontWeight: 700, color: PURPLE }}>TARA AI Shopping Agent</span>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Order Confirmation &amp; Payment Sheet</div>
          </div>
        </div>

        {/* Right: badge + order info */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 6,
            borderRadius: 999, 
            border: `1px solid ${isPaid ? '#6ee7b7' : '#fcd34d'}`,
            background: isPaid ? '#ecfdf5' : '#fffbeb',
            color: isPaid ? '#065f46' : '#78350f',
            padding: '6px 16px', // Adjusted padding for a better pill shape
            fontSize: 10, 
            fontWeight: 700, 
            letterSpacing: '0.03em', 
            marginBottom: 8,
            whiteSpace: 'nowrap',
            lineHeight: 1 // This stops the text from sitting too high/low
          }}>
            <span style={{ fontSize: 12 }}>{isPaid ? '✓' : '⚠'}</span>
            <span>{isPaid ? 'PAID' : 'UNPAID — PENDING SYSTEM PAY'}</span>
          </span>
          
          <div style={{ textAlign: 'right', fontSize: 11, color: '#475569', lineHeight: 1.8 }}>
            <div>Order No. <b style={{ color: '#0f172a', fontWeight: 700 }}>{data.orderId}</b></div>
            <div>Placed: {fmtDateTime(data.orderDate)}</div>
          </div>
        </div>
      </div>

      {/* ── FULFILLMENT ZONE ────────────────────────────────────────────── */}
      <div style={{ borderRadius: 12, background: SALMON, padding: 20, display: 'flex', gap: 0, marginBottom: 20 }}>

        {/* Left — Sender */}
        <div style={{ flex: 1, paddingRight: 20 }}>
          <div style={EYEBROW}>Sender (Buyer) Details</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{data.senderName || 'Guest'}</div>
          {data.senderEmail && <div style={{ fontSize: 12, color: '#475569' }}>{data.senderEmail}</div>}
          {data.occasion && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Occasion: {data.occasion}</div>}
        </div>

        <div style={{ width: 1, background: 'rgba(66,43,117,0.15)', flexShrink: 0 }} />

        {/* Right — Recipient */}
        <div style={{ flex: 1, paddingLeft: 20 }}>
          <div style={EYEBROW}>Recipient &amp; Delivery Details</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{data.recipientName || '—'}</div>
          {data.recipientPhone && <div style={{ fontSize: 12, color: '#475569' }}>{data.recipientPhone}</div>}
          {data.deliveryDate && (
            <div style={{ fontSize: 12, fontWeight: 700, color: PURPLE, margin: '2px 0' }}>
              Delivery Date: {data.deliveryDate}
            </div>
          )}
          {data.city && <div style={{ fontSize: 12, color: '#475569' }}>{data.city}</div>}
          {data.address && <div style={{ fontSize: 12, color: '#475569' }}>{data.address}</div>}
          {data.specialInstructions && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Instructions: {data.specialInstructions}
            </div>
          )}
        </div>
      </div>

      {/* ── BASKET ITEMS ────────────────────────────────────────────────── */}
      <div style={{ borderRadius: 12, background: SKY, padding: 20, marginBottom: 20 }}>
        <div style={SECTION_HEAD}>Basket Items</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(66,43,117,0.18)' }}>
              {[
                { label: 'Item',       align: 'left'  as const, w: 60  },
                { label: 'Product',    align: 'left'  as const, w: undefined },
                { label: 'Qty',        align: 'right' as const, w: 40  },
                { label: 'Unit Price', align: 'right' as const, w: 90  },
                { label: 'Row Total',  align: 'right' as const, w: 90  },
              ].map(h => (
                <th key={h.label} style={{ textAlign: h.align, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', padding: '6px 4px 8px', width: h.w }}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid rgba(66,43,117,0.08)' }}>
                {/* Thumb */}
                <td style={{ padding: '10px 4px 10px 0', verticalAlign: 'middle' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: '#FDFDFD', border: '1px solid rgba(66,43,117,0.15)', flexShrink: 0 }}>
                    {item.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={proxyImg(item.image)} crossOrigin="anonymous" alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: '#f1f5f9' }}>📦</div>
                    }
                  </div>
                </td>
                {/* Name */}
                <td style={{ padding: '10px 8px', verticalAlign: 'middle', fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                  {item.name}
                </td>
                {/* Qty */}
                <td style={{ textAlign: 'right', padding: '10px 4px', fontSize: 12, color: '#475569', verticalAlign: 'middle' }}>{item.qty}</td>
                {/* Unit price */}
                <td style={{ textAlign: 'right', padding: '10px 4px', fontSize: 12, color: '#475569', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                  LKR {item.price.toLocaleString('si-LK')}
                </td>
                {/* Row total */}
                <td style={{ textAlign: 'right', padding: '10px 0 10px 4px', fontSize: 12, fontWeight: 600, color: '#0f172a', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                  LKR {(item.price * item.qty).toLocaleString('si-LK')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── PERSONALIZED GIFT ATTACHMENT ────────────────────────────────── */}
      {(data.giftMessage || data.giftCardImage) && (
        <div style={{ borderRadius: 12, border: '1px solid rgba(66,43,117,0.18)', padding: 20, marginBottom: 20, background: 'rgba(66,43,117,0.03)' }}>
          <div style={SECTION_HEAD}>Personalized Gift Attachment</div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* Left — message */}
            <div style={{ flex: 1 }}>
              {data.giftMessage && (
                <blockquote style={{ margin: 0, padding: '8px 0 8px 14px', borderLeft: '2px solid rgba(66,43,117,0.35)', fontSize: 13, fontStyle: 'italic', color: '#334155', lineHeight: 1.6 }}>
                  &ldquo;{data.giftMessage}&rdquo;
                </blockquote>
              )}
            </div>
            {/* Right — gift card image or placeholder */}
            <div style={{ width: 160, flexShrink: 0 }}>
              {data.giftCardImage
                ? (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.giftCardImage} alt="Gift card"
                      style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(66,43,117,0.20)', objectFit: 'cover', height: 110 }} />
                    <div style={{ textAlign: 'center', marginTop: 4, fontSize: 9, color: '#64748b' }}>
                      Generated by TARA AI by Kapruka
                    </div>
                  </div>
                )
                : (
                  <div style={{ width: '100%', height: 110, borderRadius: 10, border: '1.5px dashed rgba(66,43,117,0.30)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(66,43,117,0.04)', gap: 6 }}>
                    <span style={{ fontSize: 18, opacity: 0.4 }}>✦</span>
                    <span style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>No gift card generated yet</span>
                  </div>
                )
              }
            </div>
          </div>
        </div>
      )}

      {/* ── TOTALS ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <div style={{ width: 260, borderRadius: 12, background: MINT, padding: 20 }}>
          {[
            { label: 'Subtotal',     val: `LKR ${subtotal.toLocaleString('si-LK')}` },
            { label: 'Delivery Fee', val: data.deliveryFee !== undefined ? (data.deliveryFee === 0 ? 'FREE' : `LKR ${data.deliveryFee.toLocaleString('si-LK')}`) : 'Calculated at Kapruka' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 6 }}>
              <span>{r.label}</span><span>{r.val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid rgba(66,43,117,0.20)', paddingTop: 10, marginTop: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>LKR {data.grandTotal.toLocaleString('si-LK')}</span>
          </div>
        </div>
      </div>

      {/* ── CTA BAR ─────────────────────────────────────────────────────── */}
      {!isPaid ? (
        <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#FDFDFD', padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          {/* Left — payment link */}
          <div style={{ flex: 1 }}>
            {data.checkoutUrl ? (
              <a href={data.checkoutUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, background: PURPLE, color: '#fff', fontSize: 13, fontWeight: 700, padding: '12px 22px', textDecoration: 'none', marginBottom: 14 }}>
                Proceed to Kapruka Payment Gateway →
              </a>
            ) : (
              <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginBottom: 14 }}>
                Place your order to receive the payment link
              </div>
            )}
            {data.checkoutUrl && (
              <div style={{ borderRadius: 8, background: '#9B8FB4', padding: '10px 14px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(15,23,42,0.65)' }}>Or use this link</div>
                <div style={{ fontSize: 10, color: '#fff', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 2 }}>{data.checkoutUrl}</div>
              </div>
            )}
          </div>
          {/* Right — QR code */}
          {data.qrCode && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qrCode} alt="QR"
                style={{ width: 120, height: 120, borderRadius: 10, border: '1px solid rgba(66,43,117,0.20)' }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: '#64748b', textTransform: 'uppercase' }}>Scan to Pay</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: '1px solid #a7f3d0', background: '#ecfdf5', padding: 20, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>✓</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#065f46' }}>Order Confirmed &amp; Paid</div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#047857', marginTop: 2 }}>Ref: {data.orderId}</div>
          </div>
        </div>
      )}

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, textAlign: 'center', fontSize: 9, color: '#cbd5e1' }}>
        This is a system-generated order sheet from the Kapruka × TARA AI Shopping Agent.
      </div>
    </div>
  );
}