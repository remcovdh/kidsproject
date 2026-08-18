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

export interface SpriteGenerationResult {
  sprites: SpriteBuffers;
  prompt: string; // the real prompt sent for the character sheet — shown back to the child
}

export interface BackgroundGenerationResult {
  file: SpriteFile;
  prompt: string; // the real prompt sent for the background image — shown back to the child
}

// Every generation produces two candidates for the child to choose between: "text" (generated
// purely from a written description of the drawing/photo) and "image" (image-to-image — edited
// directly from the child's own photo, which the pure-text path never actually sees). Which one
// looks more faithful/appealing is an open question, so both are offered and the choice is
// tallied in generation_choices rather than picked by us.
export interface SpriteGenerationChoice {
  text:  SpriteGenerationResult;
  image: SpriteGenerationResult;
}

export interface BackgroundGenerationChoice {
  text:  BackgroundGenerationResult;
  image: BackgroundGenerationResult;
}

export interface ServerAiProvider {
  generateSprites(description: string, drawingBase64: string, styleMode?: "shape" | "copy", artStyle?: string): Promise<SpriteGenerationChoice>;
  // imageBase64 is required — the world/background flow always starts from a teacher-captured
  // photo now, with description+style refining it, mirroring generateSprites' shape/copy pattern.
  generateBackground?(description: string, imageBase64: string, styleMode: "shape" | "copy", artStyle?: string): Promise<BackgroundGenerationChoice>;
}

export async function getServerProvider(providerName: string): Promise<ServerAiProvider> {
  switch (providerName) {
    case "openai": return (await import("./openai.js")).default;
    case "gemini": return (await import("./gemini.js")).default;
    case "local":  return (await import("./local.js")).default;
    default:       throw new Error(`Unknown AI provider: ${providerName}`);
  }
}
