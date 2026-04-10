import { google } from "@ai-sdk/google";
import { generateImage, tool, NoImageGeneratedError } from "ai";
import { z } from "zod";

const imagen = google.image("imagen-4.0-generate-001");

export const generateColoringPage = tool({
  description:
    "Genererar en ny barnvänlig målarbild (svartvit linjeteckning) när användarens önskemål är tillåtet.",
  inputSchema: z.object({
    englishImagePrompt: z
      .string()
      .describe(
        "Kort engelsk prompt för Imagen: bara konturer, tjocka linjer, enkla former, ingen text, ingen skuggning.",
      ),
    swedishAltText: z
      .string()
      .describe("Kort svensk alt-text till bilden för skärmläsare."),
  }),
  execute: async ({ englishImagePrompt, swedishAltText }) => {
    const safePrompt =
      "Black and white line art coloring page for young children, " +
      "very thick clean outlines, large simple areas to fill, no shading, no grayscale, " +
      "no text, no letters, no color, no photorealism: " +
      englishImagePrompt;

    try {
      const { images } = await generateImage({
        model: imagen,
        prompt: safePrompt,
        n: 1,
        aspectRatio: "1:1",
        providerOptions: {
          google: {
            personGeneration: "dont_allow",
          },
        },
      });

      const img = images[0];
      const base64 = img.base64;
      if (!base64) {
        throw new Error("Imagen returnerade ingen base64-data.");
      }

      return {
        imageSrc: `data:image/png;base64,${base64}` as const,
        imageAlt: swedishAltText,
      };
    } catch (err) {
      if (NoImageGeneratedError.isInstance(err)) {
        console.error("[generateColoringPage] Ingen bild:", err);
        throw new Error(
          "Bilden kunde inte skapas just nu. Be ett barn att fråga om något annat enkelt motiv.",
        );
      }
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
