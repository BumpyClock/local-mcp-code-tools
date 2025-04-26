/**
 * File Move/Copy Tool - April 24, 2025
 *
 * This tool allows moving and copying files:
 * - Move a file from one location to another
 * - Copy a file from one location to another
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "path";
import fs from "fs/promises";
import { ToolResponse } from "../types/index.js";
import { file as fileUtils, logger } from "../utils/index.js";

/**
 * Register the file move and copy tools
 * @param {McpServer} server - The MCP server instance
 */
export function registerFileMoveCopyTools(server: McpServer): void {
  logger.info("Registering file move/copy tools");

  registerFileCopyTool(server);
  registerFileMoveTool(server);
}

/**
 * Register the file_copy tool
 * @param {McpServer} server - The MCP server instance
 */
function registerFileCopyTool(server: McpServer): void {
  server.tool(
    "copy_file",
    "Tool to copy a file from one location to another, with ability to create parent directories and control overwrite behavior",
    {
      source: z.string().describe("Path to the source file"),
      destination: z.string().describe("Path to the destination file"),
      overwrite: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to overwrite the destination file if it exists"),
    },
    async (
      { source, destination, overwrite },
      _extra
    ): Promise<ToolResponse> => {
      try {
        // Check if source file exists
        try {
          await fs.access(source);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Source file '${source}' does not exist`,
              },
            ],
            isError: true,
          };
        }

        // Check if destination file exists and handle overwrite flag
        try {
          await fs.access(destination);
          if (!overwrite) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Destination file '${destination}' already exists and overwrite is set to false`,
                },
              ],
              isError: true,
            };
          }
        } catch (error) {
          // Destination file does not exist, create parent directories if needed
          const dirPath = path.dirname(destination);
          await fileUtils.ensureDirectory(dirPath);
        }

        // Copy the file
        await fs.copyFile(source, destination);

        logger.info(
          `Successfully copied file from ${source} to ${destination}`
        );
        return {
          content: [
            {
              type: "text",
              text: `Successfully copied file from ${source} to ${destination}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(
          `Error copying file from '${source}' to '${destination}':`,
          {
            error: err.message,
          }
        );
        return {
          content: [
            {
              type: "text",
              text: `Error copying file: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the file_move tool
 * @param {McpServer} server - The MCP server instance
 */
function registerFileMoveTool(server: McpServer): void {
  server.tool(
    "move_file",
    "Tool to move or rename a file from one location to another, with ability to create parent directories and control overwrite behavior",
    {
      source: z.string().describe("Path to the source file"),
      destination: z.string().describe("Path to the destination file"),
      overwrite: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to overwrite the destination file if it exists"),
    },
    async (
      { source, destination, overwrite },
      _extra
    ): Promise<ToolResponse> => {
      try {
        // Check if source file exists
        try {
          await fs.access(source);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Source file '${source}' does not exist`,
              },
            ],
            isError: true,
          };
        }

        // Check if destination file exists and handle overwrite flag
        try {
          await fs.access(destination);
          if (!overwrite) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Destination file '${destination}' already exists and overwrite is set to false`,
                },
              ],
              isError: true,
            };
          }
        } catch (error) {
          // Destination file does not exist, create parent directories if needed
          const dirPath = path.dirname(destination);
          await fileUtils.ensureDirectory(dirPath);
        }

        // Move the file
        await fs.rename(source, destination);

        logger.info(`Successfully moved file from ${source} to ${destination}`);
        return {
          content: [
            {
              type: "text",
              text: `Successfully moved file from ${source} to ${destination}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(
          `Error moving file from '${source}' to '${destination}':`,
          {
            error: err.message,
          }
        );
        return {
          content: [
            {
              type: "text",
              text: `Error moving file: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export default {
  registerFileMoveCopyTools,
  registerFileCopyTool,
  registerFileMoveTool,
};
