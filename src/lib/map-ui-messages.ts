import type { UIMessage } from "ai";
import type { ColoringChatMessage } from "@/types/coloring-chat";

function partsText(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function toolImageFromParts(parts: UIMessage["parts"]): {
  imageSrc: string;
  imageAlt: string;
} | null {
  for (const p of parts) {
    if (p.type !== "tool-generateColoringPage") continue;
    const inv = p as {
      type: string;
      state: string;
      output?: { imageSrc: string; imageAlt: string };
    };
    if (inv.state === "output-available" && inv.output?.imageSrc) {
      return {
        imageSrc: inv.output.imageSrc,
        imageAlt: inv.output.imageAlt,
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
        content: content || (toolImage ? "Här är en målarbild du kan använda!" : ""),
        imageSrc: toolImage?.imageSrc,
        imageAlt: toolImage?.imageAlt,
      });
    }
  }

  return out;
}
