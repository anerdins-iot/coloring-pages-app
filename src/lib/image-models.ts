/**
 * Tillgängliga bildgenereringsmodeller med prissättning.
 * Priserna är ungefärliga baserade på Google's officiella pricing (april 2026).
 */

export type ImageModelId =
  | "gemini-2.5-flash-image"
  | "gemini-3.1-flash-image-preview"
  | "gemini-3-pro-image-preview";

export type ImageModelConfig = {
  id: ImageModelId;
  label: string;
  description: string;
  costPerImage: number; // USD, approximate for 1K resolution
  quality: "standard" | "high" | "ultra";
};

export const IMAGE_MODELS: ImageModelConfig[] = [
  {
    id: "gemini-2.5-flash-image",
    label: "Flash 2.5",
    description: "Snabbast & billigast",
    costPerImage: 0.039,
    quality: "standard",
  },
  {
    id: "gemini-3.1-flash-image-preview",
    label: "Flash 3.1",
    description: "Bäst balans",
    costPerImage: 0.067,
    quality: "high",
  },
  {
    id: "gemini-3-pro-image-preview",
    label: "Pro 3",
    description: "Högst kvalitet",
    costPerImage: 0.134,
    quality: "ultra",
  },
];

export const DEFAULT_IMAGE_MODEL: ImageModelId = "gemini-2.5-flash-image";

export function getModelConfig(
  id: ImageModelId,
): ImageModelConfig | undefined {
  return IMAGE_MODELS.find((m) => m.id === id);
}

export function isValidImageModel(id: string): id is ImageModelId {
  return IMAGE_MODELS.some((m) => m.id === id);
}
