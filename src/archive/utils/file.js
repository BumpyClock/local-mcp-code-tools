/**
 * File utility functions for CodeTools MCP
 * 
 * Provides helper functions for common file operations
 */

import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';

/**
 * Determine the MIME type based on file extension
 * @param {string} filePath - Path to the file
 * @returns {string} The MIME type
 */
export function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html', 
    '.css': 'text/css', 
    '.js': 'text/javascript', 
    '.mjs': 'text/javascript',
    '.json': 'application/json', 
    '.xml': 'application/xml',
    '.png': 'image/png', 
    '.jpg': 'image/jpeg', 
    '.jpeg': 'image/jpeg', 
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml', 
    '.webp': 'image/webp', 
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf', 
    '.zip': 'application/zip', 
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip', 
    '.wasm': 'application/wasm',
    '.md': 'text/markdown', 
    '.txt': 'text/plain', 
    '.csv': 'text/csv',
    '.py': 'text/x-python', 
    '.java': 'text/x-java-source', 
    '.c': 'text/x-c', 
    '.cpp': 'text/x-c++',
    '.ts': 'text/typescript', 
    '.tsx': 'text/tsx', 
    '.jsx': 'text/jsx',
    '.woff': 'font/woff', 
    '.woff2': 'font/woff2', 
    '.ttf': 'font/ttf', 
    '.otf': 'font/otf',
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Check if a file is likely binary based on extension
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if the file is likely binary
 */
export function isBinaryFile(filePath) {
  const knownBinaryExtensions = /\.(jpg|jpeg|png|gif|bmp|ico|pdf|zip|tar|gz|exe|dll|so|bin|dat|webp|woff|woff2|ttf|otf)$/i;
  return knownBinaryExtensions.test(filePath);
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory
 * @param {boolean} [recursive=true] - Whether to create parent directories
 * @returns {Promise<void>}
 */
export async function ensureDirectory(dirPath, recursive = true) {
  try {
    await fs.mkdir(dirPath, { recursive });
    logger.debug(`Ensured directory exists: ${dirPath}`);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      logger.error(`Failed to ensure directory exists: ${dirPath}`, { error: error.message });
      throw error;
    }
  }
}

/**
 * Safely write to a file, ensuring the directory exists
 * @param {string} filePath - Path to the file
 * @param {string|Buffer} content - Content to write
 * @returns {Promise<void>}
 */
export async function safeWriteFile(filePath, content) {
  const dirPath = path.dirname(filePath);
  await ensureDirectory(dirPath);
  await fs.writeFile(filePath, content);
  logger.debug(`Wrote file: ${filePath}`);
}

/**
 * Safely read a file as text or binary
 * @param {string} filePath - Path to the file
 * @param {boolean} [forceBinary=false] - Force reading as binary
 * @returns {Promise<{content: string|Buffer, isBinary: boolean}>}
 */
export async function safeReadFile(filePath, forceBinary = false) {
  try {
    const fileStats = await fs.stat(filePath);
    
    if (fileStats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${filePath}`);
    }
    
    const shouldReadAsBinary = forceBinary || isBinaryFile(filePath);
    
    if (shouldReadAsBinary) {
      const content = await fs.readFile(filePath);
      return { content, isBinary: true };
    } else {
      const content = await fs.readFile(filePath, 'utf8');
      return { content, isBinary: false };
    }
  } catch (error) {
    logger.error(`Failed to read file: ${filePath}`, { error: error.message });
    throw error;
  }
}

export default {
  getMimeType,
  isBinaryFile,
  ensureDirectory,
  safeWriteFile,
  safeReadFile,
};
