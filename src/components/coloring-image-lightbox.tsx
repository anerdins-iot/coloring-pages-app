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
        className="max-h-[95vh] max-w-[95vw] sm:max-w-[95vw] gap-2 border-border/80 bg-card p-2 sm:p-3"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Stor vy av målarbilden</DialogTitle>
          <DialogDescription>{alt}</DialogDescription>
        </DialogHeader>
        <div className="relative w-full overflow-hidden rounded-lg bg-white">
          {src.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              className="max-h-[88vh] w-full object-contain"
            />
          ) : (
            <div className="relative aspect-[3/4] w-full max-h-[88vh]">
              <Image
                src={src}
                alt={alt}
                fill
                className="object-contain"
                sizes="95vw"
                priority={open}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
