"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2, VolumeX, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessageBubble } from "@/components/chat-message-bubble";
import { ModelSelector } from "@/components/model-selector";
import { ColoringImageLightbox } from "@/components/coloring-image-lightbox";
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<{
    imageId: string;
    imageSrc: string;
    imageAlt: string;
  } | null>(null);

  // Find the latest generated image for the preview panel
  const latestImage = [...messages]
    .reverse()
    .find((m) => m.imageSrc && m.imageSrc.startsWith("data:"));

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
    <>
      <div className="flex h-dvh flex-col lg:flex-row">
        {/* ===== LEFT: Chat panel ===== */}
        <div className="flex min-w-0 flex-1 flex-col lg:max-w-[520px] xl:max-w-[580px]">
          {/* Header */}
          <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md sm:text-2xl">
                Måla med magi
              </h1>
              <p className="text-xs text-white/70 drop-shadow-sm sm:text-sm">
                Skriv vad du vill måla — AI:n skapar bilden!
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

          {/* Chat area */}
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/20 bg-white/80 shadow-2xl backdrop-blur-xl dark:bg-black/60 dark:border-white/10">
              {chatError ? (
                <div className="px-4 pt-3">
                  <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {chatError.message || "Ett fel uppstod."}
                  </p>
                </div>
              ) : null}

              {/* Messages */}
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-3 p-4">
                  {messages.map((m) => (
                    <ChatMessageBubble
                      key={m.id}
                      message={m}
                      onRequestEdit={
                        m.imageId ? handleRequestEdit : undefined
                      }
                      compact
                    />
                  ))}
                  <div ref={scrollAnchorRef} aria-hidden />
                </div>
              </ScrollArea>

              {/* Editing indicator */}
              {editingImage ? (
                <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editingImage.imageSrc}
                    alt={editingImage.imageAlt}
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    width={40}
                    height={40}
                  />
                  <span className="flex-1 text-xs text-muted-foreground">
                    Beskriv vad du vill ändra
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingImage(null)}
                    aria-label="Avbryt"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : null}

              {/* Input form */}
              <form
                id={formId}
                className="flex items-end gap-2 border-t border-border/40 p-3"
                onSubmit={handleSubmit}
              >
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
                    aria-label={
                      recording
                        ? "Stoppa inspelning"
                        : "Spela in med mikrofon"
                    }
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
                        : "Skriv vad du vill måla…"
                    }
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoComplete="off"
                    className="h-10 rounded-xl border-border/60 bg-muted/40 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant={isVoiceEnabled ? "default" : "ghost"}
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl"
                  onClick={onVoiceToggle}
                  aria-label={
                    isVoiceEnabled
                      ? "Stäng av uppläsning"
                      : "Slå på uppläsning"
                  }
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
                    className="h-10 shrink-0 rounded-xl px-3 text-xs"
                    onClick={() => void onStopGeneration()}
                  >
                    Stopp
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  size="sm"
                  className="h-10 shrink-0 rounded-xl px-5 text-sm font-semibold"
                  disabled={disableSend || !draft.trim()}
                >
                  Skicka
                </Button>
              </form>
            </div>

            <p className="mt-2 text-center text-[10px] text-white/50 drop-shadow-sm">
              Gjort för barn — vuxna kan alltid hjälpa till.
            </p>
          </div>
        </div>

        {/* ===== RIGHT: Image preview panel (desktop only) ===== */}
        <div className="hidden lg:flex flex-1 items-center justify-center p-6 xl:p-10">
          {latestImage?.imageSrc ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
              <button
                type="button"
                className="group relative w-full cursor-zoom-in overflow-hidden rounded-3xl border-4 border-white/30 bg-white/90 shadow-2xl backdrop-blur-sm transition-all duration-500 hover:shadow-3xl hover:border-white/50"
                onClick={() => setLightboxOpen(true)}
                aria-label="Öppna bild i fullstorlek"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={latestImage.imageSrc}
                  alt={latestImage.imageAlt ?? "Senaste målarbilden"}
                  className="aspect-square w-full object-contain p-4 transition-transform duration-700 group-hover:scale-[1.02]"
                />
              </button>

              {/* Actions under the image */}
              <div className="flex items-center gap-3">
                {latestImage.imageId ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm font-medium text-foreground/80 shadow-md backdrop-blur-sm transition-all hover:bg-white hover:shadow-lg"
                    onClick={() =>
                      handleRequestEdit(
                        latestImage.imageId!,
                        latestImage.imageSrc!,
                        latestImage.imageAlt ?? "",
                      )
                    }
                  >
                    Ändra bilden
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm font-medium text-foreground/80 shadow-md backdrop-blur-sm transition-all hover:bg-white hover:shadow-lg"
                  onClick={() =>
                    downloadImage(
                      latestImage.imageSrc!,
                      `malarbild-${latestImage.imageId ?? "bild"}.png`,
                    )
                  }
                >
                  <Download className="size-4" />
                  Ladda ner
                </button>
                {latestImage.estimatedCost != null &&
                latestImage.estimatedCost > 0 ? (
                  <span
                    className="rounded-lg bg-white/60 px-2.5 py-1 text-[11px] font-mono text-muted-foreground backdrop-blur-sm"
                    title={`Modell: ${latestImage.modelUsed ?? "okänd"}`}
                  >
                    ${latestImage.estimatedCost.toFixed(3)}
                  </span>
                ) : null}
              </div>

              {latestImage.imageAlt ? (
                <p className="text-center text-sm text-white/60 drop-shadow-sm">
                  {latestImage.imageAlt}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center text-white/40">
              <div className="flex h-48 w-48 items-center justify-center rounded-3xl border-2 border-dashed border-white/20">
                <span className="text-6xl">🎨</span>
              </div>
              <p className="text-sm font-medium drop-shadow-sm">
                Din målarbild visas här
              </p>
              <p className="text-xs text-white/30">
                Skriv vad du vill måla i chatten
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {latestImage?.imageSrc ? (
        <ColoringImageLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          src={latestImage.imageSrc}
          alt={latestImage.imageAlt ?? "Målarbild"}
        />
      ) : null}
    </>
  );
}
