"use client";

import Image from "next/image";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColoringChatMessage } from "@/types/coloring-chat";
import { ColoringImageLightbox } from "@/components/coloring-image-lightbox";

type ChatMessageBubbleProps = {
  message: ColoringChatMessage;
  onRequestEdit?: (
    imageId: string,
    imageSrc: string,
    imageAlt: string,
  ) => void;
  compact?: boolean;
};

function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function ChatMessageBubble({
  message,
  onRequestEdit,
  compact = false,
}: ChatMessageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isUser = message.role === "user";

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
            "rounded-2xl shadow-sm ring-1 ring-black/[0.04] dark:ring-white/10",
            isUser
              ? "max-w-[80%] rounded-br-md bg-primary px-5 py-3 text-primary-foreground"
              : "max-w-[90%] rounded-bl-md bg-white/70 px-5 py-4 text-foreground dark:bg-white/10",
          )}
        >
          {message.uploadedImageUrl ? (
            <div className="mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.uploadedImageUrl}
                alt="Uppladdad bild"
                className="max-w-[200px] rounded-lg object-cover"
              />
            </div>
          ) : null}
          {message.content ? (
            <div
              className={cn(
                "prose prose-sm max-w-none break-words leading-relaxed",
                isUser ? "prose-invert" : "dark:prose-invert",
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          ) : null}

          {message.imageSrc ? (
            <div className={cn("flex flex-col gap-3", message.content && "mt-4")}>
              {/* Image — large inline */}
              <button
                type="button"
                className="group inline-block cursor-zoom-in overflow-hidden rounded-2xl border-2 border-black/5 bg-white shadow-lg transition-all hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => setLightboxOpen(true)}
                aria-label="Öppna bild i fullstorlek"
              >
                {message.imageSrc.startsWith("data:") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={message.imageSrc}
                    alt={message.imageAlt ?? "Genererad målarbild"}
                    className="block max-w-full object-contain sm:max-w-md"
                  />
                ) : (
                  <span className="relative block aspect-[3/4] w-full max-w-md">
                    <Image
                      src={message.imageSrc}
                      alt={message.imageAlt ?? "Genererad målarbild"}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 448px"
                    />
                  </span>
                )}
              </button>

              {/* Actions row */}
              <div className="flex flex-wrap items-center gap-2">
                {onRequestEdit ? (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground/80 shadow-sm transition-all hover:bg-white hover:shadow-md"
                    onClick={() =>
                      onRequestEdit(
                        message.imageId ?? "",
                        message.imageSrc!,
                        message.imageAlt ?? "",
                      )
                    }
                  >
                    <Pencil className="size-3" />
                    Ändra
                  </button>
                ) : null}
                {message.imageSrc.startsWith("data:") ? (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground/80 shadow-sm transition-all hover:bg-white hover:shadow-md"
                    onClick={() =>
                      downloadImage(
                        message.imageSrc!,
                        `malarbild-${message.imageId ?? "bild"}.png`,
                      )
                    }
                  >
                    <Download className="size-3" />
                    Ladda ner
                  </button>
                ) : null}
                {message.estimatedCost != null &&
                message.estimatedCost > 0 ? (
                  <span
                    className="rounded-md bg-muted/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
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
