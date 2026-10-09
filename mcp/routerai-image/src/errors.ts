export type ErrorStage = "validation" | "auth" | "provider" | "decode" | "fs";

const STAGES: readonly ErrorStage[] = [
  "validation",
  "auth",
  "provider",
  "decode",
  "fs",
];

export type ToolErrorResult = {
  content: [{ type: "text"; text: string }];
  isError: true;
};

export function isStagedError(message: string): boolean {
  return STAGES.some((stage) => message.startsWith(`${stage}:`));
}

export function stageError(stage: ErrorStage, message: string): Error {
  const text = message.startsWith(`${stage}:`)
    ? message
    : `${stage}: ${message}`;
  return new Error(text);
}

export function toToolErrorResult(err: unknown): ToolErrorResult {
  let text: string;
  if (err instanceof Error && err.message) {
    text = err.message.split("\n")[0]!;
  } else if (typeof err === "string" && err) {
    text = err.split("\n")[0]!;
  } else {
    text = "provider: unexpected error";
  }

  if (!isStagedError(text)) {
    text = stageError("provider", text).message;
  }

  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}
