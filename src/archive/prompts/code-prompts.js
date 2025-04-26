/**
 * Code Prompts
 * 
 * Prompts for code-related tasks like code review, test generation, etc.
 */

import { z } from 'zod';
import { logger } from '../utils/index.js';

/**
 * Register code-related prompts with the MCP server
 * @param {object} server - The MCP server instance
 */
export function registerCodePrompts(server) {
  logger.info('Registering code-related prompts');
  
  registerCodeReviewPrompt(server);
  registerGenerateTestsPrompt(server);
  registerGenerateDocsPrompt(server);
  registerRefactorCodePrompt(server);
}

/**
 * Register the code-review prompt
 * @param {object} server - The MCP server instance
 */
function registerCodeReviewPrompt(server) {
  server.prompt(
    "code-review", 
    { 
      code: z.string(), 
      language: z.string().optional() 
    }, 
    ({ code, language }) => {
      logger.debug('Creating code-review prompt');
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please review this ${language || "code"}:\n\n${code}\n\nProvide feedback on:\n- Code structure and organization\n- Potential bugs or errors\n- Performance issues\n- Security concerns\n- Readability and maintainability\n- Best practices and coding standards\n`
            }
          }
        ]
      };
    }
  );
}

/**
 * Register the generate-tests prompt
 * @param {object} server - The MCP server instance
 */
function registerGenerateTestsPrompt(server) {
  server.prompt(
    "generate-tests", 
    { 
      code: z.string(), 
      framework: z.string().optional() 
    }, 
    ({ code, framework }) => {
      logger.debug('Creating generate-tests prompt');
      
      const frameworkGuide = framework 
        ? `Use ${framework} as the testing framework.` 
        : "Choose an appropriate testing framework.";
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please write tests for the following code:\n\n${code}\n\n${frameworkGuide}\n\nCreate comprehensive tests that cover:\n- Happy path scenarios\n- Edge cases\n- Error handling\n`
            }
          }
        ]
      };
    }
  );
}

/**
 * Register the generate-docs prompt
 * @param {object} server - The MCP server instance
 */
function registerGenerateDocsPrompt(server) {
  server.prompt(
    "generate-docs", 
    { 
      code: z.string(), 
      format: z.string().optional() 
    }, 
    ({ code, format }) => {
      logger.debug('Creating generate-docs prompt');
      
      const formatGuide = format 
        ? `Use ${format} format for the documentation.` 
        : "Use JSDoc, docstrings, or the appropriate format for the language.";
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please generate documentation for the following code:\n\n${code}\n\n${formatGuide}\n\nInclude:\n- Function/method descriptions\n- Parameter details\n- Return value information\n- Usage examples where appropriate\n`
            }
          }
        ]
      };
    }
  );
}

/**
 * Register the refactor-code prompt
 * @param {object} server - The MCP server instance
 */
function registerRefactorCodePrompt(server) {
  server.prompt(
    "refactor-code", 
    { 
      code: z.string(), 
      language: z.string().optional(),
      goal: z.string().optional()
    }, 
    ({ code, language, goal }) => {
      logger.debug('Creating refactor-code prompt');
      
      const goalInstruction = goal 
        ? `Focus on refactoring for ${goal}.` 
        : "Focus on improving readability, maintainability, and performance.";
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please refactor this ${language || "code"}:\n\n${code}\n\n${goalInstruction}\n\nProvide:\n- The refactored code\n- A brief explanation of the changes made\n- Any potential benefits of the refactoring\n`
            }
          }
        ]
      };
    }
  );
}

export default {
  registerCodePrompts,
};
