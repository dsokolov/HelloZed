# HelloZed

Project-scoped **RouterAI image generation** for [Zed](https://zed.dev): a local MCP server (`routerai-image`) plus an agent skill (`generate-image`). Scoped to this workspace — not a global Zed install.

| Piece | Location |
|-------|----------|
| MCP server | `mcp/routerai-image` |
| Agent skill | `.agents/skills/generate-image` |
| Zed context server config | `.zed/settings.example.json` → `.zed/settings.json` |
| Optional env | `.env.example` → `.env` |

Tool contract: [`mcp/routerai-image/contracts.md`](mcp/routerai-image/contracts.md).

## Setup (this project)

1. **Build the MCP server**

   ```bash
   cd mcp/routerai-image
   npm install
   npm run build
   ```

2. **Configure Zed** — copy the example and set your key (file is gitignored):

   ```bash
   cp .zed/settings.example.json .zed/settings.json
   ```

   In `.zed/settings.json`, replace `<set-locally>` with your RouterAI API key:

   ```json
   "ROUTERAI_API_KEY": "your-key-here"
   ```

   And/or copy `.env.example` → `.env` and set `ROUTERAI_API_KEY=` there (also gitignored). Prefer not committing either file.

   **Warning:** Do not leave the literal `<set-locally>` placeholder in place — a non-empty placeholder bypasses the “missing key” check and you’ll get auth/provider HTTP errors. Replace it with a real key, or use an empty value and set the key via `.env`.

3. **Trust this project** in Zed so local skills under `.agents/skills/` can load.

4. **Verify** — open Zed’s MCP / context servers UI and confirm **`routerai-image`** is green (running). Reload the window if you just built or changed settings. Optionally: `cd mcp/routerai-image && npm run smoke` (needs a real `ROUTERAI_API_KEY`).

## Copy into another project

Copy these, then rebuild or reuse `dist`, add gitignore entries, and set a local key:

- `.agents/skills/generate-image/` (entire folder)
- `mcp/routerai-image/` (including `dist/` after `npm run build`, or rebuild in the target repo)
- `.zed/settings.example.json`
- `.zed/README.md`
- `.env.example`
- `.gitignore` entries: `.env`, `.zed/settings.json` (and usually `node_modules/`)

In the target project: `npm install && npm run build` under `mcp/routerai-image`, create `.zed/settings.json` from the example (or `.env`), trust the project, confirm MCP is green.

## Windows

Relative MCP `args` (e.g. `mcp/routerai-image/dist/index.js`) and `ROUTERAI_WORKSPACE_ROOT: "."` resolve against Zed’s launch cwd (usually the workspace root). `node` must be on `PATH`. Prefer forward slashes in JSON args.

Details: [`.zed/README.md`](.zed/README.md) and [`mcp/routerai-image/contracts.md`](mcp/routerai-image/contracts.md) §3.

## Example prompts (Russian)

Ask the agent in natural language; the skill routes to `generate_image`:

- Нарисуй иконку приложения: минималистичный логотип буквы H, сохрани в `assets/icon-h.png`.
- Сгенерируй обложку 16:9 для лендинга — закат над городом, файл `docs/hero.png`.
- Создай изображение персонажа в стиле pixel art, путь `sprites/hero.webp`, формат webp.

Do not put real API keys in prompts, settings examples, or commits — use placeholders and local-only files.
