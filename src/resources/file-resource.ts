/**
 * File Resource
 *
 * Resource for accessing files and directories in the filesystem
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "path";
import fs from "fs/promises";
import { ResourceResponse } from "../types/index.js";
import { file as fileUtils, logger } from "../utils/index.js";

/**
 * Validate a file path for safety and accessibility
 * @param {string} filePath - The file path to validate
 * @throws {Error} If the path is invalid or unsafe
 */
function validateFilePath(filePath: string): void {
  // Check if path is empty
  if (!filePath || filePath.trim() === '') {
    throw new Error('File path cannot be empty');
  }
  
  // Check for suspicious path patterns (basic security check)
  const suspiciousPatterns = /(\.\.|\/\.\.|\.\.\/|~|^\/(?!Users|tmp|var|opt|home))/;
  if (suspiciousPatterns.test(filePath)) {
    throw new Error(`File path contains potentially unsafe patterns: ${filePath}`);
  }
}

/**
 * Register the file resource with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerFileResource(server: McpServer): void {
  logger.info("Registering file resource");

  server.resource(
    "file",
    new ResourceTemplate("file://{path}", { list: undefined }),
    async (
      uri: URL,
      variables: Record<string, unknown>
    ): Promise<ResourceResponse> => {
      // Properly decode URI path components and normalize
      let filePath = decodeURIComponent(String(variables.path));
      
      // If path starts with a drive letter in Windows (C:/) or / in Unix, use as-is
      // Otherwise, treat as a relative path
      if (!path.isAbsolute(filePath)) {
        logger.debug(`Converting relative path to absolute: ${filePath}`);
        filePath = path.resolve(process.cwd(), filePath);
      }
      
      try {
        // Validate the file path for safety
        validateFilePath(filePath);
        
        logger.debug(`Reading resource: ${filePath}`);
        const fileStats = await fs.stat(filePath);

        if (fileStats.isDirectory()) {
          return handleDirectoryResource(uri, filePath);
        } else {
          return handleFileResource(uri, filePath);
        }
      } catch (error) {
        const err = error as Error;
        const errorCode = (error as NodeJS.ErrnoException).code;
        
        logger.error(`Failed to read resource '${filePath}':`, {
          error: err.message,
          code: errorCode
        });
        
        // More descriptive error messages based on error type
        if (errorCode === 'ENOENT') {
          throw new Error(`File or directory not found at path: ${filePath}. Please check that the path exists and is accessible.`);
        } else if (errorCode === 'EACCES') {
          throw new Error(`Permission denied when accessing: ${filePath}. Please check file permissions.`);
        } else {
          throw new Error(`Failed to read file/directory at '${filePath}': ${err.message}`);
        }
      }
    }
  );
}

/**
 * Handle a directory resource request
 * @param {URL} uri - The resource URI
 * @param {string} dirPath - Path to the directory
 * @returns {Promise<ResourceResponse>} Resource response
 */
async function handleDirectoryResource(
  uri: URL,
  dirPath: string
): Promise<ResourceResponse> {
  try {
    const files = await fs.readdir(dirPath);
    const formattedFiles = await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(dirPath, file);
        try {
          const stats = await fs.stat(fullPath);
          return `${stats.isDirectory() ? "D" : "F"} ${file}`;
        } catch (e) {
          return `? ${file}`;
        }
      })
    );

    return {
      contents: [
        {
          uri: uri.href,
          text: `Directory: ${dirPath}\n\nContents:\n${formattedFiles.join(
            "\n"
          )}`,
          mimeType: "text/plain",
        },
      ],
    };
  } catch (error) {
    const err = error as Error;
    logger.error(`Failed to read directory: ${dirPath}`, {
      error: err.message,
    });
    // More descriptive error for directory failures
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Directory not found: ${dirPath}. Please check that the path exists.`);
    } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      throw new Error(`Permission denied when accessing directory: ${dirPath}. Please check directory permissions.`);
    }
    throw error;
  }
}

/**
 * Handle a file resource request
 * @param {URL} uri - The resource URI
 * @param {string} filePath - Path to the file
 * @returns {Promise<ResourceResponse>} Resource response
 */
async function handleFileResource(
  uri: URL,
  filePath: string
): Promise<ResourceResponse> {
  try {
    const { content, isBinary } = await fileUtils.safeReadFile(filePath);

    if (isBinary) {
      return {
        contents: [
          {
            uri: uri.href,
            blob: (content as Buffer).toString("base64"),
            mimeType: fileUtils.getMimeType(filePath),
          },
        ],
      };
    } else {
      return {
        contents: [
          {
            uri: uri.href,
            text: content as string,
            mimeType: fileUtils.getMimeType(filePath),
          },
        ],
      };
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Failed to read file: ${filePath}`, { error: err.message });
    // More descriptive error for file failures
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}. Please check that the path exists.`);
    } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      throw new Error(`Permission denied when accessing file: ${filePath}. Please check file permissions.`);
    }
    throw error;
  }
}

export default {
  registerFileResource,
};
