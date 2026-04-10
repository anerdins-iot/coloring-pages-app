import {
  DefaultChatTransport,
  type UIMessage,
  type UIMessageChunk,
  type ChatRequestOptions,
} from "ai";

/**
 * Chat transport that strips base64 image data from OLDER messages
 * before sending to the server. The LAST user message keeps its files
 * intact so the model can see newly uploaded images.
 */
export function createStrippedTransport(options: {
  api: string;
  body?: Record<string, unknown>;
}) {
  const inner = new DefaultChatTransport(options);

  function stripMessages(messages: UIMessage[]): UIMessage[] {
    // Find the last user message index — keep its files intact
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }

    return messages.map((m, idx) => ({
      ...m,
      parts: m.parts.map((p) => {
        if (typeof p !== "object" || !("type" in p)) return p;
        const pType = (p as { type: string }).type;

        // Keep file parts in the last user message (newly uploaded image)
        if (pType === "file" && idx !== lastUserIdx) {
          const filePart = p as {
            type: string;
            url?: string;
            mediaType?: string;
          };
          if (filePart.url && filePart.url.length > 1000) {
            return { ...p, url: "[stripped]" };
          }
          return p;
        }

        if (!pType.startsWith("tool-")) return p;
        const inv = p as {
          state?: string;
          output?: Record<string, unknown>;
        };
        if (
          inv.state === "output-available" &&
          inv.output &&
          typeof inv.output.imageSrc === "string" &&
          (inv.output.imageSrc as string).length > 1000
        ) {
          const { imageSrc: _, ...rest } = inv.output;
          return { ...p, output: rest } as typeof p;
        }
        return p;
      }),
    })) as UIMessage[];
  }

  return {
    sendMessages(
      args: {
        trigger: "submit-message" | "regenerate-message";
        chatId: string;
        messageId: string | undefined;
        messages: UIMessage[];
        abortSignal: AbortSignal | undefined;
      } & ChatRequestOptions,
    ): Promise<ReadableStream<UIMessageChunk>> {
      return inner.sendMessages({
        ...args,
        messages: stripMessages(args.messages),
      });
    },
    reconnectToStream(
      args: Parameters<typeof inner.reconnectToStream>[0],
    ) {
      return inner.reconnectToStream(args);
    },
  };
}
