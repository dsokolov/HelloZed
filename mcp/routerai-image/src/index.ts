import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { toToolErrorResult } from "./errors.js";
import { generateImage } from "./generate.js";
import {
  assertCanWrite,
  atomicWriteFile,
  ensureParentDir,
  resolveSafePath,
  resolveWorkspaceRoot,
} from "./paths.js";

const server = new McpServer({
  name: "routerai-image",
  version: "0.1.0",
});

server.registerTool(
  "generate_image",
  {
    description:
      "Generate an image via RouterAI and write it under the workspace root.",
    inputSchema: {
      prompt: z.string().describe("Non-empty image generation prompt"),
      path: z
        .string()
        .describe("Relative path under workspace root for the image file"),
      aspect_ratio: z
        .string()
        .optional()
        .describe(
          'Aspect ratio hint (e.g. "16:9"). Ignored if size is also set.',
        ),
      size: z
        .string()
        .optional()
        .describe(
          "Explicit size for the provider; preferred over aspect_ratio when both are set",
        ),
      output_format: z
        .enum(["png", "jpeg", "webp"])
        .default("png")
        .describe("Output file / MIME format"),
      overwrite: z
        .boolean()
        .default(false)
        .describe("When false, refuse if the target file already exists"),
    },
  },
  async (args) => {
    try {
      if (typeof args.prompt !== "string" || args.prompt.trim() === "") {
        throw new Error("validation: prompt is required");
      }

      const outputFormat = args.output_format ?? "png";
      const overwrite = args.overwrite ?? false;

      const workspaceRoot = resolveWorkspaceRoot();
      const absolutePath = resolveSafePath(args.path, workspaceRoot);
      await assertCanWrite(absolutePath, overwrite);

      const result = await generateImage({
        prompt: args.prompt,
        aspect_ratio: args.aspect_ratio,
        size: args.size,
        output_format: outputFormat,
      });

      await ensureParentDir(absolutePath);
      await atomicWriteFile(absolutePath, result.bytes);

      const relativePath = path
        .relative(workspaceRoot, absolutePath)
        .split(path.sep)
        .join("/");

      const summary: Record<string, unknown> = {
        path: relativePath,
        absolutePath,
        bytes: result.bytes.length,
        mimeType: result.mimeType,
        model: result.model,
      };
      if (result.usedSize !== undefined) {
        summary.size = result.usedSize;
      } else if (result.usedAspectRatio !== undefined) {
        summary.aspect_ratio = result.usedAspectRatio;
      }
      if (result.cost !== undefined) {
        summary.cost = result.cost;
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(summary) },
          {
            type: "image" as const,
            data: result.bytes.toString("base64"),
            mimeType: result.mimeType,
          },
        ],
      };
    } catch (err: unknown) {
      return toToolErrorResult(err);
    }
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("routerai-image MCP server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error starting routerai-image MCP server:", error);
  process.exit(1);
});
