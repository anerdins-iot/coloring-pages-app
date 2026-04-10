export type ColoringChatRole = "user" | "assistant";

export type ColoringChatMessage = {
  id: string;
  role: ColoringChatRole;
  content: string;
  /** Server-side bild-ID (t.ex. "img-1") för referens vid redigering */
  imageId?: string;
  imageSrc?: string;
  imageAlt?: string;
  /** Vilken modell som genererade bilden */
  modelUsed?: string;
  /** Uppskattad kostnad i USD */
  estimatedCost?: number;
};
