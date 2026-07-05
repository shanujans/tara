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
const SILENT_WAV = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

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
  const playerRef         = useRef<HTMLAudioElement | null>(null);   // used for silent unlock, AND now for streamed English TTS playback
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

  // Stops the silence-detection RAF loop + timers only. Does NOT touch the
  // MediaStream/AudioContext — those are kept alive across recordings (see
  // startRecording below) so repeat taps don't pay the full getUserMedia
  // hardware-acquisition cost again. Tearing the stream down after every single
  // recording (the old behaviour) is what caused the multi-second delay before
  // recording actually started on each tap.
  const cleanupTimers = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    rafRef.current = null;
    silenceTimerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  // Fully releases the mic + AudioContext. Only call on unmount (or anywhere you
  // deliberately want the browser's mic-in-use indicator to turn off) — NOT after
  // every recording, or startRecording has to re-acquire the device from scratch
  // on every tap again.
  const releaseStream = useCallback(() => {
    cleanupTimers();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, [cleanupTimers]);

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

    // Reuse the existing stream/AudioContext if one from an earlier recording in
    // this session is still live — this is the fix for the ~5-10s startup delay,
    // which was caused by fully releasing (and therefore having to re-acquire)
    // the mic hardware after every single recording.
    let stream = streamRef.current;
    const streamIsLive = !!stream && stream.getAudioTracks().some(t => t.readyState === 'live');

    if (!streamIsLive) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        alert(micDeniedMessage ?? 'Allow microphone access to use voice mode.');
        return;
      }
      streamRef.current = stream;

      audioCtxRef.current?.close().catch(() => {});
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } else if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(stream as MediaStream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const wasDiscarded = discardRef.current;
      cleanupTimers(); // stream/AudioContext stay open for the next recording
      setIsRecording(false);
      if (!wasDiscarded && blob.size > 500) void sendAudio(blob);
    };
    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);

    maxTimerRef.current = setTimeout(stopRecording, MAX_RECORD_MS);

    const analyser = analyserRef.current;
    if (voiceModeOnRef.current && analyser) {
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
  }, [micSupported, isRecording, cleanupTimers, sendAudio, stopRecording, micDeniedMessage, primeAudioElement]);

  // Browser-native fallback — used for English when streamed Speechmatics
  // playback fails, since the server route has no Gemini fallback for 'en' by design.
  const speakWithWebSpeechAPI = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(); return; }
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'en-US';
        setIsSpeaking(true);
        utter.onend = () => { setIsSpeaking(false); resolve(); };
        utter.onerror = () => { setIsSpeaking(false); resolve(); };
        window.speechSynthesis.speak(utter);
      } catch {
        setIsSpeaking(false);
        resolve();
      }
    });
  }, []);

  // ---------- speak(): streamed <audio> for en/si/ta, Web Audio decode as fallback ----------
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise(async (resolve) => {
      const clean = text.replace(/[*_#]/g, '').replace(/\p{Extended_Pictographic}/gu, '').trim();
      if (!clean) return resolve();
      const lang = getLang();
      setIsPreparingSpeech(true);

      // Buffered path (POST + decodeAudioData) — used directly for sl/tl
      // (Gemini only, not wired for streaming), and as the fallback if
      // streaming fails for si/ta (Web Speech API has no real si/ta voices
      // in most browsers, so we fall back to the known-working buffered call
      // instead of Web Speech API for those two).
      const playBuffered = async (): Promise<void> => {
        try {
          const res = await fetch('/api/voice-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: clean, lang }),
          });

          if (!res.ok) {
            setIsPreparingSpeech(false);
            console.warn('[voice] TTS unavailable (buffered path)');
            return;
          }

          const arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer.byteLength === 0) { setIsPreparingSpeech(false); return; }

          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') await ctx.resume();

          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          const bufferSource = ctx.createBufferSource();
          bufferSource.buffer = audioBuffer;
          bufferSource.connect(ctx.destination);

          setIsPreparingSpeech(false);
          setIsSpeaking(true);

          await new Promise<void>(res2 => {
            bufferSource.onended = () => { setIsSpeaking(false); res2(); };
            bufferSource.start();
          });
        } catch (err) {
          console.warn('[voice] buffered TTS playback failed:', err);
          setIsPreparingSpeech(false);
          setIsSpeaking(false);
        }
      };

      // Streamed path — English (Speechmatics) and Sinhala/Tamil (Azure).
      // Guarded by URL-length: non-Latin script inflates ~3x per byte once
      // percent-encoded, so very long si/ta replies skip streaming and go
      // straight to the buffered path instead of risking an oversized URL.
      const encoded = encodeURIComponent(clean);
      const SAFE_URL_CHARS = 4000;
      const canStream =
        lang === 'en' ||
        ((lang === 'si' || lang === 'ta') && encoded.length <= SAFE_URL_CHARS);

      if (canStream) {
        if (!playerRef.current) playerRef.current = new Audio();
        const el = playerRef.current;
        let settled = false;

        const cleanupHandlers = () => { el.onplaying = null; el.onended = null; el.onerror = null; };

        el.onplaying = () => { setIsPreparingSpeech(false); setIsSpeaking(true); };
        el.onended = () => {
          if (settled) return;
          settled = true;
          cleanupHandlers();
          setIsSpeaking(false);
          resolve();
        };
        el.onerror = async () => {
          if (settled) return;
          settled = true;
          cleanupHandlers();
          setIsSpeaking(false);
          console.warn(`[voice] streamed TTS failed (lang=${lang})`);
          if (lang === 'en') {
            await speakWithWebSpeechAPI(clean);
          } else {
            await playBuffered();
          }
          resolve();
        };

        try {
          el.src = `/api/voice-tts?text=${encoded}&lang=${lang}`;
          await el.play();
        } catch (err) {
          if (!settled) {
            settled = true;
            cleanupHandlers();
            console.warn('[voice] streamed TTS playback failed:', err);
            if (lang === 'en') {
              await speakWithWebSpeechAPI(clean);
            } else {
              await playBuffered();
            }
            resolve();
          }
        }
        return;
      }

      // sl / tl, or si/ta with an unusually long reply — buffered path only.
      await playBuffered();
      resolve();
    });
  }, [getLang, speakWithWebSpeechAPI]);
  // ---------- end of speak ----------

  const stopSpeaking = useCallback(() => {
    // English streamed path: we hold a real element reference now, so we can
    // actually stop it (unlike the old Web-Audio-only path, which could only
    // clear state and let playback finish naturally).
    if (playerRef.current && !playerRef.current.paused) {
      playerRef.current.pause();
      playerRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  }, []);

  const toggleVoiceMode = useCallback(() => {
    setVoiceModeOn(prev => {
      voiceModeOnRef.current = !prev;
      if (prev) stopRecording();
      return !prev;
    });
  }, [stopRecording]);

  useEffect(() => () => releaseStream(), [releaseStream]);

  return {
    isRecording, isSending, isSpeaking, isPreparingSpeech, voiceModeOn, micSupported,
    startRecording, stopRecording, cancelRecording, primeAudioElement,
    speak, stopSpeaking, toggleVoiceMode,
    analyserRef,
  };
}