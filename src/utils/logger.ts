/**
 * Logger utility for CodeTools MCP
 *
 * Provides standardized logging functions that write to stderr
 * to avoid interfering with stdout which is used for the MCP protocol.
 */

import { LogData, LogLevel, Logger } from "../types/index.js";

// Log levels
const LOG_LEVELS: Record<LogLevel, number> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Current log level (can be set via environment variable)
let currentLogLevel: number = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase() as LogLevel] ??
    LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

/**
 * Format a log message with timestamp and level
 * @param {string} level - The log level
 * @param {string} message - The main log message
 * @param {LogData} [data] - Optional data to include
 * @returns {string} The formatted log message
 */
function formatLogMessage(
  level: string,
  message: string,
  data?: LogData
): string {
  const timestamp = new Date().toISOString();
  let logMessage = `${timestamp} [${level}] ${message}`;

  if (data) {
    try {
      logMessage += ` ${JSON.stringify(data)}`;
    } catch (error) {
      const err = error as Error;
      logMessage += ` [Error serializing data: ${err.message}]`;
    }
  }

  return logMessage;
}

/**
 * Log a message to stderr if the log level is sufficient
 * @param {string} level - The log level
 * @param {number} levelValue - The numeric value of the log level
 * @param {string} message - The message to log
 * @param {LogData} [data] - Optional data to include
 */
function log(
  level: string,
  levelValue: number,
  message: string,
  data?: LogData
): void {
  if (levelValue <= currentLogLevel) {
    console.error(formatLogMessage(level, message, data));
  }
}

/**
 * Set the current log level
 * @param {LogLevel|number} level - The log level to set
 */
function setLogLevel(level: LogLevel | number): void {
  if (typeof level === "string") {
    if (LOG_LEVELS[level] !== undefined) {
      currentLogLevel = LOG_LEVELS[level];
    }
  } else if (typeof level === "number") {
    currentLogLevel = Math.max(
      0,
      Math.min(Object.keys(LOG_LEVELS).length - 1, level)
    );
  }
}

// Export logger functions
const logger: Logger = {
  error: (message: string, data?: LogData) =>
    log("ERROR", LOG_LEVELS.ERROR, message, data),
  warn: (message: string, data?: LogData) =>
    log("WARN", LOG_LEVELS.WARN, message, data),
  info: (message: string, data?: LogData) =>
    log("INFO", LOG_LEVELS.INFO, message, data),
  debug: (message: string, data?: LogData) =>
    log("DEBUG", LOG_LEVELS.DEBUG, message, data),
  setLogLevel,
  LOG_LEVELS,
};

export default logger;
