/**
 * Type definitions for the CodeTools MCP Server
 */

export interface LogData {
  [key: string]: unknown;
}

export interface ProcessResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface ProcessError extends Error {
  stdout?: string;
  stderr?: string;
  code?: number;
}

export interface ProcessOptions {
  cwd?: string;
  stdinData?: string;
  shell?: boolean;
  allowNonZeroExitCode?: boolean;
}

export interface FileReadResult {
  content: string | Buffer;
  isBinary: boolean;
}

export interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
    [x: string]: unknown;
  }>;
  isError: boolean;
  _meta?: Record<string, unknown>;
  [x: string]: unknown;
}

export interface ResourceResponse {
  contents: Array<
    | { uri: string; text: string; mimeType?: string }
    | { uri: string; blob: string; mimeType?: string }
  >;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PromptMessage {
  role: "user" | "assistant" | "system";
  content: {
    type: string;
    text: string;
  };
}

export interface PromptResponse {
  messages: PromptMessage[];
}

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG";

export interface Logger {
  error: (message: string, data?: LogData) => void;
  warn: (message: string, data?: LogData) => void;
  info: (message: string, data?: LogData) => void;
  debug: (message: string, data?: LogData) => void;
  setLogLevel: (level: LogLevel | number) => void;
  LOG_LEVELS: Record<LogLevel, number>;
}

export interface FileUtils {
  getMimeType: (filePath: string) => string;
  isBinaryFile: (filePath: string) => boolean;
  ensureDirectory: (dirPath: string, recursive?: boolean) => Promise<void>;
  safeWriteFile: (filePath: string, content: string | Buffer) => Promise<void>;
  safeReadFile: (
    filePath: string,
    forceBinary?: boolean
  ) => Promise<FileReadResult>;
}

export interface ProcessUtils {
  runProcess: (
    command: string,
    args?: string[],
    options?: ProcessOptions
  ) => Promise<ProcessResult>;
}

export interface Utils {
  logger: Logger;
  file: FileUtils;
  process: ProcessUtils;
}
