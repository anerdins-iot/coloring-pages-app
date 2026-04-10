import type { UIMessage } from "ai";
import type { ColoringChatMessage } from "@/types/coloring-chat";

function partsText(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function toolImageFromParts(parts: UIMessage["parts"]): {
  imageId?: string;
  imageSrc: string;
  imageAlt: string;
  modelUsed?: string;
  estimatedCost?: number;
} | null {
  for (const p of parts) {
    if (p.type !== "tool-generateColoringPage") continue;
    const inv = p as {
      type: string;
      state: string;
      output?: {
        imageId?: string;
        imageSrc: string;
        imageAlt: string;
        modelUsed?: string;
        estimatedCost?: number;
      };
    };
    if (inv.state === "output-available" && inv.output?.imageSrc) {
      return {
        imageId: inv.output.imageId,
        imageSrc: inv.output.imageSrc,
        imageAlt: inv.output.imageAlt,
        modelUsed: inv.output.modelUsed,
        estimatedCost: inv.output.estimatedCost,
      };
    }
  }
  return null;
}

/**
 * Mappar AI SDK UIMessage-listan till befintliga ColoringChatMessage för UI-komponenter.
 */
export function mapUiMessagesToColoringMessages(
  messages: UIMessage[],
): ColoringChatMessage[] {
  const out: ColoringChatMessage[] = [];

  for (const m of messages) {
    if (m.role === "user") {
      out.push({
        id: m.id,
        role: "user",
        content: partsText(m.parts),
      });
      continue;
    }

    if (m.role === "assistant") {
      const content = partsText(m.parts);
      const toolImage = toolImageFromParts(m.parts);
      out.push({
        id: m.id,
        role: "assistant",
        content:
          content ||
          (toolImage ? "Här är en målarbild du kan använda!" : ""),
        imageId: toolImage?.imageId,
        imageSrc: toolImage?.imageSrc,
        imageAlt: toolImage?.imageAlt,
        modelUsed: toolImage?.modelUsed,
        estimatedCost: toolImage?.estimatedCost,
      });
    }
  }

  return out;
}
