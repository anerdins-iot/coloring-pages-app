import type { VoiceModeId } from "@/types/coloring-chat";

export type VoiceModeOption = {
  id: VoiceModeId;
  label: string;
  description: string;
  /** Tailwind-klasser för knappbakgrund och text — använder tokens från globals.css */
  buttonClassName: string;
  /** Om false anropas inte TTS-API från klienten (kostnadsbesparing). */
  requiresReadAloud: boolean;
  /** Förvald röst i Gemini TTS (prebuiltVoiceConfig.voiceName). */
  geminiTtsVoiceName: string;
};

export const VOICE_MODE_OPTIONS: VoiceModeOption[] = [
  {
    id: "blue",
    label: "Blå röst",
    description:
      "Lugn och tydlig — bra när man vill ha långsamma, tydliga ord. Uppläsning påslagen.",
    buttonClassName:
      "border-2 border-voice-blue/40 bg-voice-blue text-voice-blue-foreground shadow-sm hover:brightness-95 data-[active=true]:ring-2 data-[active=true]:ring-voice-blue/80 data-[active=true]:ring-offset-2 data-[active=true]:ring-offset-card",
    requiresReadAloud: true,
    geminiTtsVoiceName: "Iapetus",
  },
  {
    id: "green",
    label: "Grön röst",
    description:
      "Glad och peppig — lite mer energi och lek i tonen. Uppläsning påslagen.",
    buttonClassName:
      "border-2 border-voice-green/45 bg-voice-green text-voice-green-foreground shadow-sm hover:brightness-95 data-[active=true]:ring-2 data-[active=true]:ring-voice-green/80 data-[active=true]:ring-offset-2 data-[active=true]:ring-offset-card",
    requiresReadAloud: true,
    geminiTtsVoiceName: "Puck",
  },
  {
    id: "orange",
    label: "Orange röst",
    description:
      "Sprallig och rolig — samma vänliga svar i chatten, men utan uppläsning (du läser själv).",
    buttonClassName:
      "border-2 border-voice-orange/45 bg-voice-orange text-voice-orange-foreground shadow-sm hover:brightness-95 data-[active=true]:ring-2 data-[active=true]:ring-voice-orange/80 data-[active=true]:ring-offset-2 data-[active=true]:ring-offset-card",
    requiresReadAloud: false,
    geminiTtsVoiceName: "Zephyr",
  },
] as const;

export function getVoiceModeOption(id: VoiceModeId): VoiceModeOption {
  const found = VOICE_MODE_OPTIONS.find((o) => o.id === id);
  if (!found) {
    throw new Error(`Okänt röstläge: ${id}`);
  }
  return found;
}

export function voiceModeRequiresReadAloud(mode: VoiceModeId): boolean {
  return getVoiceModeOption(mode).requiresReadAloud;
}

export function getGeminiTtsVoiceName(mode: VoiceModeId): string {
  return getVoiceModeOption(mode).geminiTtsVoiceName;
}
