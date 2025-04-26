/**
 * File Compression Tool - April 25, 2025
 *
 * This tool allows compression and decompression of files and directories:
 * - Create zip, tar, or gzip archives
 * - Extract files from archives
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "path";
import fs from "fs/promises";
import { ToolResponse } from "../types/index.js";
import {
  file as fileUtils,
  process as processUtils,
  logger,
} from "../utils/index.js";

/**
 * Register the file compression tools
 * @param {McpServer} server - The MCP server instance
 */
export function registerFileCompressionTools(server: McpServer): void {
  logger.info("Registering file compression tools");

  server.tool(
    "compress_files",
    "Tool to compress files or directories into zip, tar, or gzip archives with configurable options",
    {
      source: z.string().describe("Source file or directory path"),
      destination: z.string().describe("Destination archive path"),
      format: z.enum(["zip", "tar", "gzip"]).describe("Compression format"),
      level: z
        .number()
        .min(1)
        .max(9)
        .optional()
        .default(6)
        .describe("Compression level (1-9, where 9 is highest)"),
    },
    async (
      { source, destination, format, level },
      _extra
    ): Promise<ToolResponse> => {
      try {
        // Check if source exists
        try {
          await fs.access(source);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Source '${source}' does not exist`,
              },
            ],
            isError: true,
          };
        }

        // Create parent directories for destination if needed
        const destDir = path.dirname(destination);
        await fileUtils.ensureDirectory(destDir);

        // Construct the appropriate compression command
        let command: string;
        let args: string[];

        const isSourceDir = (await fs.stat(source)).isDirectory();

        switch (format) {
          case "zip":
            command = "zip";
            args = [`-${level}`, "-r", destination, path.basename(source)];
            break;
          case "tar":
            command = "tar";
            args = ["-cf", destination, path.basename(source)];
            break;
          case "gzip":
            if (isSourceDir) {
              return {
                content: [
                  {
                    type: "text",
                    text: "Error: gzip format can only compress single files, not directories",
                  },
                ],
                isError: true,
              };
            }
            command = "gzip";
            args = [`-${level}`, "-c", source];
            break;
          default:
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Unsupported compression format '${format}'`,
                },
              ],
              isError: true,
            };
        }

        // Execute the compression command
        const cwd = isSourceDir ? path.dirname(source) : undefined;

        if (format === "gzip") {
          // For gzip, we need to redirect output to the destination file
          const result = await processUtils.runProcess(command, args, {
            cwd,
            allowNonZeroExitCode: true,
          });

          if (result.code !== 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error compressing file: ${result.stderr}`,
                },
              ],
              isError: true,
            };
          }

          // Write the stdout to the destination file
          await fs.writeFile(destination, result.stdout, "binary");
        } else {
          // For zip and tar, the destination is specified in the command
          const result = await processUtils.runProcess(command, args, {
            cwd,
            allowNonZeroExitCode: true,
          });

          if (result.code !== 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error compressing file: ${result.stderr}`,
                },
              ],
              isError: true,
            };
          }
        }

        logger.info(
          `Successfully compressed ${source} to ${destination} using ${format} format`
        );

        return {
          content: [
            {
              type: "text",
              text: `Successfully compressed ${source} to ${destination} using ${format} format`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(`Error compressing '${source}' to '${destination}':`, {
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Error compressing file: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "extract_archive",
    "Tool to extract files from zip, tar, or gzip archives to a specified destination",
    {
      source: z.string().describe("Source archive path"),
      destination: z.string().describe("Destination directory to extract to"),
      format: z
        .enum(["zip", "tar", "gzip", "auto"])
        .describe(
          "Archive format (auto will attempt to detect from file extension)"
        ),
    },
    async ({ source, destination, format }, _extra): Promise<ToolResponse> => {
      try {
        // Check if source exists
        try {
          await fs.access(source);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Source archive '${source}' does not exist`,
              },
            ],
            isError: true,
          };
        }

        // Create destination directory if it doesn't exist
        await fileUtils.ensureDirectory(destination);

        // Detect format if set to auto
        let detectedFormat = format;
        if (format === "auto") {
          const ext = path.extname(source).toLowerCase();
          if (ext === ".zip") {
            detectedFormat = "zip";
          } else if (ext === ".tar" || ext === ".tar.gz" || ext === ".tgz") {
            detectedFormat = "tar";
          } else if (ext === ".gz") {
            detectedFormat = "gzip";
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Could not auto-detect archive format from extension '${ext}'`,
                },
              ],
              isError: true,
            };
          }
        }

        // Construct the appropriate extraction command
        let command: string;
        let args: string[];

        switch (detectedFormat) {
          case "zip":
            command = "unzip";
            args = ["-o", source, "-d", destination];
            break;
          case "tar":
            command = "tar";
            if (source.endsWith(".tar.gz") || source.endsWith(".tgz")) {
              args = ["-xzf", source, "-C", destination];
            } else {
              args = ["-xf", source, "-C", destination];
            }
            break;
          case "gzip":
            command = "gunzip";
            args = ["-c", source];
            break;
          default:
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Unsupported extraction format '${detectedFormat}'`,
                },
              ],
              isError: true,
            };
        }

        // Execute the extraction command
        if (detectedFormat === "gzip") {
          // For gzip, we need to redirect output to a file
          const result = await processUtils.runProcess(command, args, {
            allowNonZeroExitCode: true,
          });

          if (result.code !== 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error extracting archive: ${result.stderr}`,
                },
              ],
              isError: true,
            };
          }

          // Write the stdout to the destination file
          const baseFilename = path.basename(source, ".gz");
          const destFile = path.join(destination, baseFilename);
          await fs.writeFile(destFile, result.stdout, "binary");
        } else {
          // For zip and tar, the destination is specified in the command
          const result = await processUtils.runProcess(command, args, {
            allowNonZeroExitCode: true,
          });

          if (result.code !== 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error extracting archive: ${result.stderr}`,
                },
              ],
              isError: true,
            };
          }
        }

        logger.info(`Successfully extracted ${source} to ${destination}`);

        return {
          content: [
            {
              type: "text",
              text: `Successfully extracted ${source} to ${destination}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(`Error extracting '${source}' to '${destination}':`, {
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Error extracting archive: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export default {
  registerFileCompressionTools,
};
