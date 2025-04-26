/**
 * File Conversion Tool - April 24, 2025
 *
 * This tool allows converting between various file formats:
 * - JSON to YAML
 * - YAML to JSON
 * - Markdown to HTML
 * - HTML to Markdown
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "path";
import fs from "fs/promises";
import { ToolResponse } from "../types/index.js";
import { file as fileUtils, logger } from "../utils/index.js";

/**
 * Register the file conversion tool
 * @param {McpServer} server - The MCP server instance
 */
export function registerFileConversionTool(server: McpServer): void {
  server.tool(
    "convert_file",
    "Tool to convert files between different formats including JSON-to-YAML, YAML-to-JSON, Markdown-to-HTML, and HTML-to-Markdown",
    {
      source: z.string().describe("Source file path"),
      destination: z.string().describe("Destination file path"),
      format: z
        .enum(["json2yaml", "yaml2json", "md2html", "html2md"])
        .describe("Conversion format"),
    },
    async ({ source, destination, format }, _extra): Promise<ToolResponse> => {
      try {
        // Create parent directories if needed
        const dirPath = path.dirname(destination);
        await fileUtils.ensureDirectory(dirPath);

        // Read the source file
        const content = await fs.readFile(source, "utf8");

        // Convert the content
        const convertedContent = await convertContent(content, format);

        // Write the destination file
        await fs.writeFile(destination, convertedContent, "utf8");

        logger.info(
          `Converted file from ${source} to ${destination} using ${format} format`
        );

        return {
          content: [
            {
              type: "text",
              text: `Successfully converted file from ${source} to ${destination} using ${format} format`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(
          `Error converting file from '${source}' to '${destination}':`,
          {
            error: err.message,
          }
        );
        return {
          content: [
            {
              type: "text",
              text: `Error converting file: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Convert content from one format to another
 * @param {string} content - The content to convert
 * @param {string} format - The conversion format
 * @returns {Promise<string>} - The converted content
 */
async function convertContent(
  content: string,
  format: string
): Promise<string> {
  try {
    // Import necessary libraries
    const yaml = await import("js-yaml");
    const { marked } = await import("marked");
    const TurndownService = await import("turndown");

    switch (format) {
      case "json2yaml":
        // Parse JSON and convert to YAML
        const jsonData = JSON.parse(content);
        return yaml.dump(jsonData);

      case "yaml2json":
        // Parse YAML and convert to JSON
        const yamlData = yaml.load(content);
        return JSON.stringify(yamlData, null, 2);

      case "md2html":
        // Convert Markdown to HTML
        return marked(content);

      case "html2md":
        // Convert HTML to Markdown
        const turndownService = new TurndownService.default();
        return turndownService.turndown(content);

      default:
        throw new Error(`Unsupported conversion format: ${format}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error during conversion: ${error.message}`);
    }
    throw new Error("Unknown error during conversion");
  }
}

export default {
  registerFileConversionTool,
};
