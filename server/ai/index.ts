export interface SpriteFile {
  data: Buffer;
  ext:  "png" | "svg";
}

export interface SpriteBuffers {
  idle:        SpriteFile;
  move:        SpriteFile;       // running pose, facing/moving right
  moveLeft?:   SpriteFile;       // running pose, facing/moving left — optional; providers that
                                  // don't generate it fall back to mirroring `move` client-side
  celebrate:   SpriteFile;
  collectible: SpriteFile; // the item that falls in the catcher game
}

export interface ServerAiProvider {
  generateSprites(description: string, drawingBase64: string, styleMode?: "shape" | "copy", artStyle?: string): Promise<SpriteBuffers>;
  // imageBase64 is required — the world/background flow always starts from a teacher-captured
  // photo now, with description+style refining it, mirroring generateSprites' shape/copy pattern.
  generateBackground?(description: string, imageBase64: string, styleMode: "shape" | "copy", artStyle?: string): Promise<SpriteFile>;
}

export async function getServerProvider(providerName: string): Promise<ServerAiProvider> {
  switch (providerName) {
    case "openai": return (await import("./openai.js")).default;
    case "gemini": return (await import("./gemini.js")).default;
    case "local":  return (await import("./local.js")).default;
    default:       throw new Error(`Unknown AI provider: ${providerName}`);
  }
}
