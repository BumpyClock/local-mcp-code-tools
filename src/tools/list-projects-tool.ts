/**
 * List Projects Tool - April 24, 2025
 *
 * This tool finds and lists projects in the filesystem by searching for package.json files.
 * Includes improved error handling for permission issues and flexible configuration options.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolResponse } from "../types/index.js";
import path from "path";
import fs from "fs/promises";
import { z } from "zod";
import { logger } from "../utils/index.js";

/**
 * Register an improved list_projects tool that finds and lists projects in the filesystem
 * @param server - The MCP server instance
 */
export function registerListProjectsTool(server: McpServer): void {
  server.tool(
    "list_projects",
    "Tool to find and list projects in the filesystem by searching for package.json files, with configurable search depth and base path",
    {
      basePath: z
        .string()
        .optional()
        .describe(
          "Base path to search for projects (default: current directory)"
        ),
      maxDepth: z
        .number()
        .optional()
        .default(4)
        .describe("Maximum directory depth to search"),
    },
    async ({ basePath, maxDepth = 4 }, _extra): Promise<ToolResponse> => {
      try {
        // Use provided base path or default to current directory
        const searchPath = basePath || process.cwd();

        // Search for package.json files to identify projects
        const { process: processUtils } = await import("../utils/index.js");

        logger.info(
          `Searching for projects in ${searchPath} with max depth ${maxDepth}`
        );

        // Use find with 2>/dev/null to suppress permission denied errors
        const command = `find ${searchPath} -name package.json -not -path "*/node_modules/*" -not -path "*/.git/*" -maxdepth ${maxDepth} 2>/dev/null`;

        const { stdout, stderr, code } = await processUtils.runProcess(
          "sh",
          ["-c", command],
          {
            allowNonZeroExitCode: true,
          }
        );

        if (stderr) {
          logger.error("Error executing find command:", {
            error: stderr,
          });
          return {
            content: [
              {
                type: "text",
                text: `Error executing find command: ${stderr} with the code ${code}`,
              },
            ],
            isError: true,
          };
        }

        // If find command returns empty, return empty list
        if (!stdout.trim()) {
          logger.info("No package.json files found");
          return {
            content: [
              {
                type: "text",
                text: `No projects found in ${searchPath}.`,
              },
            ],
            isError: false,
          };
        }

        // Parse the output and create project list
        const projectPaths = stdout.trim().split("\n");
        logger.info(`Found ${projectPaths.length} potential projects`);

        const projectInfo = await Promise.all(
          projectPaths.map(async (packageJsonPath) => {
            try {
              const content = await fs.readFile(packageJsonPath, "utf8");
              const pkg = JSON.parse(content);
              const projectDir = path.dirname(packageJsonPath);

              return {
                name: pkg.name || "unnamed",
                version: pkg.version || "unknown",
                path: projectDir,
                description: pkg.description || "",
                dependencies: Object.keys(pkg.dependencies || {}).length,
                devDependencies: Object.keys(pkg.devDependencies || {}).length,
              };
            } catch (e) {
              logger.error(
                `Error processing package.json at ${packageJsonPath}:`,
                {
                  error: (e as Error).message,
                }
              );
              return null;
            }
          })
        );

        // Filter out nulls and format output
        const validProjects = projectInfo.filter(Boolean);

        if (validProjects.length === 0) {
          logger.info(
            "No valid projects found (could not parse package.json files)"
          );
          return {
            content: [
              {
                type: "text",
                text: `No valid projects found in ${searchPath}.`,
              },
            ],
            isError: false,
          };
        }

        logger.info(`Found ${validProjects.length} valid projects`);

        const formattedOutput = validProjects
          .map((p) => {
            // Add null checks for p
            if (!p) return "Unknown project";

            const dependenciesInfo =
              p.dependencies + p.devDependencies > 0
                ? `Dependencies: ${p.dependencies} prod, ${p.devDependencies} dev`
                : "No dependencies";

            return `${p.name}@${p.version} - ${p.path}\n  ${p.description}\n  ${dependenciesInfo}`;
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${validProjects.length} projects in ${searchPath}:\n\n${formattedOutput}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        logger.error("Error listing projects:", { error: err.message });
        return {
          content: [
            {
              type: "text",
              text: `Error listing projects: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
