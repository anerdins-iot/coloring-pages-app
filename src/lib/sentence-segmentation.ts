/**
 * Delar upp löptext i meningar för sekventiell TTS medan strömning pågår.
 * Kompletta meningar avslutas med . ! eller ?
 */
export function segmentCompleteSentences(
  text: string,
  streamComplete: boolean,
): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const out: string[] = [];
  let buf = "";

  for (const ch of normalized) {
    buf += ch;
    if (ch === "." || ch === "!" || ch === "?") {
      const s = buf.trim();
      if (s.length > 0) out.push(s);
      buf = "";
    }
  }

  const tail = buf.trim();
  if (tail && streamComplete) {
    out.push(tail);
  }

  return out;
}
