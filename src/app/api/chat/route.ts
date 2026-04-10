import {
  google,
  type GoogleGenerativeAIProviderMetadata,
} from "@ai-sdk/google";
import { convertToModelMessages, streamText, stepCountIs } from "ai";
import { COLORING_SYSTEM_PROMPT } from "@/lib/coloring-system-prompt";
import { generateColoringPage, coloringToolSet } from "@/lib/coloring-tools";

export const dynamic = "force-dynamic";

const model = google("gemini-3.1-flash-lite-preview");

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("[api/chat] GOOGLE_GENERATIVE_AI_API_KEY saknas");
    return new Response(
      JSON.stringify({
        error: "Servern saknar konfigurerad Google API-nyckel.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { messages: unknown };
  try {
    body = (await req.json()) as { messages: unknown };
  } catch {
    return new Response(JSON.stringify({ error: "Ogiltig JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages } = body;
  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Meddelanden saknas." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const modelMessages = await convertToModelMessages(
      messages as Parameters<typeof convertToModelMessages>[0],
      { tools: coloringToolSet },
    );

    const result = streamText({
      model,
      system: COLORING_SYSTEM_PROMPT,
      messages: modelMessages,
      tools: { generateColoringPage },
      stopWhen: stepCountIs(6),
      providerOptions: {
        google: {
          safetySettings: [
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_ONLY_HIGH",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_ONLY_HIGH",
            },
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_ONLY_HIGH",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_ONLY_HIGH",
            },
          ],
        },
      },
      onFinish: async (event) => {
        const meta = event.providerMetadata?.google as
          | GoogleGenerativeAIProviderMetadata
          | undefined;
        if (meta?.promptFeedback?.blockReason) {
          console.warn(
            "[api/chat] promptFeedback.blockReason:",
            meta.promptFeedback.blockReason,
          );
        }
        console.info("[api/chat] totalUsage:", event.totalUsage);
      },
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error("[api/chat] streamfel:", error);
        return "Ett fel uppstod. Försök igen eller be en vuxen om hjälp.";
      },
    });
  } catch (err) {
    console.error("[api/chat]", err);
    return new Response(
      JSON.stringify({
        error: "Kunde inte starta chatten. Försök igen senare.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
