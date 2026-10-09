/**
 * Resolve the workspace root from ROUTERAI_WORKSPACE_ROOT, or process.cwd().
 * Always returns an absolute path.
 */
export declare function resolveWorkspaceRoot(): string;
/**
 * Resolve `relativePath` under `workspaceRoot` to an absolute path.
 * Rejects empty paths, workspace escapes (`..`), and absolute paths outside the root.
 * Throws `Error` with a message starting with `validation:`.
 */
export declare function resolveSafePath(relativePath: string, workspaceRoot: string): string;
/**
 * Refuse to overwrite an existing file when `overwrite` is false.
 * Throws `fs:exists` when the target exists and overwrite is not allowed.
 */
export declare function assertCanWrite(absolutePath: string, overwrite: boolean): Promise<void>;
/**
 * Create parent directories for `absolutePath` (recursive).
 * On failure throws `Error` with a message starting with `fs:`.
 */
export declare function ensureParentDir(absolutePath: string): Promise<void>;
/**
 * Atomically write `bytes` to `absolutePath` via a same-directory temp file + rename.
 * On failure throws `Error` with a message starting with `fs:`.
 */
export declare function atomicWriteFile(absolutePath: string, bytes: Buffer): Promise<void>;
