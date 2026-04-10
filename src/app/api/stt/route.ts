import { transcribeGeminiAudio } from "@/lib/gemini-stt";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

type SttBody = {
  audioBase64?: string;
  mimeType?: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("[api/stt] GOOGLE_GENERATIVE_AI_API_KEY saknas");
    return new Response(
      JSON.stringify({ error: "STT är inte konfigurerad på servern." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: SttBody;
  try {
    body = (await req.json()) as SttBody;
  } catch {
    return new Response(JSON.stringify({ error: "Ogiltig JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { audioBase64, mimeType } = body;
  if (typeof audioBase64 !== "string" || !audioBase64.trim()) {
    return new Response(JSON.stringify({ error: "Ljud saknas." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (typeof mimeType !== "string" || !mimeType.trim()) {
    return new Response(JSON.stringify({ error: "MIME-typ saknas." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawLength = Buffer.byteLength(audioBase64, "utf8");
  if (rawLength > MAX_AUDIO_BYTES * 1.5) {
    return new Response(JSON.stringify({ error: "Inspelningen är för stor." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let text: string;
  try {
    text = await transcribeGeminiAudio({
      apiKey,
      base64Audio: audioBase64.trim(),
      mimeType: mimeType.trim(),
    });
  } catch (err) {
    console.error("[api/stt] Gemini STT-fel:", err);
    return new Response(
      JSON.stringify({
        error:
          "Kunde inte tolka talet. Prova igen — eller skriv med tangentbordet.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  return Response.json({ text });
}
