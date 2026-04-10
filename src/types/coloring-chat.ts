export type ColoringChatRole = "user" | "assistant";

export type ColoringChatMessage = {
  id: string;
  role: ColoringChatRole;
  content: string;
  imageSrc?: string;
  imageAlt?: string;
};
