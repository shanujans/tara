'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { GeminiLiveClient, type LiveStatus } from '@/lib/geminiLiveClient';

export interface GeminiLiveVoiceOptions {
  onUserTranscript: (text: string) => void;
  onOutputTranscript?: (text: string, isReadAloud: boolean) => void;
  onTTSComplete?: () => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onListeningChange?: (listening: boolean) => void;
}

export function useGeminiLiveVoice(opts: GeminiLiveVoiceOptions) {
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);

  const clientRef = useRef<GeminiLiveClient | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const connect = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/voice/token', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error ?? 'Token request failed');
      }

      const client = new GeminiLiveClient(
        {
          onStatus: (s) => setStatus(s),
          onUserTranscript: (text) => optsRef.current.onUserTranscript(text),
          onOutputTranscript: (text, isReadAloud) => optsRef.current.onOutputTranscript?.(text, isReadAloud),
          onTTSComplete: () => optsRef.current.onTTSComplete?.(),
          onError: (m) => { setError(m); },
          onSpeakingChange: (spk) => {
            setSpeaking(spk);
            optsRef.current.onSpeakingChange?.(spk);
          },
          onListeningChange: (lst) => {
            setListening(lst);
            optsRef.current.onListeningChange?.(lst);
          },
        },
        data.model,
      );
      clientRef.current = client;
      await client.connect(data.token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      setStatus('error');
    }
  }, []);

  const disconnect = useCallback(async () => {
    await clientRef.current?.disconnect();
    clientRef.current = null;
    setStatus('idle');
    setSpeaking(false);
    setListening(false);
  }, []);

  const speakResponse = useCallback((text: string) => {
    clientRef.current?.speakResponse(text);
  }, []);

  const pauseMic = useCallback(() => {
    clientRef.current?.pauseMic();
  }, []);

  const resumeMic = useCallback(() => {
    clientRef.current?.resumeMic();
  }, []);

  useEffect(() => {
    return () => { void clientRef.current?.disconnect(); };
  }, []);

  return {
    status,
    error,
    speaking,
    listening,
    connect,
    disconnect,
    speakResponse,
    pauseMic,
    resumeMic,
  };
}
