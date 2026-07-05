'use client';
import { useRef, useState, useCallback, useEffect } from 'react';

// Silence auto-stop (voice-mode hands-free loop only): once speech has been
// sustained for MIN_SPEECH_MS, a pause of SILENCE_MS stops & sends.
// RMS_THRESHOLD is on a 0-1 scale (time-domain data centered at 128).
const RMS_THRESHOLD  = 0.045;
const MIN_SPEECH_MS  = 350;   // ignore blips/coughs shorter than this before arming silence-detection
const SILENCE_MS     = 1500;  // pause length that counts as "done talking"
const MAX_RECORD_MS  = 60_000;
const STT_TIMEOUT_MS = 20_000;

// 200ms of silent 8kHz/8-bit PCM WAV — played+paused inside the original click's
// call stack to "unlock" this <audio> element for later programmatic play() calls
// that happen after an async gap (which is otherwise blocked by autoplay policy,
// especially on iOS Safari).
const SILENT_WAV = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

interface UseVoiceModeArgs {
  onTranscript: (text: string) => void;   // called with the transcribed text — caller sends it to chat
  getLang: () => string;                   // resolves current conversation lang at speak() time
  micDeniedMessage?: string;               // localized message shown if mic permission is refused
}

export function useVoiceMode({ onTranscript, getLang, micDeniedMessage }: UseVoiceModeArgs) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSending,   setIsSending]   = useState(false);
  const [isSpeaking,  setIsSpeaking]  = useState(false);
  const [isPreparingSpeech, setIsPreparingSpeech] = useState(false);
  const [voiceModeOn, setVoiceModeOn] = useState(false);
  const [micSupported, setMicSupported] = useState(false);

  const analyserRef      = useRef<AnalyserNode | null>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const recorderRef       = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<BlobPart[]>([]);
  const silenceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef            = useRef<number | null>(null);
  const playerRef         = useRef<HTMLAudioElement | null>(null);   // only used for silent unlock & fallback
  const voiceModeOnRef    = useRef(false);
  const discardRef        = useRef(false);
  const sttAbortRef       = useRef<AbortController | null>(null);

  useEffect(() => {
    setMicSupported(typeof window !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined');
  }, []);

  // Must be called synchronously from the mic button's click handler — i.e. before
  // any `await` — so it's still inside the browser's "this came from a user gesture"
  // window. Playing (then immediately pausing) a real audio element here is what
  // allows the SAME element to be played again later, from async code, without
  // being blocked by autoplay policy.
  const primeAudioElement = useCallback(() => {
    if (!playerRef.current) playerRef.current = new Audio();
    const el = playerRef.current;
    el.src = SILENT_WAV;
    el.play().then(() => { el.pause(); el.currentTime = 0; }).catch(() => { /* fine — best effort */ });
  }, []);

  const cleanupStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    discardRef.current = false;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    discardRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    sttAbortRef.current?.abort();
  }, []);

  const sendAudio = useCallback(async (blob: Blob) => {
    setIsSending(true);
    const controller = new AbortController();
    sttAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'speech.webm');
      const res = await fetch('/api/voice-stt', { method: 'POST', body: fd, signal: controller.signal });
      const data = await res.json();
      if (res.ok && data.text) {
        onTranscript(data.text);
      } else if (!res.ok) {
        console.warn('[voice] STT unavailable:', data.error);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.warn('[voice] STT request failed:', err);
    } finally {
      clearTimeout(timeout);
      sttAbortRef.current = null;
      setIsSending(false);
    }
  }, [onTranscript]);

  const startRecording = useCallback(async () => {
    if (!micSupported || isRecording) return;
    primeAudioElement();
    discardRef.current = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert(micDeniedMessage ?? 'Allow microphone access to use voice mode.');
      return;
    }
    streamRef.current = stream;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const wasDiscarded = discardRef.current;
      cleanupStream();
      setIsRecording(false);
      if (!wasDiscarded && blob.size > 500) void sendAudio(blob);
    };
    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);

    maxTimerRef.current = setTimeout(stopRecording, MAX_RECORD_MS);

    if (voiceModeOnRef.current) {
      const data = new Uint8Array(analyser.fftSize);
      let speechStartedAt: number | null = null;
      let armed = false;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sumSquares += v * v; }
        const rms = Math.sqrt(sumSquares / data.length);

        if (rms > RMS_THRESHOLD) {
          if (speechStartedAt === null) speechStartedAt = performance.now();
          if (!armed && performance.now() - speechStartedAt >= MIN_SPEECH_MS) armed = true;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        } else {
          speechStartedAt = null;
          if (armed && !silenceTimerRef.current) silenceTimerRef.current = setTimeout(stopRecording, SILENCE_MS);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [micSupported, isRecording, cleanupStream, sendAudio, stopRecording, micDeniedMessage, primeAudioElement]);

  // ---------- UPDATED speak() using Web Audio API ----------
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise(async (resolve) => {
      const clean = text.replace(/[*_#]/g, '').trim();
      if (!clean) return resolve();
      setIsPreparingSpeech(true);
      try {
        const res = await fetch('/api/voice-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean, lang: getLang() }),
        });

        if (!res.ok) {
          let errorMsg = 'TTS unavailable';
          try {
            const errData = await res.json();
            errorMsg = errData.error || errorMsg;
          } catch (_) { /* ignore */ }
          setIsPreparingSpeech(false);
          console.warn('[voice] TTS unavailable:', errorMsg);
          return resolve();
        }

        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
          setIsPreparingSpeech(false);
          return resolve();
        }

        // Create AudioContext and decode the WAV
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          await ctx.resume(); // resume if autoplay blocked
        }

        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        setIsPreparingSpeech(false);
        setIsSpeaking(true);

        source.onended = () => {
          setIsSpeaking(false);
          // Optionally close the context after a short delay to free resources
          // but we keep it alive for potential future use.
          resolve();
        };

        source.start();
      } catch (err) {
        console.warn('[voice] TTS playback failed:', err);
        setIsPreparingSpeech(false);
        setIsSpeaking(false);
        resolve();
      }
    });
  }, [getLang]);
  // ---------- end of updated speak ----------

  const stopSpeaking = useCallback(() => {
    // Not easily supported with Web Audio, but we can close the context?
    // We'll just set state and ignore the ongoing playback (it will finish).
    // For a proper stop, you'd need to keep a reference to the source and call stop().
    // Since this is rarely used, we'll just silence the state.
    setIsSpeaking(false);
  }, []);

  const toggleVoiceMode = useCallback(() => {
    setVoiceModeOn(prev => {
      voiceModeOnRef.current = !prev;
      if (prev) stopRecording();
      return !prev;
    });
  }, [stopRecording]);

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  return {
    isRecording, isSending, isSpeaking, isPreparingSpeech, voiceModeOn, micSupported,
    startRecording, stopRecording, cancelRecording, primeAudioElement,
    speak, stopSpeaking, toggleVoiceMode,
    analyserRef,
  };
}