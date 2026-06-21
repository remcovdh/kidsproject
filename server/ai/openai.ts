import OpenAI from "openai";
import type { ServerAiProvider, SpriteBuffers } from "./index.js";

const POSES: Record<keyof SpriteBuffers, string> = {
  idle:      "standing still, relaxed, neutral upright pose",
  move:      "running or sliding sideways, dynamic movement pose",
  action:    "jumping or attacking, exciting action pose",
  celebrate: "cheering with arms raised, happy celebration pose",
};

const provider: ServerAiProvider = {
  async generateSprites(description: string, drawingBase64: string): Promise<SpriteBuffers> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Analyze the drawing with GPT-4o Vision to get a richer character description
    let characterDesc = description;
    if (drawingBase64) {
      try {
        const analysis = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 120,
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: `A child drew this game character. Describe it in 2 sentences — focus on colors, shape, and distinctive features. The child calls it: "${description}".`,
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${drawingBase64}`, detail: "low" },
              },
            ],
          }],
        });
        characterDesc = analysis.choices[0]?.message?.content ?? description;
      } catch (err) {
        console.warn("GPT-4o Vision analysis failed, using text description:", err);
      }
    }

    // Generate all 4 poses in parallel with gpt-image-1 (returns base64 directly)
    const entries = await Promise.all(
      (Object.entries(POSES) as [keyof SpriteBuffers, string][]).map(
        async ([pose, posePrompt]) => {
          const response = await client.images.generate({
            model: "gpt-image-1",
            prompt:
              `Simple 2D video game character sprite. ${characterDesc}. ` +
              `Pose: ${posePrompt}. ` +
              `Childlike art style, bold outlines, bright colors, white background, centered, no text, square crop.`,
            size: "1024x1024",
            quality: "medium",
            n: 1,
          });
          const b64 = response.data?.[0]?.b64_json;
          if (!b64) throw new Error(`No image data returned for pose: ${pose}`);
          return [pose, { data: Buffer.from(b64, "base64"), ext: "png" }] as const;
        }
      )
    );

    return Object.fromEntries(entries) as unknown as SpriteBuffers;
  },
};

export default provider;
