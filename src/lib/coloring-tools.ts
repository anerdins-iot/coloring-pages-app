import { google } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { z } from "zod";
import { saveImage, getImage } from "@/lib/image-store";

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
    referenceImageId: z
      .string()
      .optional()
      .describe(
        "ID för en tidigare genererad bild att redigera (t.ex. 'img-1'). Hämta från imageId i ett tidigare tool-resultat. Skicka BARA vid redigering.",
      ),
    editInstruction: z
      .string()
      .optional()
      .describe(
        "Kort engelsk beskrivning av vad som ska ändras, t.ex. 'make the lines thicker' eller 'add a crown'. Krävs tillsammans med referenceImageId.",
      ),
  }),
  // Let the chat model SEE the generated image so it can comment on it
  toModelOutput({ output }: { toolCallId: string; input: unknown; output: { imageId: string; imageSrc: string; imageAlt: string } }) {
    const base64 = output.imageSrc.includes(",")
      ? output.imageSrc.split(",")[1]
      : output.imageSrc;
    const mediaType = output.imageSrc.startsWith("data:")
      ? output.imageSrc.slice(5, output.imageSrc.indexOf(";"))
      : "image/png";
    return {
      type: "content" as const,
      value: [
        {
          type: "text" as const,
          text: JSON.stringify({
            imageId: output.imageId,
            imageAlt: output.imageAlt,
          }),
        },
        {
          type: "image-data" as const,
          data: base64,
          mediaType,
        },
      ],
    };
  },
  execute: async ({
    englishImagePrompt,
    swedishAltText,
    referenceImageId,
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

      // Spara i server-side registret
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
