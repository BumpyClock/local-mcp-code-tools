/**
 * Project Tools
 * 
 * Tools for project operations like npm initialization and git operations
 */

import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { file as fileUtils, process as processUtils, logger } from '../utils/index.js';

/**
 * Register project tools with the MCP server
 * @param {object} server - The MCP server instance
 */
export function registerProjectTools(server) {
  logger.info('Registering project management tools');
  
  registerInitNpmProjectTool(server);
  registerGitOperationTool(server);
  registerRunCommandTool(server);
  registerPingTool(server);
}

/**
 * Register the init_npm_project tool
 * @param {object} server - The MCP server instance
 */
function registerInitNpmProjectTool(server) {
  server.tool(
    "init_npm_project",
    {
      path: z.string().describe("Path where the project should be initialized."),
      name: z.string().describe("Project name."),
      description: z.string().optional().describe("Project description."),
    },
    async ({ path: projectPath, name, description }) => {
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
            start: "node index.js"
          },
          keywords: [],
          author: "",
          license: "ISC",
          dependencies: {},
          devDependencies: {}
        };
        
        await fs.writeFile(
          path.join(projectPath, 'package.json'), 
          JSON.stringify(packageJson, null, 2), 
          'utf8'
        );
        
        // Create basic index.js file
        const indexJs = `// ${name} - main file\n\nconsole.log('${name} is running!');\n`;
        await fs.writeFile(path.join(projectPath, 'index.js'), indexJs, 'utf8');
        
        // Create README.md
        const readmeMd = `# ${name}\n\n${description || ''}\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n`;
        await fs.writeFile(path.join(projectPath, 'README.md'), readmeMd, 'utf8');
        
        logger.info(`Successfully initialized NPM project '${name}' at ${projectPath}`);
        
        return {
          content: [{ 
            type: "text", 
            text: `Successfully initialized NPM project '${name}' at ${projectPath}` 
          }],
          isError: false,
        };
      } catch (error) {
        logger.error(`Error initializing NPM project at '${projectPath}':`, { error: error.message });
        return {
          content: [{ 
            type: "text", 
            text: `Error initializing NPM project: ${error.message}` 
          }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the git_operation tool
 * @param {object} server - The MCP server instance
 */
function registerGitOperationTool(server) {
  server.tool(
    "git_operation",
    {
      operation: z.enum(["clone", "init", "status", "add", "commit", "push", "pull", "checkout"]).describe("Git operation to perform."),
      path: z.string().describe("Path where the operation should be performed."),
      args: z.string().optional().describe("Additional arguments for the git command."),
    },
    async ({ operation, path: repoPath, args }) => {
      try {
        let command = 'git';
        let argsList = [operation];
        
        if (args) {
          argsList = argsList.concat(args.split(' '));
        }
        
        if (operation === 'clone' && !args) {
          logger.error('Repository URL is required for git clone operation');
          return {
            content: [{ 
              type: "text", 
              text: "Error: Repository URL is required for git clone operation. Use the args parameter to specify it." 
            }],
            isError: true,
          };
        }
        
        const result = await processUtils.runProcess(command, argsList, { 
          cwd: repoPath,
          allowNonZeroExitCode: true
        });
        
        logger.info(`Git ${operation} completed with code ${result.code}`);
        
        return {
          content: [{ 
            type: "text", 
            text: `Git ${operation} result:\n\n${result.stdout}\n\n${result.stderr ? `Errors/Warnings:\n${result.stderr}` : ''}` 
          }],
          isError: result.code !== 0,
        };
      } catch (error) {
        logger.error(`Error performing git operation '${operation}' at '${repoPath}':`, { error: error.message });
        return {
          content: [{ 
            type: "text", 
            text: `Error performing git ${operation}: ${error.message || JSON.stringify(error)}` 
          }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the run_command tool
 * @param {object} server - The MCP server instance
 */
function registerRunCommandTool(server) {
  server.tool(
    "run_command",
    {
      command: z.string().describe("The command to run (e.g., 'npm install express', 'git status')."),
      cwd: z.string().optional().describe("The working directory to run the command in. Defaults to the server's CWD."),
    },
    async ({ command, cwd }) => {
      try {
        const parts = command.split(' ');
        const executable = parts[0];
        const args = parts.slice(1);
        
        logger.info(`Running command: ${executable} ${args.join(' ')}`, { cwd });
        
        const result = await processUtils.runProcess(executable, args, { 
          cwd,
          allowNonZeroExitCode: true
        });
        
        return {
          content: [{ 
            type: "text", 
            text: `Command: ${command}\nExit Code: ${result.code}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}` 
          }],
          isError: result.code !== 0,
        };
      } catch (error) {
        logger.error(`Error executing command '${command}':`, { error: error.message });
        return {
          content: [{ 
            type: "text", 
            text: `Failed to run command: ${error.message || JSON.stringify(error)}` 
          }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the ping tool
 * @param {object} server - The MCP server instance
 */
function registerPingTool(server) {
  server.tool(
    "ping",
    {},
    async () => {
      logger.debug("Received ping request");
      return {
        content: [{ 
          type: "text", 
          text: `Pong! Server is alive. Time: ${new Date().toISOString()}` 
        }],
        isError: false,
      };
    }
  );
}

export default {
  registerProjectTools,
};
