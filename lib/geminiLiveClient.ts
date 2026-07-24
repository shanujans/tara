'use client';

import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai';
import { VOICE_SYSTEM_PROMPT, TTS_ONLY_SYSTEM_PROMPT } from '@/lib/voiceSystemPrompt';

export type LiveStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

export interface LiveClientHandlers {
  onStatus: (s: LiveStatus) => void;
  onUserTranscript: (text: string) => void;
  /** Fires when Gemini's spoken OUTPUT is transcribed. isReadAloud=true means it was a system-provided read-aloud; false means Gemini's own content (instant confirmation). */
  onOutputTranscript?: (text: string, isReadAloud: boolean) => void;
  /** Fires when ALL TTS audio has finished playing AND the turn is complete — safe to resume mic. */
  onTTSComplete?: () => void;
  onError: (msg: string) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onListeningChange?: (listening: boolean) => void;
}

const CONNECT_TIMEOUT_MS = 15_000;
const INPUT_SAMPLE_RATE = 16_000;
const OUTPUT_SAMPLE_RATE = 24_000;

export class GeminiLiveClient {
  private ai: GoogleGenAI | null = null;
  private session: Session | null = null;
  private handlers: LiveClientHandlers;
  private model: string;
  private ttsOnly: boolean;

  // Mic capture
  private micStream: MediaStream | null = null;
  private micContext: AudioContext | null = null;
  private micScriptNode: ScriptProcessorNode | null = null;
  private micActive = false;
  private micPaused = false;
  private _analyser: AnalyserNode | null = null;

  // TTS playback
  private ttsContext: AudioContext | null = null;
  private ttsQueue: ArrayBuffer[] = [];
  private ttsPlaying = false;
  private ttsNextTime = 0;

  // State
  private isSpeakingResponse = false;
  private turnDone = false;
  private ttsCompleteFired = false;

  // speakResponseAndWait() promise resolver
  private ttsWaitResolve: ((value: void) => void) | null = null;

  constructor(handlers: LiveClientHandlers, model: string, ttsOnly = false) {
    this.handlers = handlers;
    this.model = model;
    this.ttsOnly = ttsOnly;
  }

  async connect(token: string): Promise<void> {
    this.handlers.onStatus('connecting');
    this.ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });

    console.log('[gemini-live] connecting, model:', this.model);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`WSS connect timed out after ${CONNECT_TIMEOUT_MS}ms`)),
        CONNECT_TIMEOUT_MS,
      );
    });

    try {
      this.session = await Promise.race([
        this.ai.live.connect({
          model: this.model,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: this.ttsOnly ? TTS_ONLY_SYSTEM_PROMPT : VOICE_SYSTEM_PROMPT,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Aoede' },
              },
            },
          },
          callbacks: {
            onopen: () => {
              console.log('[gemini-live] WSS open', this.ttsOnly ? '(TTS-only)' : '(bidirectional)');
              this.handlers.onStatus('connected');
              if (!this.ttsOnly) {
                this.startMicCapture().catch(err => {
                  console.error('[gemini-live] mic capture failed:', err);
                  this.handlers.onError(`Mic: ${err.message}`);
                });
              }
            },
            onmessage: (e: LiveServerMessage) => this.handleMessage(e),
            onerror: (e: ErrorEvent) => {
              console.error('[gemini-live] WSS error:', e.message ?? e);
              this.handlers.onError(e.message ?? 'WSS error');
              this.handlers.onStatus('error');
            },
            onclose: (e: CloseEvent) => {
              console.log('[gemini-live] WSS closed:', e.code, e.reason);
              this.stopMicCapture();
              this.handlers.onStatus('closed');
            },
          },
        }),
        timeout,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'connect failed';
      console.error('[gemini-live] connect failed:', msg);
      this.handlers.onError(msg);
      this.handlers.onStatus('error');
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // ─── Mic capture ────────────────────────────────────────────────────────────
  private async startMicCapture(): Promise<void> {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: INPUT_SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const MicCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.micContext = new MicCtx({ sampleRate: INPUT_SAMPLE_RATE });
    if (this.micContext.state === 'suspended') await this.micContext.resume();

    const source = this.micContext.createMediaStreamSource(this.micStream);

    const scriptNode = this.micContext.createScriptProcessor(4096, 1, 1);
    this.micScriptNode = scriptNode;

    scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!this.micActive || this.micPaused || !this.session) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      const base64 = this.arrayBufferToBase64(pcm16.buffer);
      try {
        this.session.sendRealtimeInput({
          audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
        });
      } catch (err) {
        console.warn('[gemini-live] sendRealtimeInput failed:', err);
      }
    };

    source.connect(scriptNode);
    scriptNode.connect(this.micContext.destination);
    this.micActive = true;
    this.handlers.onListeningChange?.(true);
    console.log('[gemini-live] mic capture started');
  }

  private stopMicCapture(): void {
    this.micActive = false;
    this.handlers.onListeningChange?.(false);
    try { this.micScriptNode?.disconnect(); } catch { /* */ }
    this.micScriptNode = null;
    this.micStream?.getTracks().forEach(t => t.stop());
    this.micStream = null;
    try { this.micContext?.close(); } catch { /* */ }
    this.micContext = null;
  }

  // ─── Mic pause / resume ─────────────────────────────────────────────────────
  pauseMic(): void {
    if (this.ttsOnly) return;
    this.micPaused = true;
    this.handlers.onListeningChange?.(false);
  }

  resumeMic(): void {
    if (this.ttsOnly) return;
    this.micPaused = false;
    if (this.micActive) this.handlers.onListeningChange?.(true);
  }

  get isMicPaused(): boolean {
    return this.micPaused;
  }

  // ─── Speak text from the system (chat API response) ─────────────────────────
  speakResponse(text: string): void {
    if (!this.session || !text.trim()) return;
    this.isSpeakingResponse = true;
    this.turnDone = false;
    this.ttsCompleteFired = false;
    this.session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text }] }],
      turnComplete: true,
    });
    console.log('[gemini-live] speakResponse sent:', text.slice(0, 80));
  }

  async speakResponseAndWait(text: string, timeoutMs = 25_000): Promise<void> {
    if (!this.session || !text.trim()) return;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ttsWaitResolve = null;
        console.warn('[gemini-live] speakResponseAndWait timed out');
        reject(new Error('Gemini Live TTS timed out'));
      }, timeoutMs);

      const origResolve = this.ttsWaitResolve;
      this.ttsWaitResolve = () => {
        clearTimeout(timer);
        resolve();
      };

      try {
        this.speakResponse(text);
      } catch (err) {
        clearTimeout(timer);
        this.ttsWaitResolve = origResolve;
        reject(err);
      }
    });
  }

  /** Public method to stop TTS playback (for stopSpeaking in useVoiceMode). */
  stopSpeaking(): void {
    this.stopTTS();
  }

  get getIsSpeakingResponse(): boolean {
    return this.isSpeakingResponse;
  }

  // ─── TTS playback ───────────────────────────────────────────────────────────
  private async playTTSQueue(): Promise<void> {
    if (this.ttsPlaying || this.ttsQueue.length === 0) return;
    this.ttsPlaying = true;
    this.handlers.onSpeakingChange?.(true);

    while (this.ttsQueue.length > 0) {
      const chunk = this.ttsQueue.shift()!;
      await this.playPCMChunk(chunk);
    }

    this.ttsPlaying = false;
    this.handlers.onSpeakingChange?.(false);
    this.ttsNextTime = 0;
    this.maybeFireTTSComplete();
  }

  /** Fire onTTSComplete once the turn is done AND all audio has finished playing. */
  private maybeFireTTSComplete(): void {
    if (this.turnDone && !this.ttsPlaying && this.ttsQueue.length === 0 && !this.ttsCompleteFired) {
      this.ttsCompleteFired = true;
      console.log('[gemini-live] TTS complete — safe to resume mic');
      this.handlers.onTTSComplete?.();
      if (this.ttsWaitResolve) {
        const resolve = this.ttsWaitResolve;
        this.ttsWaitResolve = null;
        resolve();
      }
    }
  }

  private async playPCMChunk(data: ArrayBuffer): Promise<void> {
    if (!this.ttsContext) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ttsContext = new Ctx({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    if (this.ttsContext.state === 'suspended') await this.ttsContext.resume();

    const view = new DataView(data);
    const samples = Math.floor(data.byteLength / 2);
    const audioBuffer = this.ttsContext.createBuffer(1, samples, OUTPUT_SAMPLE_RATE);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      const int16 = view.getInt16(i * 2, true);
      channelData[i] = int16 / 0x8000;
    }

    const source = this.ttsContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.ttsContext.destination);

    const now = this.ttsContext.currentTime;
    const startTime = Math.max(this.ttsNextTime, now);
    source.start(startTime);
    this.ttsNextTime = startTime + audioBuffer.duration;

    await new Promise<void>(resolve => {
      source.onended = () => resolve();
    });
  }

  private stopTTS(): void {
    this.ttsQueue = [];
    this.ttsPlaying = false;
    this.ttsNextTime = 0;
    this.handlers.onSpeakingChange?.(false);
    if (this.ttsWaitResolve) {
      const resolve = this.ttsWaitResolve;
      this.ttsWaitResolve = null;
      resolve();
    }
  }

  // ─── Message handling ───────────────────────────────────────────────────────
  private handleMessage(msg: LiveServerMessage): void {
    const sc = msg.serverContent;
    if (!sc) {
      console.log('[gemini-live] msg (no serverContent)', JSON.stringify(msg).slice(0, 200));
      return;
    }

    // 1. Audio output chunks — play TTS
    const parts = sc.modelTurn?.parts;
    if (parts) {
      for (const p of parts) {
        if (p.inlineData?.data && p.inlineData.mimeType?.includes('audio')) {
          const raw = atob(p.inlineData.data);
          const buf = new ArrayBuffer(raw.length);
          const view = new Uint8Array(buf);
          for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
          this.ttsQueue.push(buf);
          void this.playTTSQueue();
        }
      }
    }

    // 2. Input transcription — what the user said (skip in TTS-only mode)
    const inputText = sc.inputTranscription?.text?.trim();
    if (!this.ttsOnly && inputText && inputText.length > 0) {
      const isFinished = sc.inputTranscription?.finished !== false; // fire unless explicitly false
      if (isFinished) {
        console.log('[gemini-live] USER SAID:', inputText, '(isSpeakingResponse:', this.isSpeakingResponse + ')');
        // Reset turn tracking for the new user turn
        this.turnDone = false;
        this.ttsCompleteFired = false;
        // Don't suppress — always fire. ChatPanel's handleGeminiTranscript will gate.
        this.handlers.onUserTranscript(inputText);
      } else {
        console.log('[gemini-live] input transcript (partial):', inputText.slice(0, 60));
      }
    }

    // 3. Output transcription — skip in TTS-only mode (no conversational turns)
    if (!this.ttsOnly) {
      const outputText = sc.outputTranscription?.text?.trim();
      if (outputText && outputText.length > 0 && sc.outputTranscription?.finished) {
        console.log('[gemini-live] GEMINI SAID:', outputText.slice(0, 80), '(isReadAloud:', this.isSpeakingResponse + ')');
        this.handlers.onOutputTranscript?.(outputText, this.isSpeakingResponse);
      }
    }

    // 4. Turn complete
    if (sc.turnComplete) {
      this.isSpeakingResponse = false;
      this.turnDone = true;
      console.log('[gemini-live] turn complete — turnDone=true');
      // If no TTS was queued (text-only turn), fire complete now
      this.maybeFireTTSComplete();
    }

    // 5. Interrupted — barge-in
    if (sc.interrupted) {
      console.log('[gemini-live] interrupted (barge-in)');
      this.stopTTS();
      this.isSpeakingResponse = false;
      this.turnDone = true;
      this.ttsCompleteFired = true; // suppress fire on interrupted turn
    }
  }

  async disconnect(): Promise<void> {
    this.stopMicCapture();
    this.stopTTS();
    try { this.ttsContext?.close(); } catch { /* */ }
    this.ttsContext = null;
    try { this.session?.close(); } catch { /* */ }
    this.session = null;
    this.ai = null;
    this.handlers.onStatus('idle');
  }

  get isConnected(): boolean {
    return this.session !== null;
  }

  get isMicActive(): boolean {
    return this.micActive && !this.micPaused;
  }

  get analyserNode(): AnalyserNode | null {
    if (!this.micStream || !this.micContext) return null;
    if (!this._analyser) {
      const source = this.micContext.createMediaStreamSource(this.micStream);
      this._analyser = this.micContext.createAnalyser();
      this._analyser.fftSize = 512;
      source.connect(this._analyser);
    }
    return this._analyser;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  }
}
