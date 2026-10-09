const STAGES = [
    "validation",
    "auth",
    "provider",
    "decode",
    "fs",
];
export function isStagedError(message) {
    return STAGES.some((stage) => message.startsWith(`${stage}:`));
}
export function stageError(stage, message) {
    const text = message.startsWith(`${stage}:`)
        ? message
        : `${stage}: ${message}`;
    return new Error(text);
}
export function toToolErrorResult(err) {
    let text;
    if (err instanceof Error && err.message) {
        text = err.message.split("\n")[0];
    }
    else if (typeof err === "string" && err) {
        text = err.split("\n")[0];
    }
    else {
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
