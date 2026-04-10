"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2, VolumeX, X, Download, Pencil, ImagePlus } from "lucide-react";
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
  onSendMessage?: (text: string, files?: FileList) => void | Promise<void>;
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
  const [attachedFiles, setAttachedFiles] = useState<FileList | null>(null);
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

  const previewUrl =
    attachedFiles && attachedFiles.length > 0
      ? URL.createObjectURL(attachedFiles[0])
      : null;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const dt = new DataTransfer();
          dt.items.add(file);
          setAttachedFiles(dt.files);
        }
        break;
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if ((!trimmed && !attachedFiles) || disableSend) return;

    const messageText = editingImage
      ? `[Redigera bild ${editingImage.imageId}] ${trimmed || "Gör en målarbild av detta"}`
      : (trimmed || "Gör en målarbild av detta");

    if (!isControlledList) {
      const userMsg: ColoringChatMessage = {
        id: makeId(),
        role: "user",
        content: trimmed || "Gör en målarbild av detta",
      };
      setInternalMessages((prev) => [...prev, userMsg]);
    }
    // Capture files before clearing state (React may re-render and invalidate ref)
    const filesToSend = attachedFiles;

    setDraft("");
    setEditingImage(null);
    setAttachedFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    await onSendMessage?.(messageText, filesToSend ?? undefined);
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

    const blob = new Blob(chunksRef.current, { type: mime });
    chunksRef.current = [];
    if (blob.size < 64) return;

    setTranscribing(true);
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: blob.type || mime }),
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
          onChange={(e) => setAttachedFiles(e.target.files)}
        />

        {/* Attached image preview */}
        {previewUrl ? (
          <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
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
                setAttachedFiles(null);
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
              variant={recording ? "destructive" : "ghost"}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              disabled={transcribing}
              onClick={() =>
                recording
                  ? void stopRecordingAndTranscribe()
                  : void startRecording()
              }
              aria-pressed={recording}
              aria-label={recording ? "Stoppa inspelning" : "Mikrofon"}
            >
              {transcribing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : recording ? (
                <Square className="size-4" fill="currentColor" />
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
                  : attachedFiles
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
            disabled={disableSend || (!draft.trim() && !attachedFiles)}
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
