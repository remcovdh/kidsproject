import OpenAI from "openai";
import type { ServerAiProvider, SpriteBuffers, SpriteFile } from "./index.js";

const POSE_PROMPTS: Record<Exclude<keyof SpriteBuffers, "collectible">, string> = {
  idle:      "standing still, relaxed, neutral upright pose, arms at sides",
  move:      "running or sliding sideways, dynamic movement, legs in mid-stride",
  action:    "jumping high with arms outstretched, exciting action pose",
  celebrate: "cheering with both arms raised in victory, mouth open in a big smile",
};

const provider: ServerAiProvider = {
  async generateSprites(description: string, drawingBase64: string): Promise<SpriteBuffers> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Analyze the drawing once to build a consistent character sheet
    let characterSheet = description;
    if (drawingBase64) {
      try {
        const analysis = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 150,
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: `A child drew this game character. Write a short CHARACTER SHEET: list the exact colors, body shape, face features, and any distinctive details (wings, hat, tail, etc.). Be specific so an illustrator could recreate it identically from your description. The child calls it: "${description}".`,
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${drawingBase64}`, detail: "low" },
              },
            ],
          }],
        });
        characterSheet = analysis.choices[0]?.message?.content ?? description;
      } catch (err) {
        console.warn("GPT-4o Vision analysis failed, using text description:", err);
      }
    }

    // Generate all 4 character poses + the collectible item in parallel.
    // The strong style-lock instruction keeps all poses looking like the same character.
    const poses = Object.entries(POSE_PROMPTS) as [Exclude<keyof SpriteBuffers, "collectible">, string][];

    const [poseEntries, collectibleFile] = await Promise.all([
      Promise.all(poses.map(async ([pose, posePrompt]) => {
        const response = await client.images.generate({
          model: "gpt-image-1",
          prompt:
            `2D video game character sprite. ` +
            `CHARACTER (keep IDENTICAL across all poses — same colors, proportions, face, and design): ${characterSheet}. ` +
            `POSE: ${posePrompt}. ` +
            `Childlike art style, bold outlines, bright colors, white background, centered, no text, square format.`,
          size: "1024x1024",
          quality: "medium",
          n: 1,
        });
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error(`No image data returned for pose: ${pose}`);
        return [pose, { data: Buffer.from(b64, "base64"), ext: "png" }] as const;
      })),

      (async (): Promise<SpriteFile> => {
        const response = await client.images.generate({
          model: "gpt-image-1",
          prompt:
            `A single small collectible item for a children's video game. ` +
            `It should be something that thematically matches this character: ${characterSheet}. ` +
            `Examples: a glowing gem, a golden star, a treat, a magical orb. ` +
            `Simple 2D, bright cheerful colors, white background, centered, no text.`,
          size: "1024x1024",
          quality: "medium",
          n: 1,
        });
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image data returned for collectible");
        return { data: Buffer.from(b64, "base64"), ext: "png" };
      })(),
    ]);

    return {
      ...Object.fromEntries(poseEntries),
      collectible: collectibleFile,
    } as unknown as SpriteBuffers;
  },

  async generateBackground(description: string, imageBase64?: string, styleDescription?: string): Promise<SpriteFile> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let sceneDescription = description;

    if (imageBase64) {
      try {
        const analysis = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 120,
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: `A child drew this and wants to use it as inspiration for a video game background. Describe the scene in 1-2 sentences for an illustrator — focus on setting, mood, and colors.${description ? ` The child also described it as: "${description}".` : ""}`,
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
              },
            ],
          }],
        });
        sceneDescription = analysis.choices[0]?.message?.content ?? description;
      } catch (err) {
        console.warn("GPT-4o Vision analysis for background failed:", err);
      }
    }

    const styleClause = styleDescription
      ? ` Art style should match this character: ${styleDescription}.`
      : "";

    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt:
        `A wide landscape background for a children's video game. Scene: ${sceneDescription}.${styleClause} ` +
        `Colorful, cheerful, childlike art style. No characters, no text, just the scenery. ` +
        `Flat 2D illustration style, vibrant colors, bold shapes.`,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned for background");
    return { data: Buffer.from(b64, "base64"), ext: "png" };
  },
};

export default provider;
