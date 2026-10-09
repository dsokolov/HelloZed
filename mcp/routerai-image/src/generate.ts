import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROVIDER_URL = "https://routerai.ru/api/v1/images";
const DEFAULT_MODEL = "black-forest-labs/flux-3-image";
const REQUEST_TIMEOUT_MS = 120_000;
const BODY_SNIPPET_MAX = 240;

export type OutputFormat = "png" | "jpeg" | "webp";

export type GenerateImageOptions = {
  prompt: string;
  aspect_ratio?: string;
  size?: string;
  output_format?: OutputFormat;
};

export type GenerateImageResult = {
  bytes: Buffer;
  mimeType: string;
  cost?: number;
  model: string;
  usedSize?: string;
  usedAspectRatio?: string;
};

type ProviderImageItem = {
  b64_json?: unknown;
  media_type?: unknown;
};

type ProviderResponse = {
  data?: ProviderImageItem[];
  cost?: unknown;
  usage?: {
    cost?: unknown;
  };
  error?: unknown;
};

/**
 * Call RouterAI image generation and return decoded image bytes.
 * Does not rewrite `prompt`; does not write files.
 */
export async function generateImage(
  options: GenerateImageOptions,
): Promise<GenerateImageResult> {
  ensureApiKeyFromEnvFile();

  const apiKey = process.env.ROUTERAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("auth: missing ROUTERAI_API_KEY");
  }

  const model =
    process.env.ROUTERAI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
  const outputFormat: OutputFormat = options.output_format ?? "png";
  if (outputFormat !== "png") {
    throw new Error(
      `validation: ${model} does not support output_format; only PNG output is currently supported`,
    );
  }
  const mimeType = mimeTypeForFormat(outputFormat);

  // The FLUX.3 Images endpoint rejects `output_format`; it returns PNG by default.
  const body: Record<string, unknown> = {
    model,
    prompt: options.prompt,
    n: 1,
  };

  let usedSize: string | undefined;
  let usedAspectRatio: string | undefined;
  if (options.size) {
    body.size = options.size;
    usedSize = options.size;
  } else if (options.aspect_ratio) {
    body.aspect_ratio = options.aspect_ratio;
    usedAspectRatio = options.aspect_ratio;
  }

  let response: Response;
  try {
    response = await fetch(PROVIDER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw new Error("provider: request timed out");
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`provider: ${oneLine(message)}`);
  }

  const rawBody = await response.text();

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `auth: HTTP ${response.status} ${snippet(rawBody)}`.trimEnd(),
    );
  }

  if (!response.ok) {
    throw new Error(
      `provider: HTTP ${response.status} ${snippet(rawBody)}`.trimEnd(),
    );
  }

  let parsed: ProviderResponse;
  try {
    parsed = JSON.parse(rawBody) as ProviderResponse;
  } catch {
    throw new Error("provider: invalid JSON response");
  }

  const providerError = describeProviderError(parsed.error);
  if (providerError) {
    throw new Error(`provider: ${providerError}`);
  }

  const b64 = parsed.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64) {
    const topLevelKeys = Object.keys(parsed).join(",") || "none";
    const itemKeys = parsed.data?.[0]
      ? Object.keys(parsed.data[0]).join(",") || "none"
      : "none";
    throw new Error(
      `decode: missing data[0].b64_json (response keys: ${topLevelKeys}; data[0] keys: ${itemKeys})`,
    );
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64");
  } catch {
    throw new Error("decode: invalid base64 in data[0].b64_json");
  }
  if (bytes.length === 0) {
    throw new Error("decode: empty image bytes from data[0].b64_json");
  }

  const result: GenerateImageResult = {
    bytes,
    mimeType,
    model,
  };
  if (usedSize !== undefined) result.usedSize = usedSize;
  if (usedAspectRatio !== undefined) result.usedAspectRatio = usedAspectRatio;

  const cost = extractCost(parsed);
  if (cost !== undefined) result.cost = cost;

  return result;
}

function mimeTypeForFormat(format: OutputFormat): string {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
    default:
      return "image/png";
  }
}

/** Load project `.env` only when ROUTERAI_API_KEY is unset; process env wins. */
function ensureApiKeyFromEnvFile(): void {
  if (process.env.ROUTERAI_API_KEY?.trim()) return;

  const root = process.env.ROUTERAI_WORKSPACE_ROOT?.trim() || process.cwd();
  let text: string;
  try {
    text = readFileSync(join(root, ".env"), "utf8");
  } catch {
    return;
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function extractCost(parsed: ProviderResponse): number | undefined {
  const cost = parsed.usage?.cost ?? parsed.cost;
  if (typeof cost === "number" && Number.isFinite(cost)) {
    return cost;
  }
  return undefined;
}

function describeProviderError(error: unknown): string | undefined {
  if (typeof error === "string" && error) return oneLine(error).slice(0, BODY_SNIPPET_MAX);
  if (!error || typeof error !== "object") return undefined;

  const message = (error as { message?: unknown }).message;
  if (typeof message === "string" && message) {
    return oneLine(message).slice(0, BODY_SNIPPET_MAX);
  }

  return undefined;
}

function snippet(body: string): string {
  const s = oneLine(body).slice(0, BODY_SNIPPET_MAX);
  return s;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  return name === "AbortError" || name === "TimeoutError";
}
