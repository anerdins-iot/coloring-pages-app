"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessageBubble } from "@/components/chat-message-bubble";
import { VoiceModePicker } from "@/components/voice-mode-picker";
import type { ColoringChatMessage, VoiceModeId } from "@/types/coloring-chat";

export type ColoringChatProps = {
  initialMessages?: ColoringChatMessage[];
  /** Anropas när användaren byter röstläge (koppla till TTS/inställningar i senare steg). */
  onVoiceModeChange?: (mode: VoiceModeId) => void;
  /** Anropas när användaren skickar ett meddelande från formuläret (t.ex. koppla till `useChat`). */
  onSendMessage?: (text: string) => void;
};

const demoFallbackMessages: ColoringChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "Hej! Kan du göra en enhörning som jag får måla?",
  },
  {
    id: "2",
    role: "assistant",
    content:
      "Javisst! Här är en enkel enhörning med stora ytor att fylla i — perfekt för kritor eller filtpennor.",
    imageSrc: "/malbild-demo.svg",
    imageAlt: "Demobild: linjetecknad enhörning att måla",
  },
];

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ColoringChat({
  initialMessages,
  onVoiceModeChange,
  onSendMessage,
}: ColoringChatProps) {
  const formId = useId();
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const [voiceMode, setVoiceMode] = useState<VoiceModeId>("blue");
  const [messages, setMessages] = useState<ColoringChatMessage[]>(() =>
    initialMessages?.length ? initialMessages : demoFallbackMessages
  );
  const [draft, setDraft] = useState("");

  const handleVoiceChange = useCallback(
    (mode: VoiceModeId) => {
      setVoiceMode(mode);
      onVoiceModeChange?.(mode);
    },
    [onVoiceModeChange]
  );

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    const userMsg: ColoringChatMessage = {
      id: makeId(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    onSendMessage?.(trimmed);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-8 sm:p-6">
      <header className="space-y-1 text-center sm:text-left">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Måla med magi
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Prata eller skriv, få trygga förslag och målarbilder du kan spara hemma.
        </p>
      </header>

      <Card className="border-border/80 bg-card/95 shadow-md backdrop-blur-md supports-backdrop-filter:bg-card/90">
        <CardHeader className="gap-2 pb-2">
          <CardTitle className="text-lg font-semibold">Chatt</CardTitle>
          <VoiceModePicker value={voiceMode} onChange={handleVoiceChange} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <ScrollArea className="h-[min(52vh,420px)] rounded-xl border border-border/60 bg-muted/30 pr-2">
            <div className="flex flex-col gap-3 p-3 sm:p-4">
              {messages.map((m) => (
                <ChatMessageBubble key={m.id} message={m} />
              ))}
              <div ref={scrollAnchorRef} aria-hidden />
            </div>
          </ScrollArea>

          <form
            id={formId}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={handleSubmit}
          >
            <div className="flex-1 space-y-1">
              <label htmlFor={`${formId}-input`} className="sr-only">
                Skriv ett meddelande
              </label>
              <Input
                id={`${formId}-input`}
                placeholder="Skriv vad du vill måla…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="off"
                className="h-11 rounded-xl border-border/80 bg-background/80 text-base"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-11 shrink-0 rounded-xl px-6"
            >
              Skicka
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Allt här är gjort för barn — vuxna kan alltid hjälpa till vid sidan av.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
