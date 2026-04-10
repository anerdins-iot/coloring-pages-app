"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, X, ImagePlus } from "lucide-react";
import { useDeepgramSTT } from "@/hooks/use-deepgram-stt";
import { Button } from "@/components/ui/button";
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
  onSendMessage?: (text: string, imageDataUrl?: string) => void | Promise<void>;
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

function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [internalMessages, setInternalMessages] = useState<
    ColoringChatMessage[]
  >(() =>
    initialMessages?.length ? initialMessages : demoFallbackMessages,
  );

  const isControlledList = controlledMessages != null;
  const messages = isControlledList ? controlledMessages : internalMessages;

  const [draft, setDraft] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null); // data-URL
  const deepgram = useDeepgramSTT();
  const [editingImage, setEditingImage] = useState<{
    imageId: string;
    imageSrc: string;
    imageAlt: string;
  } | null>(null);

  // Sync Deepgram real-time transcript into draft field
  const prevDraftBeforeSTT = useRef("");
  useEffect(() => {
    if (!deepgram.listening && !deepgram.interim && !deepgram.transcript) return;
    const live = deepgram.interim || deepgram.transcript;
    if (live) {
      const prefix = prevDraftBeforeSTT.current;
      setDraft(prefix ? `${prefix} ${live}` : live);
    }
  }, [deepgram.interim, deepgram.transcript, deepgram.listening]);

  // When STT finishes (listening goes false), lock the final transcript into draft
  const wasListening = useRef(false);
  useEffect(() => {
    if (wasListening.current && !deepgram.listening && deepgram.transcript) {
      const prefix = prevDraftBeforeSTT.current;
      setDraft(prefix ? `${prefix} ${deepgram.transcript}` : deepgram.transcript);
    }
    wasListening.current = deepgram.listening;
  }, [deepgram.listening, deepgram.transcript]);

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

  // Helper: read a File as data-URL
  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error("Filläsning misslyckades"));
      reader.readAsDataURL(file);
    });
  }

  async function attachFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    setAttachedImage(dataUrl);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) void attachFile(file);
        break;
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if ((!trimmed && !attachedImage) || disableSend) return;

    const messageText = editingImage
      ? `[Redigera bild ${editingImage.imageId}] ${trimmed || "Gör en målarbild av detta"}`
      : (trimmed || "Gör en målarbild av detta");

    if (!isControlledList) {
      const userMsg: ColoringChatMessage = {
        id: makeId(),
        role: "user",
        content: trimmed || "Gör en målarbild av detta",
        uploadedImageUrl: attachedImage ?? undefined,
      };
      setInternalMessages((prev) => [...prev, userMsg]);
    }

    const imageToSend = attachedImage;
    setDraft("");
    setEditingImage(null);
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    await onSendMessage?.(messageText, imageToSend ?? undefined);
  }

  function toggleSTT() {
    if (deepgram.listening) {
      deepgram.stop();
    } else {
      prevDraftBeforeSTT.current = draft.trim();
      void deepgram.start();
    }
  }

  const totalCost = messages.reduce(
    (sum, m) => sum + (m.estimatedCost ?? 0),
    0,
  );
  const streaming = chatStatus === "streaming" || chatStatus === "submitted";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-4xl flex-col px-4 py-4 sm:px-6 sm:py-6">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-3xl">
            Måla med magi
          </h1>
          <p className="text-sm font-medium text-white/80 drop-shadow-sm">
            Skriv vad du vill måla — AI:n skapar bilden
          </p>
        </div>
        {imageModel && imageModels && onImageModelChange ? (
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <ModelSelector
              models={imageModels}
              value={imageModel}
              onChange={onImageModelChange}
            />
            {totalCost > 0 ? (
              <span className="text-[10px] font-mono text-white/50">
                ${totalCost.toFixed(3)}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* Main chat card — fills remaining height */}
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/25 bg-white/85 shadow-2xl backdrop-blur-xl dark:bg-black/70 dark:border-white/10 overflow-hidden">
        {chatError ? (
          <div className="px-5 pt-4">
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {chatError.message || "Ett fel uppstod."}
            </p>
          </div>
        ) : null}

        {/* Messages */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            {messages.map((m) => (
              <ChatMessageBubble
                key={m.id}
                message={m}
                onRequestEdit={m.imageId ? handleRequestEdit : undefined}
              />
            ))}
            <div ref={scrollAnchorRef} aria-hidden />
          </div>
        </ScrollArea>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void attachFile(file);
          }}
        />

        {/* Attached image preview */}
        {attachedImage ? (
          <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachedImage}
              alt="Bifogad bild"
              className="h-12 w-12 rounded-lg object-cover shrink-0"
            />
            <span className="flex-1 text-xs text-muted-foreground">
              Bild bifogad — skriv vad du vill göra med den
            </span>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setAttachedImage(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-label="Ta bort bifogad bild"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {/* Editing indicator */}
        {editingImage ? (
          <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={editingImage.imageSrc}
              alt={editingImage.imageAlt}
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
              width={40}
              height={40}
            />
            <span className="flex-1 text-sm text-muted-foreground">
              Beskriv vad du vill ändra
            </span>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground"
              onClick={() => setEditingImage(null)}
              aria-label="Avbryt"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {/* Input */}
        <form
          id={formId}
          className="flex items-center gap-2 border-t border-border/30 bg-white/50 px-4 py-3 dark:bg-black/30"
          onSubmit={handleSubmit}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Bifoga bild"
          >
            <ImagePlus className="size-4" />
          </Button>
          {voiceInputEnabled ? (
            <Button
              type="button"
              variant={deepgram.listening ? "destructive" : "ghost"}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={toggleSTT}
              aria-pressed={deepgram.listening}
              aria-label={deepgram.listening ? "Stoppa diktering" : "Diktera"}
            >
              {deepgram.listening ? (
                <MicOff className="size-4 animate-pulse" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <label htmlFor={`${formId}-input`} className="sr-only">
              Skriv ett meddelande
            </label>
            <Input
              id={`${formId}-input`}
              ref={inputRef}
              placeholder={
                editingImage
                  ? "Beskriv vad du vill ändra…"
                  : attachedImage
                    ? "Skriv vad du vill göra med bilden…"
                    : "Skriv vad du vill måla…"
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPaste={handlePaste}
              autoComplete="off"
              className="h-10 rounded-xl border-border/50 bg-white/70 text-sm font-medium dark:bg-white/10"
            />
          </div>
          <Button
            type="button"
            variant={isVoiceEnabled ? "default" : "ghost"}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            onClick={onVoiceToggle}
            aria-label={isVoiceEnabled ? "Ljud av" : "Ljud på"}
          >
            {isVoiceEnabled ? (
              <Volume2 className="size-4" />
            ) : (
              <VolumeX className="size-4" />
            )}
          </Button>
          {streaming && onStopGeneration ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0 rounded-xl px-3"
              onClick={() => void onStopGeneration()}
            >
              Stopp
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            className="h-10 shrink-0 rounded-xl px-6 font-bold"
            disabled={disableSend || (!draft.trim() && !attachedImage)}
          >
            Skicka
          </Button>
        </form>
      </div>

      <p className="mt-2 text-center text-[11px] font-medium text-white/50 drop-shadow-sm">
        Gjort för barn — vuxna kan alltid hjälpa till.
      </p>
    </div>
  );
}
