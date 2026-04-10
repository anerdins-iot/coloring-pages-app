import { google } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { z } from "zod";

export const generateColoringPage = tool({
  description:
    "Genererar eller redigerar en barnvänlig målarbild (svartvit linjeteckning) när användarens önskemål är tillåtet.",
  inputSchema: z.object({
    englishImagePrompt: z
      .string()
      .describe(
        "Kort engelsk prompt för bilden: bara konturer, tjocka linjer, enkla former, ingen text, ingen skuggning.",
      ),
    swedishAltText: z
      .string()
      .describe("Kort svensk alt-text till bilden för skärmläsare."),
    referenceImageBase64: z
      .string()
      .optional()
      .describe(
        "Base64-data (eller data URL) för en tidigare genererad bild som ska redigeras. Hämta värdet från imageSrc i det senaste tool-resultatet.",
      ),
    editInstruction: z
      .string()
      .optional()
      .describe(
        "Kort engelsk beskrivning av vad som ska ändras i referensbilden, t.ex. 'make the lines thicker' eller 'add a crown'.",
      ),
  }),
  execute: async ({
    englishImagePrompt,
    swedishAltText,
    referenceImageBase64,
    editInstruction,
  }) => {
    const safePrompt =
      "Black and white line art coloring page for young children, " +
      "very thick clean outlines, large simple areas to fill, no shading, no grayscale, " +
      "no text, no letters, no color, no photorealism: " +
      englishImagePrompt;

    const model = google("gemini-3.1-flash-image-preview");
    const providerOptions = {
      google: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    };

    try {
      let result;

      if (referenceImageBase64) {
        // Strip data URL prefix if present (e.g. "data:image/png;base64,")
        const base64Data = referenceImageBase64.includes(",")
          ? referenceImageBase64.split(",")[1]
          : referenceImageBase64;

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
                  image: Buffer.from(base64Data, "base64"),
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

      return {
        imageSrc: `data:${imageFile.mediaType};base64,${imageFile.base64}`,
        imageAlt: swedishAltText,
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
