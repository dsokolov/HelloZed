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
/**
 * Call RouterAI image generation and return decoded image bytes.
 * Does not rewrite `prompt`; does not write files.
 */
export declare function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult>;
