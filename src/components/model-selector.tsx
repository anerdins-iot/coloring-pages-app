"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageModelConfig, ImageModelId } from "@/lib/image-models";

type ModelSelectorProps = {
  models: ImageModelConfig[];
  value: ImageModelId;
  onChange: (id: ImageModelId) => void;
};

const qualityBadge: Record<string, { label: string; className: string }> = {
  standard: {
    label: "$",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  high: {
    label: "$$",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  },
  ultra: {
    label: "$$$",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  },
};

export function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = models.find((m) => m.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-background hover:text-foreground hover:shadow-md",
          open && "bg-background text-foreground shadow-md",
        )}
        aria-label="Välj bildmodell"
        title="Bildmodell"
      >
        <Settings className="size-3.5" />
        <span className="hidden sm:inline">{current?.label ?? "Modell"}</span>
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border/80 bg-card/95 p-1.5 shadow-xl backdrop-blur-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bildgenerering
          </p>
          {models.map((m) => {
            const badge = qualityBadge[m.quality];
            const selected = m.id === value;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                  selected
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {m.description}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground/70">
                      ~${m.costPerImage.toFixed(3)}/bild
                    </span>
                  </div>
                </div>
                {selected ? (
                  <Check className="size-4 shrink-0 text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
