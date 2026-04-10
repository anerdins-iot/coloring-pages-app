"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessageBubble } from "@/components/chat-message-bubble";
import { ModelSelector } from "@/components/model-selector";
import type { ChatStatus } from "ai";
import type { ColoringChatMessage } from "@/types/coloring-chat";
import type { ImageModelConfig, ImageModelId } from "@/lib/image-models";

export type ColoringChatProps = {
  initialMessages?: ColoringChatMessage[];
  messages?: ColoringChatMessage[];
  isVoiceEnabled?: boolean;
  onVoiceToggle?: () => void;
  onSendMessage?: (text: string) => void | Promise<void>;
  voiceInputEnabled?: boolean;
  disableSend?: boolean;
  chatStatus?: ChatStatus;
  chatError?: Error;
  onStopGeneration?: () => void | Promise<void>;
  imageModel?: ImageModelId;
  onImageModelChange?: (id: ImageModelId) => void;
  imageModels?: ImageModelConfig[];
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
    r.onerror = () =>
      reject(r.error ?? new Error("Filavläsning misslyckades"));
    r.readAsDataURL(blob);
  });
}

export function ColoringChat({
  initialMessages,
  messages: controlledMessages,
  isVoiceEnabled = false,
  onVoiceToggle,
  onSendMessage,
  voiceInputEnabled = false,
  disableSend = false,
  chatStatus = "ready",
  chatError,
  onStopGeneration,
  imageModel,
  onImageModelChange,
  imageModels,
}: ColoringChatProps) {
  const formId = useId();
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

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
  const [editingImage, setEditingImage] = useState<{
    imageId: string;
    imageSrc: string;
    imageAlt: string;
  } | null>(null);

  function handleRequestEdit(
    imageId: string,
    imageSrc: string,
    imageAlt: string,
  ) {
    setEditingImage({ imageId, imageSrc, imageAlt });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

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

    const messageText = editingImage
      ? `[Redigera bild ${editingImage.imageId}] ${trimmed}`
      : trimmed;

    if (!isControlledList) {
      const userMsg: ColoringChatMessage = {
        id: makeId(),
        role: "user",
        content: trimmed,
      };
      setInternalMessages((prev) => [...prev, userMsg]);
    }
    setDraft("");
    setEditingImage(null);
    await onSendMessage?.(messageText);
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

  // Calculate total session cost
  const totalCost = messages.reduce(
    (sum, m) => sum + (m.estimatedCost ?? 0),
    0,
  );

  const streaming = chatStatus === "streaming" || chatStatus === "submitted";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-8 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Måla med magi
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Prata eller skriv, få trygga förslag och målarbilder du kan spara
            hemma.
          </p>
        </div>
        {imageModel && imageModels && onImageModelChange ? (
          <div className="flex flex-col items-end gap-1 shrink-0 pt-1">
            <ModelSelector
              models={imageModels}
              value={imageModel}
              onChange={onImageModelChange}
            />
            {totalCost > 0 ? (
              <span className="text-[10px] font-mono text-muted-foreground/60">
                Session: ${totalCost.toFixed(3)}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <Card className="border-border/80 bg-card/95 shadow-xl backdrop-blur-md supports-backdrop-filter:bg-card/90 ring-1 ring-white/20 dark:ring-white/10">
        <CardHeader className="gap-2 pb-2">
          <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Magisk Chatt
          </CardTitle>
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
                <ChatMessageBubble
                  key={m.id}
                  message={m}
                  onRequestEdit={
                    m.imageId ? handleRequestEdit : undefined
                  }
                />
              ))}
              <div ref={scrollAnchorRef} aria-hidden />
            </div>
          </ScrollArea>

          {editingImage ? (
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- data-URL */}
              <img
                src={editingImage.imageSrc}
                alt={editingImage.imageAlt}
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
                width={48}
                height={48}
              />
              <span className="flex-1 text-xs font-medium text-muted-foreground">
                Redigerar bild — beskriv vad du vill ändra
              </span>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => setEditingImage(null)}
                aria-label="Avbryt redigering"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}

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
                    recording
                      ? "Stoppa inspelning"
                      : "Spela in med mikrofon"
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
                  ref={inputRef}
                  placeholder={
                    editingImage
                      ? "Beskriv vad du vill ändra…"
                      : "Skriv vad du vill måla…"
                  }
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoComplete="off"
                  className="h-11 rounded-xl border-border/80 bg-background/80 text-base"
                />
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                variant={isVoiceEnabled ? "default" : "secondary"}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                onClick={onVoiceToggle}
                aria-label={
                  isVoiceEnabled
                    ? "Stäng av uppläsning"
                    : "Slå på uppläsning"
                }
                title={
                  isVoiceEnabled
                    ? "Stäng av uppläsning"
                    : "Slå på uppläsning"
                }
              >
                {isVoiceEnabled ? (
                  <Volume2 className="size-5" />
                ) : (
                  <VolumeX className="size-5" />
                )}
              </Button>
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
            </div>
          </form>
          <p className="text-xs text-muted-foreground">
            Allt här är gjort för barn — vuxna kan alltid hjälpa till vid
            sidan av.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
