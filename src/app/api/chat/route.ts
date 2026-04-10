import {
  google,
  type GoogleGenerativeAIProviderMetadata,
} from "@ai-sdk/google";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
} from "ai";
import { COLORING_SYSTEM_PROMPT } from "@/lib/coloring-system-prompt";
import {
  generateColoringPage,
  coloringToolSet,
  setImageModel,
} from "@/lib/coloring-tools";

export const dynamic = "force-dynamic";

const model = google("gemini-3.1-flash-lite-preview");

/**
 * Strips base64 image data (imageSrc) from ALL tool results in chat history.
 * Keeps imageId, imageAlt and other metadata intact so the AI agent can
 * reference images by ID without the actual pixel data bloating the context.
 * The actual base64 lives in the server-side image-store keyed by imageId.
 */
function stripImageDataFromHistory(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => {
    if (m.role !== "assistant") return m;

    const hasToolImage = m.parts.some((p) => {
      if (typeof p !== "object" || !("type" in p)) return false;
      const pType = (p as { type: string }).type;
      if (!pType.startsWith("tool-")) return false;
      const inv = p as { state?: string; output?: { imageSrc?: string } };
      return inv.state === "output-available" && inv.output?.imageSrc;
    });
    if (!hasToolImage) return m;

    const strippedParts = m.parts.map((p) => {
      if (typeof p !== "object" || !("type" in p)) return p;
      const pType = (p as { type: string }).type;
      if (!pType.startsWith("tool-")) return p;
      const inv = p as {
        type: string;
        state?: string;
        output?: {
          imageSrc?: string;
          imageAlt?: string;
          imageId?: string;
        };
      };
      if (inv.state === "output-available" && inv.output?.imageSrc) {
        return {
          ...inv,
          output: {
            imageId: inv.output.imageId,
            imageAlt: inv.output.imageAlt,
            imageSrc: "[bilddata hämtas via imageId från server]",
          },
        };
      }
      return p;
    });

    return { ...m, parts: strippedParts } as UIMessage;
  });
}

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

  let body: { messages: unknown; imageModel?: string };
  try {
    body = (await req.json()) as { messages: unknown; imageModel?: string };
  } catch {
    return new Response(JSON.stringify({ error: "Ogiltig JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, imageModel } = body;
  if (imageModel) {
    setImageModel(imageModel);
  }
  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Meddelanden saknas." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const cleanMessages = stripImageDataFromHistory(messages as UIMessage[]);
    const modelMessages = await convertToModelMessages(
      cleanMessages as Parameters<typeof convertToModelMessages>[0],
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
