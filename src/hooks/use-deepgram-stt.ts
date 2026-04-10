"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DeepgramAlternative = {
  transcript: string;
  confidence: number;
};

type DeepgramResult = {
  type: "Results";
  channel_index: number[];
  duration: number;
  start: number;
  is_final: boolean;
  channel: { alternatives: DeepgramAlternative[] };
  speech_final?: boolean;
};

type UseDeepgramSTTOptions = {
  /** Called each time a chunk of speech is finalized. Append this to your input. */
  onFinalChunk?: (text: string) => void;
};

export type DeepgramSTTState = {
  /** Whether currently listening */
  listening: boolean;
  /** Current interim (not yet finalized) words — display as ghost text */
  interim: string;
  /** Start listening */
  start: () => Promise<void>;
  /** Stop listening */
  stop: () => void;
  /** Any error */
  error: string | null;
};

const DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen";

export function useDeepgramSTT(
  options?: UseDeepgramSTTOptions,
): DeepgramSTTState {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(
    null,
  );
  const contextRef = useRef<AudioContext | null>(null);
  const onFinalChunkRef = useRef(options?.onFinalChunk);
  onFinalChunkRef.current = options?.onFinalChunk;

  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        /* ignore */
      }
      processorRef.current = null;
    }
    if (contextRef.current) {
      try {
        void contextRef.current.close();
      } catch {
        /* ignore */
      }
      contextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  const start = useCallback(async () => {
    setError(null);
    setInterim("");

    // 1. Get API key from server
    let apiKey: string;
    try {
      const res = await fetch("/api/stt/token");
      const data = (await res.json()) as { key?: string; error?: string };
      if (!res.ok || !data.key) {
        throw new Error(data.error ?? "Kunde inte hämta STT-token");
      }
      apiKey = data.key;
    } catch (err) {
      setError(err instanceof Error ? err.message : "STT-token misslyckades");
      return;
    }

    // 2. Get microphone
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Kunde inte komma åt mikrofonen");
      return;
    }
    streamRef.current = stream;

    // 3. Connect WebSocket to Deepgram
    const params = new URLSearchParams({
      model: "nova-3",
      language: "sv",
      smart_format: "true",
      interim_results: "true",
      utterance_end_ms: "1500",
      vad_events: "true",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
    });

    const ws = new WebSocket(`${DEEPGRAM_WS_URL}?${params}`, [
      "token",
      apiKey,
    ]);
    wsRef.current = ws;

    ws.onopen = () => {
      setListening(true);

      // 4. Start audio processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      contextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.send(int16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as DeepgramResult;
        if (data.type !== "Results") return;

        const alt = data.channel?.alternatives?.[0];
        if (!alt) return;

        const text = alt.transcript.trim();

        if (data.is_final && text) {
          // Finalized chunk — append to draft via callback
          setInterim("");
          onFinalChunkRef.current?.(text);
        } else if (!data.is_final && text) {
          // Interim — show as ghost text
          setInterim(text);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.onerror = () => {
      setError("WebSocket-anslutning till Deepgram misslyckades");
      setListening(false);
      cleanup();
    };

    ws.onclose = () => {
      setListening(false);
    };
  }, []);

  const stop = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      setTimeout(() => cleanup(), 300);
    } else {
      cleanup();
    }
    setListening(false);
    setInterim("");
  }, []);

  return {
    listening,
    interim,
    start,
    stop,
    error,
  };
}
