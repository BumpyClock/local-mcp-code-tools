/**
 * File Tools
 * 
 * Tools for file operations like reading, writing, and listing
 */

import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import * as Diff from 'diff';
import { file as fileUtils, logger } from '../utils/index.js';

/**
 * Register file operation tools with the MCP server
 * @param {object} server - The MCP server instance
 */
export function registerFileTools(server) {
  logger.info('Registering file operation tools');
  
  registerUpdateFileTool(server);
  registerApplyPatchTool(server);
  registerListDirectoryTool(server);
  registerCreateDirectoryTool(server);
  registerSearchFilesTool(server);
}

/**
 * Register the update_file tool
 * @param {object} server - The MCP server instance
 */
function registerUpdateFileTool(server) {
  server.tool(
    "update_file",
    {
      filePath: z.string().describe("Path to the file to modify or create."),
      newContent: z.string().describe("The new content to write to the file."),
    },
    async ({ filePath, newContent }) => {
      try {
        // Create parent directories if needed
        const dirPath = path.dirname(filePath);
        await fileUtils.ensureDirectory(dirPath);
        
        await fs.writeFile(filePath, newContent, 'utf8');
        logger.info(`Successfully updated file: ${filePath}`);
        
        return {
          content: [{ 
            type: "text", 
            text: `Successfully updated ${filePath}` 
          }],
          isError: false,
        };
      } catch (error) {
        logger.error(`Error updating file '${filePath}':`, { error: error.message });
        return {
          content: [{ 
            type: "text", 
            text: `Error updating file: ${error.message}` 
          }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the apply_patch tool
 * @param {object} server - The MCP server instance
 */
function registerApplyPatchTool(server) {
  server.tool(
    "apply_patch",
    {
      filePath: z.string().describe("Path to the file to modify"),
      unifiedDiff: z.string().describe("The unified diff patch string to apply"),
    },
    async ({ filePath, unifiedDiff }) => {
      try {
        const currentContent = await fs.readFile(filePath, 'utf8');
        const patchedContent = Diff.applyPatch(currentContent, unifiedDiff);
        
        if (patchedContent === false) {
          logger.error(`Failed to apply patch to ${filePath}. Patch might not match content.`);
          return {
            content: [{ 
              type: "text", 
              text: "Error: Failed to apply patch. It may not match the current file content." 
            }],
            isError: true,
          };
        }
        
        await fs.writeFile(filePath, patchedContent, 'utf8');
        logger.info(`Successfully applied patch to ${filePath}`);
        
        return {
          content: [{ 
            type: "text", 
            text: `Successfully applied patch to ${filePath}` 
          }],
          isError: false,
        };
      } catch (error) {
        logger.error(`Error applying patch to '${filePath}':`, { error: error.message });
        
        if (error.code === 'ENOENT') {
          return {
            content: [{ 
              type: "text", 
              text: `Error: File not found at path: ${filePath}` 
            }],
            isError: true,
          };
        }
        
        return {
          content: [{ 
            type: "text", 
            text: `Error applying patch: ${error.message}` 
          }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the list_directory tool
 * @param {object} server - The MCP server instance
 */
function registerListDirectoryTool(server) {
  server.tool(
    "list_directory",
    {
      path: z.string().describe("Path to the directory to list."),
    },
    async ({ path: dirPath }) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const formattedEntries = entries.map(entry => {
          return `${entry.isDirectory() ? 'D' : 'F'} ${entry.name}`;
        });
        
        logger.debug(`Listed directory: ${dirPath}`);
        
        return {
          content: [{ 
            type: "text", 
            text: `Contents of ${dirPath}:\n${formattedEntries.join('\n')}` 
          }],
          isError: false,
        };
      } catch (error) {
        logger.error(`Error listing directory '${dirPath}':`, { error: error.message });
        return {
          content: [{ 
            type: "text", 
            text: `Error listing directory: ${error.message}` 
          }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the create_directory tool
 * @param {object} server - The MCP server instance
 */
function registerCreateDirectoryTool(server) {
  server.tool(
    "create_directory",
    {
      path: z.string().describe("Path of the directory to create."),
      parents: z.boolean().optional().default(false).describe("Create parent directories if they do not exist."),
    },
    async ({ path: dirPath, parents }) => {
      try {
        await fs.mkdir(dirPath, { recursive: parents });
        logger.info(`Created directory: ${dirPath} (parents: ${parents})`);
        
        return {
          content: [{ 
            type: "text", 
            text: `Directory created successfully at ${dirPath}` 
          }],
          isError: false,
        };
      } catch (error) {
        logger.error(`Error creating directory '${dirPath}':`, { error: error.message });
        return {
          content: [{ 
            type: "text", 
            text: `Error creating directory: ${error.message}` 
          }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the search_files tool
 * @param {object} server - The MCP server instance
 */
function registerSearchFilesTool(server) {
  server.tool(
    "search_files",
    {
      pattern: z.string().describe("The text pattern to search for."),
      path: z.string().describe("The directory path to start the search from."),
      recursive: z.boolean().optional().default(true).describe("Whether to search recursively into subdirectories."),
    },
    async ({ pattern, path: searchPath, recursive }) => {
      try {
        const { process: processUtils } = await import('../utils/index.js');
        
        const grepArgs = [
          recursive ? '-r' : '',
          '-n',
          '-I',
          '-e', pattern,
          searchPath
        ].filter(Boolean);
        
        const { stdout, stderr, code } = await processUtils.runProcess('grep', grepArgs, { allowNonZeroExitCode: true });
        
        if (code === 1 && !stderr && !stdout) {
          logger.info(`No matches found for pattern "${pattern}" in ${searchPath}`);
          return {
            content: [{ 
              type: "text", 
              text: `No matches found for pattern "${pattern}" in ${searchPath}` 
            }],
            isError: false,
          };
        } else if (code !== 0 && code !== 1) {
          logger.error(`Grep search failed with code ${code} for pattern "${pattern}" in ${searchPath}. Stderr: ${stderr}`);
          return {
            content: [{ 
              type: "text", 
              text: `Error during search: ${stderr || 'Unknown grep error'}` 
            }],
            isError: true,
          };
        }
        
        logger.info(`Search successful for pattern "${pattern}" in ${searchPath}`);
        
        return {
          content: [{ 
            type: "text", 
            text: `Search results for "${pattern}" in ${searchPath}:\n\n${stdout}` 
          }],
          isError: false,
        };
      } catch (error) {
        logger.error(`Error searching files for pattern "${pattern}" in ${searchPath}:`, { error: error.message });
        return {
          content: [{ 
            type: "text", 
            text: `Error searching files: ${error.message}` 
          }],
          isError: true,
        };
      }
    }
  );
}

export default {
  registerFileTools,
};
