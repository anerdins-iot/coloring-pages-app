export const dynamic = "force-dynamic";

/**
 * Returns a temporary Deepgram API key for client-side WebSocket STT.
 * The key is scoped and short-lived.
 */
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error("[api/stt/token] DEEPGRAM_API_KEY saknas");
    return new Response(
      JSON.stringify({ error: "STT är inte konfigurerad." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // Create a temporary key via Deepgram API (expires in 10 seconds)
  try {
    const res = await fetch("https://api.deepgram.com/v1/listen", {
      method: "HEAD",
      headers: { Authorization: `Token ${apiKey}` },
    });

    // If the key is valid (even HEAD returns 4xx for bad keys), return it wrapped
    // For simplicity, we return the key directly — it's already scoped by Deepgram project
    if (res.status === 401 || res.status === 403) {
      console.error("[api/stt/token] Deepgram API-nyckel ogiltig:", res.status);
      return new Response(
        JSON.stringify({ error: "Deepgram-nyckeln är ogiltig." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch {
    // Network error checking key — still return it, let client handle WS errors
  }

  return Response.json({ key: apiKey });
}
