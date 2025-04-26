/**
 * Template Tool - April 24, 2025
 *
 * This tool allows generating files from templates:
 * - React component template
 * - Node module template
 * - TypeScript class template
 * - Test file template
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "path";
import fs from "fs/promises";
import { ToolResponse } from "../types/index.js";
import { file as fileUtils, logger } from "../utils/index.js";

/**
 * Register the template generation tool
 * @param {McpServer} server - The MCP server instance
 */
export function registerTemplateTool(server: McpServer): void {
  server.tool(
    "generate_from_template",
    "Tool to generate files from predefined templates like React components, Node modules, TypeScript classes, and test files",
    {
      template: z
        .enum([
          "react-component",
          "node-module",
          "typescript-class",
          "test-file",
        ])
        .describe("Template to use"),
      destination: z.string().describe("Destination path"),
      variables: z.record(z.string()).optional().describe("Template variables"),
    },
    async (
      { template, destination, variables = {} },
      _extra
    ): Promise<ToolResponse> => {
      try {
        // Create parent directories if needed
        const dirPath = path.dirname(destination);
        await fileUtils.ensureDirectory(dirPath);

        // Get the appropriate template
        const templateContent = getTemplateContent(template, variables);

        // Write the file
        await fs.writeFile(destination, templateContent, "utf8");

        logger.info(`Generated ${template} template at ${destination}`);

        return {
          content: [
            {
              type: "text",
              text: `Successfully generated ${template} template at ${destination}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(`Error generating template at '${destination}':`, {
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Error generating template: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Get the content for a specific template
 * @param {string} templateName - Name of the template
 * @param {Record<string, string>} variables - Template variables
 * @returns {string} - The template content with variables replaced
 */
function getTemplateContent(
  templateName: string,
  variables: Record<string, string>
): string {
  let template = "";

  switch (templateName) {
    case "react-component":
      template = `import React from 'react';

interface ${variables.componentName || "Component"}Props {
  ${variables.propsContent || "// Props go here"}
}

const ${variables.componentName || "Component"}: React.FC<${
        variables.componentName || "Component"
      }Props> = ({ ${variables.propsList || "/* props list */"} }) => {
  return (
    <div className="${variables.className || "component"}">
      ${variables.content || "// JSX content goes here"}
    </div>
  );
};

export default ${variables.componentName || "Component"};
`;
      break;

    case "node-module":
      template = `/**
 * ${variables.moduleName || "Module"} - ${
        variables.description || "Description"
      }
 */

${variables.imports || "// Imports go here"}

/**
 * ${variables.functionName || "main"} - ${
        variables.functionDescription || "Main function"
      }
 */
export function ${variables.functionName || "main"}(${
        variables.params || "/* params */"
      }): ${variables.returnType || "void"} {
  ${variables.functionBody || "// Function body goes here"}
}

${variables.additionalExports || "// Additional exports go here"}

export default {
  ${variables.functionName || "main"},
};
`;
      break;

    case "typescript-class":
      template = `/**
 * ${variables.className || "MyClass"} - ${
        variables.description || "Description"
      }
 */

${variables.imports || "// Imports go here"}

export class ${variables.className || "MyClass"} {
  ${variables.properties || "// Properties go here"}

  constructor(${variables.constructorParams || "/* constructor params */"}){
    ${variables.constructorBody || "// Constructor body goes here"}
  }

  ${variables.methods || "// Methods go here"}
}

export default ${variables.className || "MyClass"};
`;
      break;

    case "test-file":
      template = `/**
 * Test for ${variables.testTarget || "MyModule"}
 */

${variables.imports || "// Import test framework and module to test"}

describe('${variables.testDescription || "Test suite"}', () => {
  beforeEach(() => {
    ${variables.beforeEach || "// Setup code goes here"}
  });

  afterEach(() => {
    ${variables.afterEach || "// Teardown code goes here"}
  });

  test('${variables.testName || "should work correctly"}', () => {
    ${variables.testBody || "// Test code goes here"}
  });

  ${variables.additionalTests || "// Additional tests go here"}
});
`;
      break;

    default:
      throw new Error(`Unknown template: ${templateName}`);
  }

  // Replace any remaining variables using the format {{variableName}}
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

export default {
  registerTemplateTool,
};
