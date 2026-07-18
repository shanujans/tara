'use client';

// This hook was used by the standalone VoicePanel which has been removed.
// The Gemini Live integration now lives inside ChatPanel via useGeminiLiveVoice.
// Keeping the file to avoid breaking any lingering imports.

export function useVoiceSession() {
  return {
    status: 'idle' as const,
    error: null,
    transcript: [],
    model: null,
    speaking: false,
    listening: false,
    cartPreview: null,
    products: [],
    searching: false,
    chatLoading: false,
    deliveryInfo: null,
    connect: async () => {},
    disconnect: async () => {},
    sendText: (_text: string) => {},
    clearTranscript: () => {},
    pauseMic: () => {},
    resumeMic: () => {},
    updateCartField: (_field: string, _value: string) => {},
  };
}
