/**
 * Server-side in-memory bildregister.
 * Lagrar genererade bilder med kort ID så att:
 * 1. Historiken inte fylls med base64-data
 * 2. AI-agenten kan referera till vilken bild som helst via ID
 * 3. Base64 bara skickas till Gemini Image vid faktisk redigering
 */

type StoredImage = {
  id: string;
  base64: string;
  mediaType: string;
  alt: string;
  prompt: string;
  createdAt: number;
};

const store = new Map<string, StoredImage>();
let counter = 0;

const MAX_IMAGES = 20;
const MAX_AGE_MS = 60 * 60 * 1000; // 1 timme

function cleanup() {
  const now = Date.now();
  for (const [id, img] of store) {
    if (now - img.createdAt > MAX_AGE_MS) {
      store.delete(id);
    }
  }
  // Om fortfarande för många, ta bort äldsta
  if (store.size > MAX_IMAGES) {
    const sorted = [...store.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    );
    const toRemove = sorted.slice(0, store.size - MAX_IMAGES);
    for (const [id] of toRemove) {
      store.delete(id);
    }
  }
}

export function saveImage(
  base64: string,
  mediaType: string,
  alt: string,
  prompt: string,
): string {
  cleanup();
  counter += 1;
  const id = `img-${counter}`;
  store.set(id, { id, base64, mediaType, alt, prompt, createdAt: Date.now() });
  return id;
}

export function getImage(id: string): StoredImage | undefined {
  return store.get(id);
}

export function getImageBase64(id: string): string | undefined {
  return store.get(id)?.base64;
}

export function listImages(): Array<{
  id: string;
  alt: string;
  prompt: string;
}> {
  return [...store.values()].map((img) => ({
    id: img.id,
    alt: img.alt,
    prompt: img.prompt,
  }));
}
