/**
 * File Diff Tool - April 24, 2025
 *
 * Tool for comparing differences between two files
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolResponse } from "../types/index.js";
import { z } from "zod";
import * as fs from "fs/promises";
import { createPatch, createTwoFilesPatch } from "diff";
import { logger } from "../utils/index.js";

/**
 * Register a tool for comparing differences between two files
 * @param server - The MCP server instance
 */
export function registerFileDiffTool(server: McpServer): void {
  logger.info("Registering file diff tool");

  server.tool(
    "diff_files",
    "Tool to compare differences between two files and generate a patch in unified or side-by-side format",
    {
      fileA: z.string().describe("Path to the first file"),
      fileB: z.string().describe("Path to the second file"),
      format: z
        .enum(["unified", "side-by-side"])
        .optional()
        .default("unified")
        .describe("Diff format: unified or side-by-side"),
    },
    async ({ fileA, fileB, format }): Promise<ToolResponse> => {
      try {
        // Read contents of both files
        const contentA = await fs.readFile(fileA, "utf8");
        const contentB = await fs.readFile(fileB, "utf8");

        // Generate appropriate diff format
        let diffResult: string;
        if (format === "unified") {
          diffResult = createPatch(
            fileA,
            contentA,
            contentB,
            "File A",
            "File B"
          );
        } else {
          // Side by side diff
          diffResult = createTwoFilesPatch(
            fileA,
            fileB,
            contentA,
            contentB,
            "File A",
            "File B"
          );
        }

        logger.info(
          `Successfully generated ${format} diff between ${fileA} and ${fileB}`
        );

        return {
          content: [
            {
              type: "text",
              text: diffResult || "Files are identical",
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(`Error creating diff between '${fileA}' and '${fileB}':`, {
          error: err.message,
        });

        return {
          content: [
            {
              type: "text",
              text: `Error creating diff: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export default {
  registerFileDiffTool,
};
