import { google } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { z } from "zod";
import { saveImage, getImage } from "@/lib/image-store";
import {
  DEFAULT_IMAGE_MODEL,
  isValidImageModel,
  getModelConfig,
  type ImageModelId,
} from "@/lib/image-models";

// Server-side request-scoped model selection
let currentImageModel: ImageModelId = DEFAULT_IMAGE_MODEL;

export function setImageModel(modelId: string) {
  if (isValidImageModel(modelId)) {
    currentImageModel = modelId;
  }
}

export const generateColoringPage = tool({
  description:
    "Genererar eller redigerar en målarbild (svartvit linjeteckning).",
  inputSchema: z.object({
    englishImagePrompt: z
      .string()
      .describe(
        "Engelsk prompt för bilden. Anpassa detaljeringsgrad efter användarens önskemål.",
      ),
    swedishAltText: z
      .string()
      .describe("Kort svensk alt-text till bilden för skärmläsare."),
    referenceImageId: z
      .string()
      .optional()
      .describe(
        "ID för en tidigare genererad bild att redigera (t.ex. 'img-1'). Skicka BARA vid redigering.",
      ),
    editInstruction: z
      .string()
      .optional()
      .describe(
        "Kort engelsk beskrivning av ändringen. Krävs tillsammans med referenceImageId.",
      ),
  }),
  // Convert tool output to model-friendly format WITHOUT image data.
  // Only send small metadata to the model. The full imageSrc data-URL
  // is kept in the raw output for the client UI.
  toModelOutput({
    output,
  }: {
    toolCallId: string;
    input: unknown;
    output: {
      imageId: string;
      imageSrc: string;
      imageAlt: string;
      modelUsed: string;
      estimatedCost: number;
    };
  }) {
    return {
      type: "text" as const,
      value: JSON.stringify({
        imageId: output.imageId,
        imageAlt: output.imageAlt,
        modelUsed: output.modelUsed,
        estimatedCost: output.estimatedCost,
        status: "image_generated",
      }),
    };
  },
  execute: async ({
    englishImagePrompt,
    swedishAltText,
    referenceImageId,
    editInstruction,
  }) => {
    const safePrompt =
      "Black and white line art coloring page in portrait orientation (3:4 aspect ratio like A4 paper), " +
      "clean outlines, no shading, no grayscale, no filled areas, " +
      "no text, no letters, no color, no photorealism: " +
      englishImagePrompt;

    const modelId = currentImageModel;
    const model = google(modelId);
    const modelConfig = getModelConfig(modelId);
    const providerOptions = {
      google: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    };

    try {
      let result;

      if (referenceImageId) {
        const storedImage = getImage(referenceImageId);
        if (!storedImage) {
          throw new Error(
            `Bilden "${referenceImageId}" hittades inte. Den kan ha rensats. Be användaren generera en ny bild.`,
          );
        }

        const instruction = editInstruction
          ? `${editInstruction}. Maintain the black and white line art coloring page style.`
          : "Modify this coloring page while keeping the black and white line art style.";

        result = await generateText({
          model,
          providerOptions,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: instruction + " " + safePrompt },
                {
                  type: "image",
                  image: Buffer.from(storedImage.base64, "base64"),
                },
              ],
            },
          ],
        });
      } else {
        result = await generateText({
          model,
          providerOptions,
          prompt: safePrompt,
        });
      }

      const imageFile = result.files?.find((f) =>
        f.mediaType?.startsWith("image/"),
      );

      if (!imageFile) {
        throw new Error("Modellen returnerade ingen bild.");
      }

      const base64 = imageFile.base64;
      if (!base64) {
        throw new Error("Modellen returnerade en bild utan data.");
      }

      const imageId = saveImage(
        base64,
        imageFile.mediaType,
        swedishAltText,
        englishImagePrompt,
      );

      return {
        imageId,
        imageSrc: `data:${imageFile.mediaType};base64,${base64}`,
        imageAlt: swedishAltText,
        modelUsed: modelId,
        estimatedCost: modelConfig?.costPerImage ?? 0,
      };
    } catch (err) {
      console.error("[generateColoringPage]", err);
      throw new Error(
        "Något gick fel när målarbilden skulle skapas. Försök igen om en stund.",
      );
    }
  },
});

export const coloringToolSet = {
  generateColoringPage,
} as const;
