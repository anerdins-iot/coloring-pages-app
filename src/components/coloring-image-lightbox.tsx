"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ColoringImageLightboxProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
};

export function ColoringImageLightbox({
  open,
  onOpenChange,
  src,
  alt,
}: ColoringImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[min(90vh,920px)] max-w-[min(96vw,720px)] gap-3 border-border/80 bg-card p-3 sm:p-4"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Stor vy av målarbilden</DialogTitle>
          <DialogDescription>{alt}</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square w-full max-h-[min(75vh,680px)] overflow-hidden rounded-lg bg-muted">
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 96vw, 720px"
            priority={open}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Tips: tryck utanför bilden eller på Stäng för att gå tillbaka till chatten.
        </p>
      </DialogContent>
    </Dialog>
  );
}
