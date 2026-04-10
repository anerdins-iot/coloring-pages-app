const STT_MODEL = "gemini-3.1-flash-lite-preview";

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
  promptFeedback?: { blockReason?: string };
};

/**
 * Tal-till-text via Gemini (inline ljud + transkriptionsprompt).
 * Språk: sv-SE krav i prompten.
 */
export async function transcribeGeminiAudio(args: {
  apiKey: string;
  base64Audio: string;
  mimeType: string;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${STT_MODEL}:generateContent`;
  const prompt =
    "Transkribera det som sägs på inspelningen. Språket ska vara svenska (sv-SE). " +
    "Svara med exakt transkriptionen och inget annat — ingen hälsning, inga citattecken.";

  const res = await fetch(`${url}?key=${encodeURIComponent(args.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: args.mimeType,
                data: args.base64Audio,
              },
            },
            { text: prompt },
          ],
        },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini STT HTTP ${res.status}: ${raw.slice(0, 500)}`);
  }

  let json: GeminiGenerateResponse;
  try {
    json = JSON.parse(raw) as GeminiGenerateResponse;
  } catch {
    throw new Error(`Gemini STT: ogiltigt JSON-svar: ${raw.slice(0, 200)}`);
  }

  if (json.error?.message) {
    throw new Error(`Gemini STT: ${json.error.message}`);
  }

  if (json.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini STT blockerad: ${json.promptFeedback.blockReason}`,
    );
  }

  const text = json.candidates?.[0]?.content?.parts?.find(
    (p) => typeof p.text === "string",
  )?.text;

  if (!text?.trim()) {
    throw new Error(`Gemini STT: tomt svar: ${raw.slice(0, 400)}`);
  }

  return text.trim();
}
