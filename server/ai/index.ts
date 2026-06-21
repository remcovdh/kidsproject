export interface SpriteBuffers {
  idle:      Buffer;
  move:      Buffer;
  action:    Buffer;
  celebrate: Buffer;
}

export interface ServerAiProvider {
  generateSprites(description: string, drawingBase64: string): Promise<SpriteBuffers>;
}

export async function getServerProvider(providerName: string): Promise<ServerAiProvider> {
  switch (providerName) {
    case "openai": return (await import("./openai.js")).default;
    case "gemini": return (await import("./gemini.js")).default;
    default:       throw new Error(`Unknown AI provider: ${providerName}`);
  }
}
