/**
 * File Resource
 * 
 * Resource for accessing files and directories in the filesystem
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from 'path';
import fs from 'fs/promises';
import { ResourceResponse } from '../types/index.js';
import { file as fileUtils, logger } from '../utils/index.js';

/**
 * Register the file resource with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerFileResource(server: McpServer): void {
  logger.info('Registering file resource');
  
  server.resource(
    "file", 
    new ResourceTemplate("file://{path}", { list: undefined }), 
    async (uri: URL, { path: filePath }: { path: string }): Promise<ResourceResponse> => {
      try {
        logger.debug(`Reading resource: ${filePath}`);
        const fileStats = await fs.stat(filePath);
        
        if (fileStats.isDirectory()) {
          return handleDirectoryResource(uri, filePath);
        } else {
          return handleFileResource(uri, filePath);
        }
      } catch (error) {
        const err = error as Error;
        logger.error(`Failed to read resource '${filePath}':`, { error: err.message });
        throw new Error(`Failed to read file/directory: ${err.message}`);
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
async function handleDirectoryResource(uri: URL, dirPath: string): Promise<ResourceResponse> {
  try {
    const files = await fs.readdir(dirPath);
    const formattedFiles = await Promise.all(files.map(async (file) => {
      const fullPath = path.join(dirPath, file);
      try {
        const stats = await fs.stat(fullPath);
        return `${stats.isDirectory() ? 'D' : 'F'} ${file}`;
      } catch (e) {
        return `? ${file}`;
      }
    }));
    
    return {
      contents: [{
        uri: uri.href,
        text: `Directory: ${dirPath}\n\nContents:\n${formattedFiles.join('\n')}`,
        mimeType: 'text/plain'
      }]
    };
  } catch (error) {
    const err = error as Error;
    logger.error(`Failed to read directory: ${dirPath}`, { error: err.message });
    throw error;
  }
}

/**
 * Handle a file resource request
 * @param {URL} uri - The resource URI
 * @param {string} filePath - Path to the file
 * @returns {Promise<ResourceResponse>} Resource response
 */
async function handleFileResource(uri: URL, filePath: string): Promise<ResourceResponse> {
  try {
    const { content, isBinary } = await fileUtils.safeReadFile(filePath);
    
    if (isBinary) {
      return {
        contents: [{
          uri: uri.href,
          blob: (content as Buffer).toString('base64'),
          mimeType: fileUtils.getMimeType(filePath)
        }]
      };
    } else {
      return {
        contents: [{
          uri: uri.href,
          text: content as string,
          mimeType: fileUtils.getMimeType(filePath)
        }]
      };
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Failed to read file: ${filePath}`, { error: err.message });
    throw error;
  }
}

export default {
  registerFileResource,
};
