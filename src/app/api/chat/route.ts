import {
  google,
  type GoogleGenerativeAIProviderMetadata,
} from "@ai-sdk/google";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type ModelMessage,
} from "ai";
import { COLORING_SYSTEM_PROMPT } from "@/lib/coloring-system-prompt";
import {
  generateColoringPage,
  coloringToolSet,
  setImageModel,
} from "@/lib/coloring-tools";

export const dynamic = "force-dynamic";

const chatModel = google("gemini-3.1-flash-lite-preview");

/**
 * Strips ALL image data from model messages to prevent exceeding token limits.
 * Deep-scans tool results for image-data content parts and large imageSrc strings.
 */
function stripImagesFromModelMessages(
  messages: ModelMessage[],
): ModelMessage[] {
  // Two-pass approach:
  // 1. JSON stringify/parse to deep-clone
  // 2. Walk tool messages and filter out image-data/media parts entirely
  const cloned = JSON.parse(JSON.stringify(messages)) as ModelMessage[];

  for (const msg of cloned) {
    if (msg.role === "user") {
      // Strip large image parts from user messages (uploaded images from history)
      if (Array.isArray(msg.content)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (msg as any).content = (msg.content as Array<unknown>).filter((part: unknown) => {
          const p = part as { type?: string; image?: unknown };
          if (p.type === "image") {
            const imgData = p.image;
            if (typeof imgData === "string" && imgData.length > 1000) return false;
          }
          return true;
        });
      }
      continue;
    }
    if (msg.role !== "tool") continue;
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue;
      const output = part.output as {
        type?: string;
        value?: unknown[];
      } | null;
      if (!output || output.type !== "content" || !Array.isArray(output.value))
        continue;
      // Filter out image-data, media, file-data parts (keep only text parts)
      output.value = output.value.filter(
        (v: unknown) => {
          const item = v as { type?: string; data?: string };
          if (
            item.type === "image-data" ||
            item.type === "media" ||
            item.type === "file-data"
          ) {
            return false;
          }
          return true;
        },
      );
    }
  }

  return cloned;
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
    const modelMessages = await convertToModelMessages(
      messages as Parameters<typeof convertToModelMessages>[0],
      { tools: coloringToolSet },
    );

    // Strip all image data AFTER conversion to model messages
    const cleanMessages = stripImagesFromModelMessages(modelMessages);

    // Log message sizes for debugging token issues
    const msgJson = JSON.stringify(cleanMessages);
    console.info(
      `[api/chat] messages: ${cleanMessages.length}, payload: ${(msgJson.length / 1024).toFixed(0)}KB, ~${(msgJson.length / 4 / 1000).toFixed(0)}K tokens`,
    );

    const result = streamText({
      model: chatModel,
      system: COLORING_SYSTEM_PROMPT,
      messages: cleanMessages,
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
      onStepFinish: (step) => {
        const u = step.usage;
        console.info(
          `[api/chat] step: ${u.inputTokens ?? 0}in + ${u.outputTokens ?? 0}out = ${u.totalTokens ?? 0}total | finish: ${step.finishReason}`,
        );
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
        const u = event.totalUsage;
        const steps = event.steps?.length ?? 0;
        console.info(
          `[api/chat] TOTAL: ${u.inputTokens ?? 0}in + ${u.outputTokens ?? 0}out = ${u.totalTokens ?? 0}total | steps: ${steps} | finish: ${event.finishReason}`,
        );
      },
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error("[api/chat] streamfel:", error);
        return "Ett fel uppstod. Försök igen.";
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
