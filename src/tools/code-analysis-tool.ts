/**
 * Code Analysis Tool - April 25, 2025
 *
 * This tool provides code analysis capabilities to help understand codebase structure:
 * - Complexity analysis (cyclomatic complexity, nesting depth)
 * - Dependency analysis (imports, requires, module usage)
 * - Pattern detection (design patterns, common code smells)
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "path";
import fs from "fs/promises";
import { ToolResponse } from "../types/index.js";
import { process as processUtils, logger } from "../utils/index.js";

/**
 * Register the code analysis tool
 * @param {McpServer} server - The MCP server instance
 */
export function registerCodeAnalysisTool(server: McpServer): void {
  logger.info("Registering code analysis tool");

  server.tool(
    "analyze_code",
    "Tool to analyze code complexity, dependencies, or patterns in files and directories with customizable output format",
    {
      path: z
        .string()
        .describe("Path to the code file or directory to analyze"),
      type: z
        .enum(["complexity", "dependencies", "patterns"])
        .describe("Type of analysis to perform"),
      format: z
        .enum(["text", "json"])
        .optional()
        .default("text")
        .describe("Output format"),
    },
    async ({ path: codePath, type, format }, _extra): Promise<ToolResponse> => {
      try {
        // Check if path exists
        try {
          await fs.access(codePath);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Path '${codePath}' does not exist`,
              },
            ],
            isError: true,
          };
        }

        // Get file stats to determine if it's a file or directory
        const stats = await fs.stat(codePath);
        const isDirectory = stats.isDirectory();

        // Analyze based on the type
        let result: string = "";

        switch (type) {
          case "complexity":
            result = await analyzeComplexity(codePath, isDirectory, format);
            break;

          case "dependencies":
            result = await analyzeDependencies(codePath, isDirectory, format);
            break;

          case "patterns":
            result = await analyzePatterns(codePath, isDirectory, format);
            break;

          default:
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Unsupported analysis type '${type}'`,
                },
              ],
              isError: true,
            };
        }

        logger.info(`Successfully analyzed '${codePath}' for ${type}`);
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(`Error analyzing '${codePath}':`, {
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing code: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Analyze code complexity
 * @param {string} codePath - Path to the code file or directory
 * @param {boolean} isDirectory - Whether the path is a directory
 * @param {string} format - Output format
 * @returns {Promise<string>} - Analysis result
 */
async function analyzeComplexity(
  codePath: string,
  isDirectory: boolean,
  format: string
): Promise<string> {
  // Use eslint complexity plugin for analysis
  const args = [
    "eslint",
    "--no-eslintrc",
    "--plugin",
    "complexity",
    "--rule",
    "complexity: [error, 5]",
    codePath,
  ];

  const result = await processUtils.runProcess("npx", args, {
    allowNonZeroExitCode: true,
  });

  // Parse the results
  if (format === "json") {
    try {
      // Convert eslint output to JSON format
      const lines = result.stderr.split("\n").filter(Boolean);
      const complexityIssues = lines
        .filter((line) => line.includes("complexity"))
        .map((line) => {
          const match = line.match(/(.+?):(\d+):(\d+):\s+(.+)/);
          if (match) {
            return {
              file: match[1],
              line: parseInt(match[2]),
              column: parseInt(match[3]),
              message: match[4].trim(),
            };
          }
          return null;
        })
        .filter(Boolean);

      return JSON.stringify(
        {
          type: "complexity",
          issues: complexityIssues,
          summary: {
            total: complexityIssues.length,
            highComplexity: complexityIssues.length,
          },
        },
        null,
        2
      );
    } catch (error) {
      const _err = error as Error;
      return JSON.stringify(
        {
          type: "complexity",
          error: "Failed to parse complexity results",
          raw: result.stderr,
        },
        null,
        2
      );
    }
  } else {
    // Return text format
    return `Code Complexity Analysis for ${codePath}:\n\n${
      result.stderr || "No complexity issues found."
    }`;
  }
}

/**
 * Analyze code dependencies
 * @param {string} codePath - Path to the code file or directory
 * @param {boolean} isDirectory - Whether the path is a directory
 * @param {string} format - Output format
 * @returns {Promise<string>} - Analysis result
 */
async function analyzeDependencies(
  codePath: string,
  isDirectory: boolean,
  format: string
): Promise<string> {
  // For a directory with package.json, use npm list
  if (isDirectory) {
    try {
      // Check if package.json exists
      await fs.access(path.join(codePath, "package.json"));

      // Run npm list
      const result = await processUtils.runProcess("npm", ["list", "--json"], {
        cwd: codePath,
        allowNonZeroExitCode: true,
      });

      if (format === "json") {
        return result.stdout;
      } else {
        try {
          const deps = JSON.parse(result.stdout);
          const formatted = formatDependencies(deps);
          return `Dependencies Analysis for ${codePath}:\n\n${formatted}`;
        } catch (error) {
          const err = error as Error;
          return `Dependencies Analysis for ${codePath}:\n\nError parsing dependencies: ${err.message}\n\nRaw output:\n${result.stdout}`;
        }
      }
    } catch (error) {
      // No package.json, use static analysis
      return analyzeImports(codePath, isDirectory, format);
    }
  } else {
    // For a single file, analyze imports
    return analyzeImports(codePath, isDirectory, format);
  }
}

/**
 * Analyze code imports
 * @param {string} codePath - Path to the code file or directory
 * @param {boolean} isDirectory - Whether the path is a directory
 * @param {string} format - Output format
 * @returns {Promise<string>} - Analysis result
 */
async function analyzeImports(
  codePath: string,
  isDirectory: boolean,
  format: string
): Promise<string> {
  // Use grep to find import statements
  const pattern = "import|require";

  const args = isDirectory
    ? ["-r", "-n", "--include=*.{js,ts,jsx,tsx}", pattern, codePath]
    : ["-n", pattern, codePath];

  const result = await processUtils.runProcess("grep", args, {
    allowNonZeroExitCode: true,
  });

  if (format === "json") {
    try {
      const lines = result.stdout.split("\n").filter(Boolean);
      const imports = lines
        .map((line) => {
          const match = line.match(/(.+?):(\d+):(.*)/);
          if (match) {
            return {
              file: match[1],
              line: parseInt(match[2]),
              import: match[3].trim(),
            };
          }
          return null;
        })
        .filter(Boolean);

      return JSON.stringify(
        {
          type: "imports",
          imports,
          summary: {
            total: imports.length,
          },
        },
        null,
        2
      );
    } catch (error) {
      const _err = error as Error;
      return JSON.stringify(
        {
          type: "imports",
          error: "Failed to parse import results",
          raw: result.stdout,
        },
        null,
        2
      );
    }
  } else {
    // Return text format
    return `Code Imports Analysis for ${codePath}:\n\n${
      result.stdout || "No imports found."
    }`;
  }
}

/**
 * Format dependencies
 * @param {object} deps - Dependencies object
 * @param {number} level - Indentation level
 * @returns {string} - Formatted dependencies
 */
function formatDependencies(
  deps: {
    dependencies?: Record<
      string,
      { version?: string; dependencies?: Record<string, unknown> }
    >;
  },
  level: number = 0
): string {
  if (!deps || !deps.dependencies) {
    return "No dependencies found.";
  }

  const indent = "  ".repeat(level);
  let result = "";

  for (const [name, info] of Object.entries<{
    version?: string;
    dependencies?: Record<string, unknown>;
  }>(deps.dependencies)) {
    result += `${indent}• ${name}@${info.version || "unknown"}\n`;

    if (info.dependencies && Object.keys(info.dependencies).length > 0) {
      result += formatDependencies(
        {
          dependencies: info.dependencies as Record<
            string,
            { version?: string; dependencies?: Record<string, unknown> }
          >,
        },
        level + 1
      );
    }
  }

  return result;
}

/**
 * Analyze code patterns
 * @param {string} codePath - Path to the code file or directory
 * @param {boolean} isDirectory - Whether the path is a directory
 * @param {string} format - Output format
 * @returns {Promise<string>} - Analysis result
 */
async function analyzePatterns(
  codePath: string,
  isDirectory: boolean,
  format: string
): Promise<string> {
  // Define patterns to look for
  const patterns = [
    {
      name: "Potential Memory Leaks",
      pattern: "addEventListener|setInterval|setTimeout",
    },
    {
      name: "Console Statements",
      pattern: "console\\.(log|warn|error|info|debug)",
    },
    { name: "TODO Comments", pattern: "TODO|FIXME|HACK|XXX" },
    { name: "Magic Numbers", pattern: "[^\\w'\"](\\d{3,})[^\\w]" },
    { name: "Callback Hell", pattern: "\\){\\s*[^\\n]*=>\\s*{" },
    {
      name: "Large Functions",
      pattern: "function\\s+[^(]*\\([^)]*\\)\\s*{[\\s\\S]{500,}?}",
    },
  ];

  // Run analysis for each pattern
  const results = await Promise.all(
    patterns.map(async ({ name, pattern }) => {
      const args = isDirectory
        ? ["-r", "-l", "--include=*.{js,ts,jsx,tsx}", pattern, codePath]
        : ["-l", pattern, codePath];

      const result = await processUtils.runProcess("grep", args, {
        allowNonZeroExitCode: true,
      });

      const count = result.stdout
        ? result.stdout.split("\n").filter(Boolean).length
        : 0;

      return {
        name,
        pattern,
        files: result.stdout ? result.stdout.split("\n").filter(Boolean) : [],
        count,
      };
    })
  );

  if (format === "json") {
    return JSON.stringify(
      {
        type: "patterns",
        patterns: results,
        summary: {
          total: results.reduce((sum, r) => sum + r.count, 0),
        },
      },
      null,
      2
    );
  } else {
    // Return text format
    let output = `Code Patterns Analysis for ${codePath}:\n\n`;

    for (const result of results) {
      output += `${result.name}: ${result.count} instance(s)\n`;
      if (result.count > 0) {
        output += `  Files: ${result.files.join(", ")}\n`;
      }
      output += "\n";
    }

    return output;
  }
}

export default {
  registerCodeAnalysisTool,
};
