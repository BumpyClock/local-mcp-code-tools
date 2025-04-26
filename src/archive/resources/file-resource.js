/**
 * File Resource
 * 
 * Resource for accessing files and directories in the filesystem
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from 'path';
import fs from 'fs/promises';
import { file as fileUtils, logger } from '../utils/index.js';

/**
 * Register the file resource with the MCP server
 * @param {object} server - The MCP server instance
 */
export function registerFileResource(server) {
  logger.info('Registering file resource');
  
  server.resource(
    "file", 
    new ResourceTemplate("file://{path}", { list: undefined }), 
    async (uri, { path: filePath }) => {
      try {
        logger.debug(`Reading resource: ${filePath}`);
        const fileStats = await fs.stat(filePath);
        
        if (fileStats.isDirectory()) {
          return handleDirectoryResource(uri, filePath);
        } else {
          return handleFileResource(uri, filePath);
        }
      } catch (error) {
        logger.error(`Failed to read resource '${filePath}':`, { error: error.message });
        throw new Error(`Failed to read file/directory: ${error.message}`);
      }
    }
  );
}

/**
 * Handle a directory resource request
 * @param {object} uri - The resource URI
 * @param {string} dirPath - Path to the directory
 * @returns {Promise<object>} Resource response
 */
async function handleDirectoryResource(uri, dirPath) {
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
    logger.error(`Failed to read directory: ${dirPath}`, { error: error.message });
    throw error;
  }
}

/**
 * Handle a file resource request
 * @param {object} uri - The resource URI
 * @param {string} filePath - Path to the file
 * @returns {Promise<object>} Resource response
 */
async function handleFileResource(uri, filePath) {
  try {
    const { content, isBinary } = await fileUtils.safeReadFile(filePath);
    
    if (isBinary) {
      return {
        contents: [{
          uri: uri.href,
          blob: content.toString('base64'),
          mimeType: fileUtils.getMimeType(filePath)
        }]
      };
    } else {
      return {
        contents: [{
          uri: uri.href,
          text: content,
          mimeType: fileUtils.getMimeType(filePath)
        }]
      };
    }
  } catch (error) {
    logger.error(`Failed to read file: ${filePath}`, { error: error.message });
    throw error;
  }
}

export default {
  registerFileResource,
};
