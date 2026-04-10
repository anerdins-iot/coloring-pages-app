"use client";

import Image from "next/image";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColoringChatMessage } from "@/types/coloring-chat";
import { ColoringImageLightbox } from "@/components/coloring-image-lightbox";

type ChatMessageBubbleProps = {
  message: ColoringChatMessage;
  onRequestEdit?: (imageId: string, imageSrc: string, imageAlt: string) => void;
};

export function ChatMessageBubble({ message, onRequestEdit }: ChatMessageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isUser = message.role === "user";

  return (
    <>
      <div
        className={cn(
          "flex w-full",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        <div
          className={cn(
            "max-w-[min(100%,34rem)] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ring-1 ring-black/5 dark:ring-white/10",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-card text-card-foreground"
          )}
        >
          <div className={cn("prose prose-sm max-w-none break-words", isUser ? "prose-invert" : "dark:prose-invert")}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
          {message.imageSrc ? (
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="group relative w-full max-w-xs cursor-zoom-in overflow-hidden rounded-xl border-4 border-white/20 bg-background/60 shadow-lg text-left transition-all hover:scale-[1.02] hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
                onClick={() => setLightboxOpen(true)}
                aria-label="Öppna större bild av målarbilden"
              >
                <span className="relative block aspect-square w-full max-w-[240px]">
                  {message.imageSrc.startsWith("data:") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data-URL finns inte som statisk fil
                    <img
                      src={message.imageSrc}
                      alt={message.imageAlt ?? "Genererad målarbild"}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      width={240}
                      height={240}
                    />
                  ) : (
                    <Image
                      src={message.imageSrc}
                      alt={message.imageAlt ?? "Genererad målarbild"}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="240px"
                    />
                  )}
                </span>
                <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8 text-xs font-medium text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  Tryck för stor bild
                </span>
              </button>
              <div className="flex items-center gap-2 max-w-xs">
                {onRequestEdit ? (
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 rounded-2xl border-2 border-primary/20 bg-white/80 px-4 py-2 text-sm font-medium shadow-md transition-all hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    onClick={() =>
                      onRequestEdit(
                        message.imageId ?? "",
                        message.imageSrc!,
                        message.imageAlt ?? "Genererad målarbild",
                      )
                    }
                  >
                    <Pencil className="size-4 shrink-0 text-primary" />
                    Ändra bilden
                  </button>
                ) : null}
                {message.estimatedCost != null && message.estimatedCost > 0 ? (
                  <span
                    className="shrink-0 rounded-lg bg-muted/80 px-2 py-1 text-[10px] font-mono text-muted-foreground"
                    title={`Modell: ${message.modelUsed ?? "okänd"}`}
                  >
                    ${message.estimatedCost.toFixed(3)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {message.imageSrc ? (
        <ColoringImageLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          src={message.imageSrc}
          alt={message.imageAlt ?? "Genererad målarbild"}
        />
      ) : null}
    </>
  );
}
