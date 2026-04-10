"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ColoringChat } from "@/components/coloring-chat";
import { mapUiMessagesToColoringMessages } from "@/lib/map-ui-messages";
import { segmentCompleteSentences } from "@/lib/sentence-segmentation";
import { voiceModeRequiresReadAloud } from "@/lib/voice-modes";
import type { VoiceModeId } from "@/types/coloring-chat";

const welcomeMessages: UIMessage[] = [
  {
    id: "welcome-assistant",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Hej! Skriv eller använd mikrofonen och säg vad du vill måla. Jag svarar på svenska och hjälper bara med trygga målarbilder.",
      },
    ],
  },
];

function sentenceSpeechKey(s: string): string {
  return `${s.length}:${s}`;
}

export function ColoringChatAi() {
  const [voiceMode, setVoiceMode] = useState<VoiceModeId>("blue");
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
    messages: welcomeMessages,
  });

  const coloringMessages = useMemo(
    () => mapUiMessagesToColoringMessages(messages),
    [messages],
  );

  const spokenKeysRef = useRef<Set<string>>(new Set());
  const lastAssistantIdRef = useRef<string | null>(null);
  const audioChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const assistants = messages.filter((m) => m.role === "assistant");
    const lastAssistant = assistants[assistants.length - 1];
    if (!lastAssistant) return;

    if (lastAssistant.id !== lastAssistantIdRef.current) {
      lastAssistantIdRef.current = lastAssistant.id;
      spokenKeysRef.current = new Set();
    }

    if (!voiceModeRequiresReadAloud(voiceMode)) return;

    const textParts = lastAssistant.parts.filter(
      (p): p is { type: "text"; text: string } => p.type === "text",
    );
    const fullText = textParts.map((p) => p.text).join("");
    const streamComplete = status === "ready";
    const sentences = segmentCompleteSentences(fullText, streamComplete);

    for (const sentence of sentences) {
      const key = sentenceSpeechKey(sentence);
      if (spokenKeysRef.current.has(key)) continue;
      spokenKeysRef.current.add(key);

      audioChainRef.current = audioChainRef.current
        .then(async () => {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: sentence, voiceMode }),
          });
          if (!res.ok) {
            const errBody = await res.text();
            console.error("[TTS]", res.status, errBody);
            throw new Error(`TTS misslyckades: ${res.status}`);
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolve, reject) => {
            const audio = new Audio();
            audio.src = url;
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              reject(audio.error ?? new Error("uppspelningsfel"));
            };
            void audio.play().catch(reject);
          });
        })
        .catch((e) => {
          console.error("[TTS queue]", e);
        });
    }
  }, [messages, status, voiceMode]);

  const handleSendText = useCallback(
    async (text: string) => {
      await sendMessage({ text });
    },
    [sendMessage],
  );

  const busy = status === "submitted" || status === "streaming";

  return (
    <ColoringChat
      messages={coloringMessages}
      onSendMessage={handleSendText}
      voiceMode={voiceMode}
      onVoiceModeChange={setVoiceMode}
      chatStatus={status}
      chatError={error}
      disableSend={busy}
      onStopGeneration={stop}
      voiceInputEnabled
    />
  );
}
