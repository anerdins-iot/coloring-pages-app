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
  // Deep JSON scan: remove any imageSrc data-URLs and image-data parts
  const json = JSON.stringify(messages, (key, value) => {
    // Remove imageSrc fields that contain data URLs
    if (key === "imageSrc" && typeof value === "string" && value.length > 500) {
      return undefined;
    }
    // Remove image-data/media/file-data parts from content arrays
    if (key === "data" && typeof value === "string" && value.length > 10000) {
      return undefined;
    }
    return value;
  });
  return JSON.parse(json) as ModelMessage[];
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
          `[api/chat] step(${step.stepType}): ${u.inputTokens ?? 0}in + ${u.outputTokens ?? 0}out = ${u.totalTokens ?? 0}total | finish: ${step.finishReason}`,
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
