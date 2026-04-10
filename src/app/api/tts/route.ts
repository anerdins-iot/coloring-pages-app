import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  GEMINI_TTS_SAMPLE_RATE,
  synthesizeGeminiTtsPcm,
} from "@/lib/gemini-tts";
import { pcm16MonoToWav } from "@/lib/pcm-to-wav";

export const dynamic = "force-dynamic";

const MAX_TEXT_LEN = 800;

function ttsCacheDir(): string {
  return path.join(process.cwd(), ".cache", "tts");
}

function cacheFilename(hash: string): string {
  return path.join(ttsCacheDir(), `${hash}.wav`);
}

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("[api/tts] GOOGLE_GENERATIVE_AI_API_KEY saknas");
    return new Response(
      JSON.stringify({ error: "TTS är inte konfigurerad på servern." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: "Ogiltig JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { text } = body;
  if (typeof text !== "string" || !text.trim()) {
    return new Response(JSON.stringify({ error: "Text saknas." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const trimmed = text.trim();
  if (trimmed.length > MAX_TEXT_LEN) {
    return new Response(JSON.stringify({ error: "Texten är för lång." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const voiceName = "Puck"; // Default child-friendly voice
  const hash = createHash("sha256")
    .update(`${voiceName}\0${trimmed}`, "utf8")
    .digest("hex");

  const filePath = cacheFilename(hash);

  try {
    const cached = await readFile(filePath);
    return new Response(new Uint8Array(cached), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    // saknas — generera
  }

  let pcm: Buffer;
  try {
    pcm = await synthesizeGeminiTtsPcm({
      apiKey,
      text: trimmed,
      voiceName,
    });
  } catch (err) {
    console.error("[api/tts] Gemini TTS-fel:", err);
    return new Response(
      JSON.stringify({ error: "Kunde inte skapa uppläsning just nu." }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const wav = pcm16MonoToWav(pcm, GEMINI_TTS_SAMPLE_RATE);

  try {
    await mkdir(ttsCacheDir(), { recursive: true });
    await writeFile(filePath, wav);
  } catch (err) {
    console.error("[api/tts] Kunde inte skriva cache:", err);
    /** Fortsätt utan cache — returnera ljudet ändå (inget tyst fel mot klient). */
  }

  return new Response(new Uint8Array(wav), {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
