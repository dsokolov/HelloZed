---
name: generate-image
description: Draw, generate, or create an image (нарисуй / сгенерируй / создай изображение) and save it in the project via MCP server routerai-image tool generate_image. Use when the user asks for a picture, illustration, icon, or similar visual and wants a file written under the workspace.
---

# Generate image (routerai-image)

## When to use

Use this skill when the user asks to draw, generate, or create an image and save it in the project. Call MCP server **`routerai-image`**, tool **`generate_image`**. Do not invent another MCP server or tool.

## Tool parameters

| Param | Required | Notes |
|-------|----------|--------|
| `prompt` | yes | Non-empty generation prompt |
| `path` | yes | Relative path under workspace root |
| `aspect_ratio` | no | e.g. `"16:9"`, `"2:3"`, `"1:1"` |
| `size` | no | Explicit size; if both `size` and `aspect_ratio` are set, **prefer `size`** |
| `output_format` | no | `"png"` (default), `"jpeg"`, or `"webp"` |
| `overwrite` | no | Default `false` |

Always one image per request (`n=1` is fixed by the server). Do not pass model or API keys as tool args.

## Prompt

Compose a detailed `prompt` yourself. Prefer English for the image model; keep the user’s subject, style, and constraints. Expand briefly (composition, lighting, mood) without changing intent.

## Filename (`path`)

- If the user names a file/path, use it (relative to workspace).
- Otherwise pick a short ASCII name plus extension matching `output_format` (e.g. `hero-sunset.png`).
- Path must stay under the workspace; no `..` escapes.

## Size / aspect ratio

Heuristics when the user does not specify dimensions:

- Portrait / person → `2:3` or `9:16`
- Wide scene / landscape → `16:9`
- Icon / logo / square → `1:1`

Pass `aspect_ratio` unless the user gives an explicit `size`.

## Overwrite

Leave `overwrite` false (or omit). Set `overwrite: true` only when the user asks to replace an existing file.

## Errors

On failure, the tool returns a one-line message with a stage prefix: `validation:`, `auth:`, `provider:`, `decode:`, or `fs:` (e.g. `fs:exists`).

- Fix **that** stage once (bad args → correct args; existing file → new path or ask to overwrite).
- Do not invent another MCP, endpoint, or workaround.
- Do not include API keys or paste full RouterAI documentation in chat or tool calls.
