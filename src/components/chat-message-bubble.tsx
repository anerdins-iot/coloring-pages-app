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
  /** Compact mode for split-layout chat panel */
  compact?: boolean;
};

export function ChatMessageBubble({
  message,
  onRequestEdit,
  compact = false,
}: ChatMessageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isUser = message.role === "user";

  const imageSize = compact ? "max-w-[180px]" : "max-w-[240px]";

  return (
    <>
      <div
        className={cn(
          "flex w-full",
          isUser ? "justify-end" : "justify-start",
        )}
      >
        <div
          className={cn(
            "max-w-[min(100%,34rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ring-1 ring-black/5 dark:ring-white/10",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-white/60 text-card-foreground dark:bg-white/10",
            compact && "px-3 py-2 text-[13px]",
          )}
        >
          <div
            className={cn(
              "prose prose-sm max-w-none break-words",
              isUser ? "prose-invert" : "dark:prose-invert",
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
          {message.imageSrc ? (
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                className="group cursor-zoom-in overflow-hidden rounded-xl border-2 border-white/40 bg-white shadow-md text-left transition-all hover:scale-[1.02] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => setLightboxOpen(true)}
                aria-label="Öppna större bild"
              >
                {message.imageSrc.startsWith("data:") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={message.imageSrc}
                    alt={message.imageAlt ?? "Genererad målarbild"}
                    className={cn(
                      "block object-contain",
                      compact ? "max-w-[180px]" : "max-w-[240px]",
                    )}
                  />
                ) : (
                  <span className={cn(
                    "relative block aspect-square",
                    compact ? "w-[180px]" : "w-[240px]",
                  )}>
                    <Image
                      src={message.imageSrc}
                      alt={message.imageAlt ?? "Genererad målarbild"}
                      fill
                      className="object-contain"
                      sizes={compact ? "180px" : "240px"}
                    />
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2">
                {onRequestEdit ? (
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border border-primary/20 bg-white/80 px-3 py-1.5 text-xs font-medium shadow-sm transition-all hover:bg-white",
                      imageSize,
                    )}
                    onClick={() =>
                      onRequestEdit(
                        message.imageId ?? "",
                        message.imageSrc!,
                        message.imageAlt ?? "Genererad målarbild",
                      )
                    }
                  >
                    <Pencil className="size-3 shrink-0 text-primary" />
                    Ändra
                  </button>
                ) : null}
                {message.estimatedCost != null &&
                message.estimatedCost > 0 ? (
                  <span
                    className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
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
