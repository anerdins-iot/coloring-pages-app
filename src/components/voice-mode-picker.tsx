"use client";

import { cn } from "@/lib/utils";
import { VOICE_MODE_OPTIONS } from "@/lib/voice-modes";
import type { VoiceModeId } from "@/types/coloring-chat";

type VoiceModePickerProps = {
  value: VoiceModeId;
  onChange: (mode: VoiceModeId) => void;
  className?: string;
};

export function VoiceModePicker({
  value,
  onChange,
  className,
}: VoiceModePickerProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-foreground" id="voice-mode-label">
        Röstläge
      </p>
      <p className="text-xs text-muted-foreground">
        Välj hur assistenten låter när du pratar med den. Du kan byta när du vill.
      </p>
      <div
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        role="group"
        aria-labelledby="voice-mode-label"
      >
        {VOICE_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            data-active={value === opt.id}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-start rounded-xl px-4 py-2.5 text-left text-sm font-medium transition focus-visible:outline-none",
              opt.buttonClassName
            )}
            onClick={() => onChange(opt.id)}
            aria-pressed={value === opt.id}
          >
            <span className="font-semibold">{opt.label}</span>
            <span className="mt-0.5 text-xs font-normal opacity-90">
              {opt.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
