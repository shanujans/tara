'use client';

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  url?: string;
}

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface CartItem {
  id: string; name: string; price: number; image: string; qty: number;
}

interface CartCtx {
  items: CartItem[];
  addItem: (p: Product) => void;
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
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems]               = useState<CartItem[]>([]);
  const [giftMessage, setGiftMessage]   = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [district, setDistrict]         = useState('');

  const addItem = useCallback((p: Product) => {
    setItems(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price, image: p.image, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) { removeItem(id); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]); setGiftMessage(''); setDeliveryDate(''); setDistrict('');
  }, []);

  const total    = items.reduce((s, i) => s + i.price * i.qty, 0);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Ctx.Provider value={{
      items, addItem, removeItem, updateQty, clearCart,
      total, totalQty,
      giftMessage, setGiftMessage,
      deliveryDate, setDeliveryDate,
      district, setDistrict,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}