"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessageBubble } from "@/components/chat-message-bubble";
import { VoiceModePicker } from "@/components/voice-mode-picker";
import type { ChatStatus } from "ai";
import type { ColoringChatMessage, VoiceModeId } from "@/types/coloring-chat";

export type ColoringChatProps = {
  initialMessages?: ColoringChatMessage[];
  /**
   * När satt visas dessa meddelanden direkt (t.ex. mappade från useChat).
   * Lokala demo-meddelanden används då inte.
   */
  messages?: ColoringChatMessage[];
  /** Externt röstläge; när satt tillsammans med onVoiceModeChange är det kontrollerat. */
  voiceMode?: VoiceModeId;
  onVoiceModeChange?: (mode: VoiceModeId) => void;
  /** Krävs för AI-läge när användaren skickar text. */
  onSendMessage?: (text: string) => void | Promise<void>;
  /** Aktivera inspelning → /api/stt (Google via Gemini). */
  voiceInputEnabled?: boolean;
  disableSend?: boolean;
  chatStatus?: ChatStatus;
  chatError?: Error;
  onStopGeneration?: () => void | Promise<void>;
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const res = r.result;
      if (typeof res !== "string") {
        reject(new Error("Filavläsning misslyckades"));
        return;
      }
      const comma = res.indexOf(",");
      if (comma === -1) {
        reject(new Error("Ogiltig data-URL"));
        return;
      }
      resolve(res.slice(comma + 1));
    };
    r.onerror = () => reject(r.error ?? new Error("Filavläsning misslyckades"));
    r.readAsDataURL(blob);
  });
}

export function ColoringChat({
  initialMessages,
  messages: controlledMessages,
  voiceMode: controlledVoiceMode,
  onVoiceModeChange,
  onSendMessage,
  voiceInputEnabled = false,
  disableSend = false,
  chatStatus = "ready",
  chatError,
  onStopGeneration,
}: ColoringChatProps) {
  const formId = useId();
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [internalVoiceMode, setInternalVoiceMode] =
    useState<VoiceModeId>("blue");
  const voiceMode = controlledVoiceMode ?? internalVoiceMode;

  const [internalMessages, setInternalMessages] = useState<
    ColoringChatMessage[]
  >(() =>
    initialMessages?.length ? initialMessages : demoFallbackMessages,
  );

  const isControlledList = controlledMessages != null;
  const messages = isControlledList ? controlledMessages : internalMessages;

  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const handleVoiceChange = useCallback(
    (mode: VoiceModeId) => {
      if (controlledVoiceMode === undefined) {
        setInternalVoiceMode(mode);
      }
      onVoiceModeChange?.(mode);
    },
    [controlledVoiceMode, onVoiceModeChange],
  );

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || disableSend) return;

    if (!isControlledList) {
      const userMsg: ColoringChatMessage = {
        id: makeId(),
        role: "user",
        content: trimmed,
      };
      setInternalMessages((prev) => [...prev, userMsg]);
    }
    setDraft("");
    await onSendMessage?.(trimmed);
  }

  async function startRecording() {
    if (!voiceInputEnabled || recording || transcribing) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const preferredTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ];
    const mimeType =
      preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    mediaRecorderRef.current = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
    };
    rec.start();
    setRecording(true);
  }

  async function stopRecordingAndTranscribe() {
    const rec = mediaRecorderRef.current;
    if (!rec || !voiceInputEnabled) return;
    const mime = rec.mimeType || "audio/webm";
    setRecording(false);
    await new Promise<void>((resolve) => {
      rec.addEventListener("stop", () => resolve(), { once: true });
      rec.stop();
    });
    mediaRecorderRef.current = null;

    const blob = new Blob(chunksRef.current, {
      type: mime,
    });
    chunksRef.current = [];

    if (blob.size < 64) return;

    setTranscribing(true);
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type || mime,
        }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        console.error("[STT]", res.status, data);
        throw new Error(data.error ?? "STT misslyckades");
      }
      if (data.text?.trim()) {
        setDraft((d) => (d ? `${d.trim()} ${data.text}` : data.text!));
      }
    } catch (err) {
      console.error("[STT]", err);
    } finally {
      setTranscribing(false);
    }
  }

  const streaming = chatStatus === "streaming" || chatStatus === "submitted";

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

      <Card className="border-border/80 bg-card/95 shadow-xl backdrop-blur-md supports-backdrop-filter:bg-card/90 ring-1 ring-white/20 dark:ring-white/10">
        <CardHeader className="gap-2 pb-2">
          <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Magisk Chatt</CardTitle>
          <VoiceModePicker value={voiceMode} onChange={handleVoiceChange} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          {chatError ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {chatError.message ||
                "Ett fel uppstod. Försök igen eller be en vuxen om hjälp."}
            </p>
          ) : null}

          <ScrollArea className="h-[min(52vh,420px)] rounded-xl border border-border/60 bg-muted/30 pr-2 shadow-inner">
            <div className="flex flex-col gap-4 p-4 sm:p-5">
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
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
              {voiceInputEnabled ? (
                <Button
                  type="button"
                  variant={recording ? "destructive" : "secondary"}
                  size="lg"
                  className="h-11 shrink-0 rounded-xl px-4"
                  disabled={transcribing}
                  onClick={() =>
                    recording
                      ? void stopRecordingAndTranscribe()
                      : void startRecording()
                  }
                  aria-pressed={recording}
                  aria-label={
                    recording ? "Stoppa inspelning" : "Spela in med mikrofon"
                  }
                >
                  {transcribing ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : recording ? (
                    <Square className="size-5" fill="currentColor" />
                  ) : (
                    <Mic className="size-5" />
                  )}
                </Button>
              ) : null}
              <div className="min-w-0 flex-1 space-y-1">
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
            </div>
            {streaming && onStopGeneration ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 shrink-0 rounded-xl px-5"
                onClick={() => void onStopGeneration()}
              >
                Stoppa
              </Button>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="h-11 shrink-0 rounded-xl px-6"
              disabled={disableSend || !draft.trim()}
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
