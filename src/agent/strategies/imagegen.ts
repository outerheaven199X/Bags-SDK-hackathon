/** Image generation client for token logos via fal.ai or Replicate. */

const FAL_API_BASE = "https://fal.run/fal-ai/nano-banana-pro";
const REPLICATE_API_BASE = "https://api.replicate.com/v1/predictions";
const REPLICATE_DEFAULT_MODEL = "google/gemini-flash-1.5";
const REPLICATE_POLL_INTERVAL_MS = 2_000;
const REPLICATE_MAX_POLLS = 30;

type ImageProvider = "fal" | "replicate";

interface ImageGenConfig {
  provider: ImageProvider;
  apiKey: string;
}

interface ImageGenResult {
  url: string;
  provider: ImageProvider;
}

/**
 * Resolve which image generation provider and key to use from environment.
 * @returns Config if a provider is available, null otherwise.
 */
export function resolveImageConfig(): ImageGenConfig | null {
  const provider = (process.env.IMAGE_GEN_PROVIDER ?? "fal") as ImageProvider;

  if (provider === "fal" && process.env.FAL_API_KEY) {
    return { provider: "fal", apiKey: process.env.FAL_API_KEY };
  }
  if (provider === "replicate" && process.env.REPLICATE_API_KEY) {
    return { provider: "replicate", apiKey: process.env.REPLICATE_API_KEY };
  }

  if (process.env.FAL_API_KEY) {
    return { provider: "fal", apiKey: process.env.FAL_API_KEY };
  }
  if (process.env.REPLICATE_API_KEY) {
    return { provider: "replicate", apiKey: process.env.REPLICATE_API_KEY };
  }

  return null;
}

/**
 * Generate a token logo image from a text prompt.
 * Returns null if generation fails or no API key is configured.
 * @param prompt - Descriptive prompt for the image.
 * @param config - Provider and API key to use.
 * @returns Image URL and provider, or null on failure.
 */
export async function generateTokenImage(
  prompt: string,
  config: ImageGenConfig,
): Promise<ImageGenResult | null> {
  try {
    if (config.provider === "fal") {
      return await generateViaFal(prompt, config.apiKey);
    }
    return await generateViaReplicate(prompt, config.apiKey);
  } catch (err) {
    console.error(`[imagegen] Generation failed (${config.provider}): ${err}`);
    return null;
  }
}

/**
 * Generate an image using fal.ai's Nano Banana 2 Pro (Gemini) model.
 * @param prompt - Image generation prompt.
 * @param apiKey - fal.ai API key.
 * @returns Generated image URL.
 */
async function generateViaFal(prompt: string, apiKey: string): Promise<ImageGenResult> {
  const res = await fetch(FAL_API_BASE, {
    method: "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: "1:1",
      num_images: 1,
      output_format: "png",
      resolution: "1K",
    }),
  });

  if (!res.ok) {
    throw new Error(`fal.ai error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { images: Array<{ url: string }> };
  if (!data.images?.[0]?.url) {
    throw new Error("fal.ai returned no images");
  }

  return { url: data.images[0].url, provider: "fal" };
}

/**
 * Generate an image using Replicate's prediction API with polling.
 * @param prompt - Image generation prompt.
 * @param apiKey - Replicate API token.
 * @returns Generated image URL.
 */
async function generateViaReplicate(prompt: string, apiKey: string): Promise<ImageGenResult> {
  const createRes = await fetch(REPLICATE_API_BASE, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: REPLICATE_DEFAULT_MODEL,
      input: { prompt },
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Replicate create error: ${createRes.status} ${createRes.statusText}`);
  }

  const prediction = await createRes.json() as {
    id: string;
    status: string;
    urls: { get: string };
    output?: string[];
  };

  const pollUrl = prediction.urls?.get;
  if (!pollUrl) {
    throw new Error("Replicate returned no polling URL");
  }

  return await pollReplicatePrediction(pollUrl, apiKey);
}

/**
 * Poll a Replicate prediction until it completes or fails.
 * @param url - The prediction GET URL to poll.
 * @param apiKey - Replicate API token.
 * @returns Generated image URL.
 */
async function pollReplicatePrediction(url: string, apiKey: string): Promise<ImageGenResult> {
  for (let i = 0; i < REPLICATE_MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, REPLICATE_POLL_INTERVAL_MS));

    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`Replicate poll error: ${res.status}`);
    }

    const data = await res.json() as {
      status: string;
      output?: string[];
      error?: string;
    };

    if (data.status === "succeeded" && data.output?.[0]) {
      return { url: data.output[0], provider: "replicate" };
    }
    if (data.status === "failed") {
      throw new Error(`Replicate prediction failed: ${data.error ?? "unknown"}`);
    }
    if (data.status === "canceled") {
      throw new Error("Replicate prediction was canceled");
    }
  }

  throw new Error("Replicate prediction timed out after polling");
}
