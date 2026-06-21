// Each sprite comes back with its raw data and the file extension to use when saving.
// PNG for real images (OpenAI DALL-E, Stable Diffusion), SVG for generated placeholders.
export interface SpriteFile {
  data: Buffer;
  ext:  "png" | "svg";
}

export interface SpriteBuffers {
  idle:      SpriteFile;
  move:      SpriteFile;
  action:    SpriteFile;
  celebrate: SpriteFile;
}

export interface ServerAiProvider {
  generateSprites(description: string, drawingBase64: string): Promise<SpriteBuffers>;
}

export async function getServerProvider(providerName: string): Promise<ServerAiProvider> {
  switch (providerName) {
    case "openai": return (await import("./openai.js")).default;
    case "gemini": return (await import("./gemini.js")).default;
    case "local":  return (await import("./local.js")).default;
    default:       throw new Error(`Unknown AI provider: ${providerName}`);
  }
}
