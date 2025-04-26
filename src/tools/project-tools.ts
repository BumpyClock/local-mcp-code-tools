/**
 * Project Tools
 *
 * Tools for project operations like npm initialization and git operations
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
 * Register project tools with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerProjectTools(server: McpServer): void {
  logger.info("Registering project management tools");

  registerInitNpmProjectTool(server);
  registerGitOperationTool(server);
  registerRunCommandTool(server);
  registerPingTool(server);
  registerCreateProjectTool(server);
  registerGitTool(server);
  registerShellTool(server);
  // registerListProjectsTool is now called directly from index.ts
}

/**
 * Register the init_npm_project tool
 * @param {McpServer} server - The MCP server instance
 */
function registerInitNpmProjectTool(server: McpServer): void {
  server.tool(
    "init_npm_project",
    "Tool to initialize a new NPM project with package.json, index.js, and README.md",
    {
      path: z
        .string()
        .describe("Path where the project should be initialized."),
      name: z.string().describe("Project name."),
      description: z.string().optional().describe("Project description."),
    },
    async (
      { path: projectPath, name, description },
      _extra
    ): Promise<ToolResponse> => {
      try {
        // Create directory if it doesn't exist
        await fileUtils.ensureDirectory(projectPath);

        // Create a package.json file
        const packageJson = {
          name,
          version: "1.0.0",
          description: description || "",
          main: "index.js",
          type: "module",
          scripts: {
            start: "node index.js",
          },
          keywords: [],
          author: "",
          license: "ISC",
          dependencies: {},
          devDependencies: {},
        };

        await fs.writeFile(
          path.join(projectPath, "package.json"),
          JSON.stringify(packageJson, null, 2),
          "utf8"
        );

        // Create basic index.js file
        const indexJs = `// ${name} - main file\n\nconsole.log('${name} is running!');\n`;
        await fs.writeFile(path.join(projectPath, "index.js"), indexJs, "utf8");

        // Create README.md
        const readmeMd = `# ${name}\n\n${
          description || ""
        }\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n`;
        await fs.writeFile(
          path.join(projectPath, "README.md"),
          readmeMd,
          "utf8"
        );

        logger.info(
          `Successfully initialized NPM project '${name}' at ${projectPath}`
        );

        return {
          content: [
            {
              type: "text",
              text: `Successfully initialized NPM project '${name}' at ${projectPath}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(`Error initializing NPM project at '${projectPath}':`, {
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Error initializing NPM project: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the git_operation tool
 * @param {McpServer} server - The MCP server instance
 */
function registerGitOperationTool(server: McpServer): void {
  server.tool(
    "git_operation",
    "Tool to perform git operations like clone, init, status, add, commit, push, pull, and checkout",
    {
      operation: z
        .enum([
          "clone",
          "init",
          "status",
          "add",
          "commit",
          "push",
          "pull",
          "checkout",
        ])
        .describe("Git operation to perform."),
      path: z
        .string()
        .describe("Path where the operation should be performed."),
      args: z
        .string()
        .optional()
        .describe("Additional arguments for the git command."),
    },
    async (
      { operation, path: repoPath, args },
      _extra
    ): Promise<ToolResponse> => {
      try {
        const command = "git";
        let argsList: string[] = [operation];

        if (args) {
          argsList = argsList.concat(args.split(" ") as string[]);
        }

        if (operation === "clone" && !args) {
          logger.error("Repository URL is required for git clone operation");
          return {
            content: [
              {
                type: "text",
                text: "Error: Repository URL is required for git clone operation. Use the args parameter to specify it.",
              },
            ],
            isError: true,
          };
        }

        const result = await processUtils.runProcess(command, argsList, {
          cwd: repoPath,
          allowNonZeroExitCode: true,
        });

        logger.info(`Git ${operation} completed with code ${result.code}`);

        return {
          content: [
            {
              type: "text",
              text: `Git ${operation} result:\n\n${result.stdout}\n\n${
                result.stderr ? `Errors/Warnings:\n${result.stderr}` : ""
              }`,
            },
          ],
          isError: result.code !== 0,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(
          `Error performing git operation '${operation}' at '${repoPath}':`,
          { error: err.message }
        );
        return {
          content: [
            {
              type: "text",
              text: `Error performing git ${operation}: ${
                err.message || JSON.stringify(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the run_command tool
 * @param {McpServer} server - The MCP server instance
 */
function registerRunCommandTool(server: McpServer): void {
  server.tool(
    "run_command",
    "Tool to execute shell commands like 'npm install', 'git status', etc. with the ability to specify working directory",
    {
      command: z
        .string()
        .describe(
          "The command to run (e.g., 'npm install express', 'git status')."
        ),
      cwd: z
        .string()
        .optional()
        .describe(
          "The working directory to run the command in. Defaults to the server's CWD."
        ),
    },
    async ({ command, cwd }, _extra): Promise<ToolResponse> => {
      try {
        const parts = command.split(" ");
        const executable = parts[0];
        const args = parts.slice(1);

        logger.info(`Running command: ${executable} ${args.join(" ")}`, {
          cwd,
        });

        const result = await processUtils.runProcess(executable, args, {
          cwd,
          allowNonZeroExitCode: true,
        });

        return {
          content: [
            {
              type: "text",
              text: `Command: ${command}\nExit Code: ${result.code}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`,
            },
          ],
          isError: result.code !== 0,
        };
      } catch (error) {
        const err = error as Error;
        logger.error(`Error executing command '${command}':`, {
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Failed to run command: ${
                err.message || JSON.stringify(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the ping tool
 * @param {McpServer} server - The MCP server instance
 */
function registerPingTool(server: McpServer): void {
  server.tool(
    "ping",
    "Tool to check if the server is alive and responsive by returning a pong message with timestamp",
    {},
    async (_args, _extra): Promise<ToolResponse> => {
      logger.debug("Received ping request");
      return {
        content: [
          {
            type: "text",
            text: `Pong! Server is alive. Time: ${new Date().toISOString()}`,
          },
        ],
        isError: false,
      };
    }
  );
}

/**
 * Register the create_project tool
 * @param {McpServer} server - The MCP server instance
 */
function registerCreateProjectTool(server: McpServer): void {
  server.tool(
    "create_project",
    "Tool to create a minimal project structure with a package.json file",
    {
      path: z.string().describe("Path to the project directory."),
      name: z.string().describe("Name of the project."),
      description: z
        .string()
        .optional()
        .describe("Description of the project."),
    },
    async (
      { path: projectPath, name, description },
      _extra
    ): Promise<ToolResponse> => {
      try {
        await fs.mkdir(projectPath, { recursive: true });
        const pkg = {
          name,
          version: "1.0.0",
          description: description || "",
          main: "index.js",
        };
        await fs.writeFile(
          path.join(projectPath, "package.json"),
          JSON.stringify(pkg, null, 2),
          "utf8"
        );
        return {
          content: [
            {
              type: "text",
              text: `Project created at ${projectPath}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error creating project: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the git tool
 * @param {McpServer} server - The MCP server instance
 */
function registerGitTool(server: McpServer): void {
  server.tool(
    "git",
    "Tool to perform git operations like clone, init, status, add, commit, push, pull, and checkout on a git repository",
    {
      operation: z
        .enum([
          "clone",
          "init",
          "status",
          "add",
          "commit",
          "push",
          "pull",
          "checkout",
        ])
        .describe("Git operation to perform."),
      path: z
        .string()
        .describe("Path to the git repository or target directory."),
      args: z
        .string()
        .optional()
        .describe("Additional arguments for the git command."),
    },
    async (
      { operation, path: repoPath, args },
      _extra
    ): Promise<ToolResponse> => {
      try {
        const { process: processUtils } = await import("../utils/index.js");
        const command = "git";
        let argsList: string[] = [operation];
        if (args) {
          argsList = argsList.concat(args.split(" ") as string[]);
        }
        const { stdout, stderr, code } = await processUtils.runProcess(
          command,
          argsList,
          { cwd: repoPath, allowNonZeroExitCode: true }
        );
        if (code !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Git error: ${stderr || stdout}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Git output:\n${stdout}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error running git: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the shell tool
 * @param {McpServer} server - The MCP server instance
 */
function registerShellTool(server: McpServer): void {
  server.tool(
    "shell",
    "Tool to execute shell commands with full shell support including pipes, redirections, and environment variables",
    {
      command: z.string().describe("Shell command to execute."),
      cwd: z.string().optional().describe("Working directory for the command."),
    },
    async ({ command, cwd }, _extra): Promise<ToolResponse> => {
      try {
        const { process: processUtils } = await import("../utils/index.js");
        const { stdout, stderr, code } = await processUtils.runProcess(
          command,
          [],
          { cwd, allowNonZeroExitCode: true, shell: true }
        );
        if (code !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Shell error: ${stderr || stdout}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Shell output:\n${stdout}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error running shell command: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export default {
  registerProjectTools,
};
