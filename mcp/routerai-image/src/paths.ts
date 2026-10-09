import { randomBytes } from "node:crypto";
import { stat, mkdir, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Resolve the workspace root from ROUTERAI_WORKSPACE_ROOT, or process.cwd().
 * Always returns an absolute path.
 */
export function resolveWorkspaceRoot(): string {
  const fromEnv = process.env.ROUTERAI_WORKSPACE_ROOT?.trim();
  const root = fromEnv && fromEnv.length > 0 ? fromEnv : process.cwd();
  return path.resolve(root);
}

/**
 * Resolve `relativePath` under `workspaceRoot` to an absolute path.
 * Rejects empty paths, workspace escapes (`..`), and absolute paths outside the root.
 * Throws `Error` with a message starting with `validation:`.
 */
export function resolveSafePath(
  relativePath: string,
  workspaceRoot: string,
): string {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    throw new Error("validation: path is required");
  }

  const root = path.resolve(workspaceRoot);
  const candidate = path.resolve(root, relativePath);
  const rel = path.relative(root, candidate);

  if (
    rel === ".." ||
    rel.startsWith(".." + path.sep) ||
    path.isAbsolute(rel)
  ) {
    throw new Error("validation: path escapes workspace root");
  }

  if (rel === "") {
    throw new Error("validation: path must be a file under workspace root");
  }

  return candidate;
}

/**
 * Refuse to overwrite an existing file when `overwrite` is false.
 * Throws `fs:exists` when the target exists and overwrite is not allowed.
 */
export async function assertCanWrite(
  absolutePath: string,
  overwrite: boolean,
): Promise<void> {
  try {
    await stat(absolutePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`fs: ${message}`);
  }

  if (!overwrite) {
    throw new Error("fs:exists");
  }
}

/**
 * Create parent directories for `absolutePath` (recursive).
 * On failure throws `Error` with a message starting with `fs:`.
 */
export async function ensureParentDir(absolutePath: string): Promise<void> {
  const parent = path.dirname(absolutePath);
  try {
    await mkdir(parent, { recursive: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("fs:")) {
      throw err instanceof Error ? err : new Error(message);
    }
    throw new Error(`fs: ${message}`);
  }
}

/**
 * Atomically write `bytes` to `absolutePath` via a same-directory temp file + rename.
 * On failure throws `Error` with a message starting with `fs:`.
 */
export async function atomicWriteFile(
  absolutePath: string,
  bytes: Buffer,
): Promise<void> {
  const dir = path.dirname(absolutePath);
  const tempPath = path.join(
    dir,
    `.${path.basename(absolutePath)}.${randomBytes(8).toString("hex")}.tmp`,
  );

  try {
    await writeFile(tempPath, bytes);
    try {
      await rename(tempPath, absolutePath);
    } catch (renameErr) {
      // Windows cannot rename onto an existing path; replace then rename.
      const code = (renameErr as NodeJS.ErrnoException).code;
      if (code === "EEXIST" || code === "EPERM" || code === "EACCES") {
        await unlink(absolutePath);
        await rename(tempPath, absolutePath);
      } else {
        throw renameErr;
      }
    }
  } catch (err) {
    try {
      await unlink(tempPath);
    } catch {
      // ignore cleanup errors
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("fs:")) {
      throw err instanceof Error ? err : new Error(message);
    }
    throw new Error(`fs: ${message}`);
  }
}
