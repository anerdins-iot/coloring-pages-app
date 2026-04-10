"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ColoringChatMessage } from "@/types/coloring-chat";
import { ColoringImageLightbox } from "@/components/coloring-image-lightbox";

type ChatMessageBubbleProps = {
  message: ColoringChatMessage;
};

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
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
            "max-w-[min(100%,34rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ring-1 ring-black/5 dark:ring-white/10",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-card text-card-foreground"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.imageSrc ? (
            <button
              type="button"
              className="group relative mt-3 w-full max-w-xs cursor-zoom-in overflow-hidden rounded-xl border border-border/80 bg-background/60 text-left transition hover:ring-2 hover:ring-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setLightboxOpen(true)}
              aria-label="Öppna större bild av målarbilden"
            >
              <span className="relative block aspect-square w-full max-w-[240px]">
                <Image
                  src={message.imageSrc}
                  alt={message.imageAlt ?? "Genererad målarbild"}
                  fill
                  className="object-cover transition group-hover:brightness-95"
                  sizes="240px"
                />
              </span>
              <span className="mt-1 block px-1 pb-1 text-xs text-muted-foreground group-hover:text-foreground">
                Tryck för stor bild
              </span>
            </button>
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
