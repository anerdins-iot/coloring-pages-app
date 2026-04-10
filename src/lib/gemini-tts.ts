import { Buffer } from "node:buffer";

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
/** Standard samplingsfrekvens för Gemini TTS PCM-enligt Google-dokumentation. */
export const GEMINI_TTS_SAMPLE_RATE = 24_000;

type GeminiContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ inlineData?: { data?: string }; inline_data?: { data?: string } }>;
    };
  }>;
  error?: { message?: string; code?: number };
};

function getInlineAudioBase64(part: unknown): string | undefined {
  if (!part || typeof part !== "object") return undefined;
  const p = part as Record<string, unknown>;
  const inline = (p.inlineData ?? p.inline_data) as
    | { data?: string }
    | undefined;
  return inline?.data;
}

/**
 * Text-till-tal via Gemini API (samma nyckel som övriga Generative Language-anrop).
 * @see https://ai.google.dev/gemini-api/docs/speech-generation
 */
export async function synthesizeGeminiTtsPcm(args: {
  apiKey: string;
  text: string;
  voiceName: string;
}): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`;
  const prompt = `Läs följande text exakt högt på svenska (språkkod sv-SE). Var barnvänlig och tydlig. Ändra inga ord:\n\n${args.text}`;

  const res = await fetch(`${url}?key=${encodeURIComponent(args.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: args.voiceName },
          },
        },
      },
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini TTS HTTP ${res.status}: ${raw.slice(0, 500)}`);
  }

  let json: GeminiContentResponse;
  try {
    json = JSON.parse(raw) as GeminiContentResponse;
  } catch {
    throw new Error(`Gemini TTS: ogiltigt JSON-svar: ${raw.slice(0, 200)}`);
  }

  if (json.error?.message) {
    throw new Error(`Gemini TTS: ${json.error.message}`);
  }

  const parts = json.candidates?.[0]?.content?.parts;
  const firstPart = parts?.[0];
  const b64 = getInlineAudioBase64(firstPart);
  if (!b64) {
    throw new Error(
      `Gemini TTS: saknade ljuddata i svar: ${raw.slice(0, 400)}`,
    );
  }
  return Buffer.from(b64, "base64");
}
