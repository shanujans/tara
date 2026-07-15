'use client';

interface CachedPdfEntry {
  blob: Blob;
  hash: string;
}

const pdfCache = new Map<string, CachedPdfEntry>();

// Core fields that define a stable order (excludes qrCode & giftCardImage which regenerate,
// and senderName/senderEmail which aren't in the chat receipt event)
export function getOrderCoreHash(data: {
  orderId: string;
  items: { id: string; qty: number; price: number }[];
  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;
  deliveryDate: string;
  deliveryFee: number;
  grandTotal: number;
  occasion?: string;
  giftMessage?: string;
  specialInstructions?: string;
  checkoutUrl?: string;
}): string {
  const relevant = {
    orderId: data.orderId,
    items: data.items.map(i => `${i.id}:${i.qty}:${i.price}`).join('|'),
    recipientName: data.recipientName,
    recipientPhone: data.recipientPhone,
    address: data.address,
    city: data.city,
    deliveryDate: data.deliveryDate,
    deliveryFee: data.deliveryFee,
    grandTotal: data.grandTotal,
    occasion: data.occasion ?? '',
    giftMessage: data.giftMessage ?? '',
    specialInstructions: data.specialInstructions ?? '',
    checkoutUrl: data.checkoutUrl ?? '',
  };
  return JSON.stringify(relevant);
}

export function setCachedPdf(orderId: string, blob: Blob, hash: string): void {
  pdfCache.set(orderId, { blob, hash });
}

export function getCachedPdf(orderId: string): CachedPdfEntry | undefined {
  return pdfCache.get(orderId);
}

export function hasCachedPdf(orderId: string, currentHash: string): boolean {
  const entry = pdfCache.get(orderId);
  return !!entry && entry.hash === currentHash;
}