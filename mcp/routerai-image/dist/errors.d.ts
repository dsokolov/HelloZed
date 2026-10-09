export type ErrorStage = "validation" | "auth" | "provider" | "decode" | "fs";
export type ToolErrorResult = {
    content: [{
        type: "text";
        text: string;
    }];
    isError: true;
};
export declare function isStagedError(message: string): boolean;
export declare function stageError(stage: ErrorStage, message: string): Error;
export declare function toToolErrorResult(err: unknown): ToolErrorResult;
