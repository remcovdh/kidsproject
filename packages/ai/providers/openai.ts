import type { AiProviderAdapter, SpritePackResult } from "../index.js";

// Stub — replace with real OpenAI image generation calls
const adapter: AiProviderAdapter = {
  async generateSprites(prompt: string, drawingBase64: string): Promise<SpritePackResult> {
    throw new Error("OpenAI provider not yet implemented");
  },
};

export default adapter;
