'use client';

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  url?: string;
  in_stock?: boolean;
  stock?: string | boolean;
  category?: string;
}

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

export interface CartItem {
  id: string; name: string; price: number; image: string; qty: number;
}

interface CartCtx {
  items: CartItem[];
  cartIds: Set<string>;
  addItem: (p: Product, silent?: boolean) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  totalQty: number;
  giftMessage: string;
  setGiftMessage: (m: string) => void;
  deliveryDate: string;
  setDeliveryDate: (d: string) => void;
  district: string;
  setDistrict: (d: string) => void;
  /* NL checkout pre-fill fields */
  recipientName: string;  setRecipientName: (v: string) => void;
  recipientPhone: string; setRecipientPhone: (v: string) => void;
  addressLine1: string;   setAddressLine1: (v: string) => void;
  occasion: string;       setOccasion: (v: string) => void;
  senderName: string;     setSenderName: (v: string) => void;
  senderEmail: string;    setSenderEmail: (v: string) => void;
  locationType: string;   setLocationType: (v: string) => void;
  specialInstructions: string; setSpecialInstructions: (v: string) => void;
  prefillCheckout: (data: {
    recipient_name?: string; recipient_phone?: string;
    city?: string; address?: string; delivery_date?: string;
    occasion?: string; sender_name?: string;
    sender_email?: string; location_type?: string; special_instructions?: string;
  }) => void;
}

const Ctx = createContext<CartCtx | null>(null);

function emitCartNotification(content: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tara:chat-notification', { detail: { content } }));
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems]               = useState<CartItem[]>([]);
  const [giftMessage, setGiftMessage]   = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [district, setDistrict]         = useState('');
  const [recipientName,  setRecipientName]  = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [addressLine1,   setAddressLine1]   = useState('');
  const [occasion,       setOccasion]       = useState('');
  const [senderName,     setSenderName]     = useState('');
  const [senderEmail,    setSenderEmail]    = useState('');
  const [locationType,   setLocationType]   = useState('HOUSE OR RESIDENCE');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const prefillCheckout = useCallback((data: {
    recipient_name?: string; recipient_phone?: string;
    city?: string; address?: string; delivery_date?: string;
    occasion?: string; sender_name?: string;
    sender_email?: string; location_type?: string;
    special_instructions?: string;
  }) => {
    // Always wipe all checkout fields first so stale data never persists
    setRecipientName('');
    setRecipientPhone('');
    setAddressLine1('');
    setDistrict('');
    setDeliveryDate('');
    setOccasion('');
    setSenderName('');
    setSenderEmail('');
    setLocationType('HOUSE OR RESIDENCE');
    setSpecialInstructions('');
    // Then set only what was provided in this message
    if (data.recipient_name)  setRecipientName(data.recipient_name);
    if (data.recipient_phone) setRecipientPhone(data.recipient_phone);
    // Normalize Colombo zone format: "colombo 7" / "Colombo7" → "Colombo 07"
    const normalizeCity = (c: string) =>
      c.replace(/^colombo\s*0*(\d{1,2})$/i, (_, n) => `Colombo ${n.padStart(2, '0')}`);
    if (data.city)            setDistrict(normalizeCity(data.city));
    if (data.address)         setAddressLine1(data.address);
    if (data.delivery_date)   setDeliveryDate(data.delivery_date);
    if (data.occasion)        setOccasion(data.occasion);
    if (data.sender_name)     setSenderName(data.sender_name);
    if (data.sender_email)    setSenderEmail(data.sender_email);
    if (data.location_type)       setLocationType(data.location_type);
    if (data.special_instructions) setSpecialInstructions(data.special_instructions);
  }, []);

  const addItem = useCallback((p: Product, silent?: boolean) => {
    setItems(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price, image: p.image, qty: 1 }];
    });
    if (!silent) emitCartNotification(`🛒 Added ${p.name} to cart`);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) emitCartNotification(`🗑️ Removed ${item.name} from cart`);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) { removeItem(id); return; }
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        emitCartNotification(`📦 Updated ${i.name} quantity to ${qty}`);
        return { ...i, qty };
      }
      return i;
    }));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]); setGiftMessage(''); setDeliveryDate(''); setDistrict('');
    setRecipientName(''); setRecipientPhone(''); setAddressLine1('');
    setOccasion(''); setSenderName(''); setSenderEmail('');
    setLocationType('HOUSE OR RESIDENCE');
  }, []);

  const total    = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);
  const totalQty = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const cartIds  = useMemo(() => new Set(items.map(i => i.id)), [items]);

  const value = useMemo(() => ({
    items, cartIds, addItem, removeItem, updateQty, clearCart,
    total, totalQty,
    giftMessage, setGiftMessage,
    deliveryDate, setDeliveryDate,
    district, setDistrict,
    recipientName, setRecipientName,
    recipientPhone, setRecipientPhone,
    addressLine1, setAddressLine1,
    occasion, setOccasion,
    senderName, setSenderName,
    senderEmail, setSenderEmail,
    locationType, setLocationType,
    specialInstructions, setSpecialInstructions,
    prefillCheckout,
  }), [items, cartIds, addItem, removeItem, updateQty, clearCart, total, totalQty,
       giftMessage, deliveryDate, district, recipientName, recipientPhone,
       addressLine1, occasion, senderName, senderEmail, locationType,
       specialInstructions, prefillCheckout]);

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}