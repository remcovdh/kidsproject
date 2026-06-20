import type { AiProvider } from "../shared/index.js";

export interface SpritePackResult {
  idle: string;    // base64 PNG
  move: string;
  action: string;
  celebrate: string;
}

export interface AiProviderAdapter {
  generateSprites(prompt: string, drawingBase64: string): Promise<SpritePackResult>;
}

export async function getProvider(provider: AiProvider): Promise<AiProviderAdapter> {
  switch (provider) {
    case "openai":
      return (await import("./providers/openai.js")).default;
    case "gemini":
      return (await import("./providers/gemini.js")).default;
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export function buildSpritePrompt(description: string, gameType: string): string {
  return (
    `Turn this child's drawing into a simple game character sprite pack. ` +
    `Keep the original childlike style and colors. ` +
    `The character is: ${description}. ` +
    `Create four transparent PNG poses: idle, movement, action, and happy celebration. ` +
    `Keep the character centered and consistent across all poses. ` +
    `Game type: ${gameType}.`
  );
}
