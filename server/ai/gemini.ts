import type { ServerAiProvider } from "./index.js";

// Gemini provider — not yet implemented.
// To add: install @google/generative-ai, use Gemini Vision for analysis
// and Imagen 3 for sprite generation via the Vertex AI SDK.
const provider: ServerAiProvider = {
  async generateSprites(_description: string, _drawingBase64: string) {
    throw new Error(
      "Gemini sprite generation is not yet implemented. " +
      "Set ai_provider='openai' or 'local' on your session."
    );
  },
};

export default provider;
