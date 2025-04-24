/**
 * Logger utility for CodeTools MCP
 * 
 * Provides standardized logging functions that write to stderr
 * to avoid interfering with stdout which is used for the MCP protocol.
 */

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Current log level (can be set via environment variable)
let currentLogLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] 
  : LOG_LEVELS.INFO;

/**
 * Format a log message with timestamp and level
 * @param {string} level - The log level
 * @param {string} message - The main log message
 * @param {object} [data] - Optional data to include
 * @returns {string} The formatted log message
 */
function formatLogMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  let logMessage = `${timestamp} [${level}] ${message}`;
  
  if (data) {
    try {
      logMessage += ` ${JSON.stringify(data)}`;
    } catch (error) {
      logMessage += ` [Error serializing data: ${error.message}]`;
    }
  }
  
  return logMessage;
}

/**
 * Log a message to stderr if the log level is sufficient
 * @param {string} level - The log level
 * @param {number} levelValue - The numeric value of the log level
 * @param {string} message - The message to log
 * @param {object} [data] - Optional data to include
 */
function log(level, levelValue, message, data) {
  if (levelValue <= currentLogLevel) {
    console.error(formatLogMessage(level, message, data));
  }
}

/**
 * Set the current log level
 * @param {string|number} level - The log level to set
 */
function setLogLevel(level) {
  if (typeof level === 'string') {
    if (LOG_LEVELS[level.toUpperCase()] !== undefined) {
      currentLogLevel = LOG_LEVELS[level.toUpperCase()];
    }
  } else if (typeof level === 'number') {
    currentLogLevel = Math.max(0, Math.min(Object.keys(LOG_LEVELS).length - 1, level));
  }
}

// Export logger functions
export default {
  error: (message, data) => log('ERROR', LOG_LEVELS.ERROR, message, data),
  warn: (message, data) => log('WARN', LOG_LEVELS.WARN, message, data),
  info: (message, data) => log('INFO', LOG_LEVELS.INFO, message, data),
  debug: (message, data) => log('DEBUG', LOG_LEVELS.DEBUG, message, data),
  setLogLevel,
  LOG_LEVELS,
};
