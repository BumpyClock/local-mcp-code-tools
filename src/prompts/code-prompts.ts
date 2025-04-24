/**
 * Code Prompts
 *
 * Prompts for code-related tasks like code review, test generation, etc.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../utils/index.js";

/**
 * Register code-related prompts with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerCodePrompts(server: McpServer): void {
  logger.info("Registering code-related prompts");

  registerCodeReviewPrompt(server);
  registerGenerateTestsPrompt(server);
  registerGenerateDocsPrompt(server);
  registerRefactorCodePrompt(server);
}

/**
 * Register the code-review prompt
 * @param {McpServer} server - The MCP server instance
 */
function registerCodeReviewPrompt(server: McpServer): void {
  server.prompt(
    "code-review",
    {
      code: z.string(),
      language: z.string().optional(),
    },
    ({ code, language }, _extra) => {
      logger.debug("Creating code-review prompt");
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please review this ${
                language || "code"
              }:\n\n${code}\n\nProvide a detailed code review including:\n- Bugs or logic errors\n- Performance issues\n- Security vulnerabilities\n- Code quality and readability issues\n- Suggestions for improvements\n`,
            },
          },
        ],
      };
    }
  );
}

/**
 * Register the generate-tests prompt
 * @param {McpServer} server - The MCP server instance
 */
function registerGenerateTestsPrompt(server: McpServer): void {
  server.prompt(
    "generate-tests",
    {
      code: z.string(),
      language: z.string().optional(),
      framework: z.string().optional(),
    },
    ({ code, language, framework }, _extra) => {
      logger.debug("Creating generate-tests prompt");
      const frameworkSpecificInstructions = framework
        ? `Use the ${framework} testing framework.`
        : "Choose an appropriate testing framework for this language.";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please generate tests for this ${
                language || "code"
              }:\n\n${code}\n\n${frameworkSpecificInstructions}\n\nThe tests should be comprehensive and cover:\n- Normal use cases\n- Edge cases\n- Error cases`,
            },
          },
        ],
      };
    }
  );
}

/**
 * Register the generate-docs prompt
 * @param {McpServer} server - The MCP server instance
 */
function registerGenerateDocsPrompt(server: McpServer): void {
  server.prompt(
    "generate-docs",
    {
      code: z.string(),
      language: z.string().optional(),
      style: z.string().optional(),
    },
    ({ code, language, style }, _extra) => {
      logger.debug("Creating generate-docs prompt");
      const styleInstructions = style
        ? `Use ${style} documentation style.`
        : "Use the common documentation style for this language.";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please generate documentation for this ${
                language || "code"
              }:\n\n${code}\n\n${styleInstructions}\n\nInclude:\n- Overview of what the code does\n- Function/method/class descriptions\n- Parameter and return value documentation\n- Usage examples`,
            },
          },
        ],
      };
    }
  );
}

/**
 * Register the refactor-code prompt
 * @param {McpServer} server - The MCP server instance
 */
function registerRefactorCodePrompt(server: McpServer): void {
  server.prompt(
    "refactor-code",
    {
      code: z.string(),
      language: z.string().optional(),
      goal: z.string().optional(),
    },
    ({ code, language, goal }, _extra) => {
      logger.debug("Creating refactor-code prompt");

      const goalInstruction = goal
        ? `Focus on refactoring for ${goal}.`
        : "Focus on improving readability, maintainability, and performance.";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please refactor this ${
                language || "code"
              }:\n\n${code}\n\n${goalInstruction}\n\nProvide:\n- The refactored code\n- A brief explanation of the changes made\n- Any potential benefits of the refactoring\n`,
            },
          },
        ],
      };
    }
  );
}

export default {
  registerCodePrompts,
};
