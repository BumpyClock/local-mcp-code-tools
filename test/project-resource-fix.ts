/**
 * Project Resource with fixed URI handling
 *
 * Resource for accessing project structure and information
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "path";
import fs from "fs/promises";
import { ResourceResponse } from "../types/index.js";
import { process as processUtils, logger } from "../utils/index.js";

/**
 * Extract a project path from a URL
 * @param {URL} uri - The resource URI
 * @param {Record<string, unknown>} variables - The variables from the resource template
 * @returns {string} The project path
 */
function extractProjectPath(uri: URL, variables: Record<string, unknown>): string {
  logger.debug(`Extracting project path from URI: ${uri.href}`, { 
    protocol: uri.protocol,
    pathname: uri.pathname,
    variables
  });
  
  let projectPath;
  
  // If the URI uses the project: protocol, extract the path directly from the URI
  if (uri.protocol === 'project:') {
    // Extract path from the full URI pathname
    projectPath = decodeURIComponent(uri.pathname);
    
    // On Windows, remove leading slash if present and path has a drive letter
    if (process.platform === 'win32' && projectPath.startsWith('/') && projectPath[2] === ':') {
      projectPath = projectPath.slice(1);
    }
  } else {
    // Fall back to the variables
    if (Array.isArray(variables.path)) {
      projectPath = variables.path[0];
    } else {
      projectPath = String(variables.path);
    }
  }
  
  logger.debug(`Extracted project path: ${projectPath}`);
  
  // Convert to absolute path if relative
  if (!path.isAbsolute(projectPath)) {
    logger.debug(`Converting relative path to absolute: ${projectPath}`);
    projectPath = path.resolve(process.cwd(), projectPath);
  }
  
  return projectPath;
}

/**
 * Register the project resource with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerProjectResource(server: McpServer): void {
  logger.info("Registering project resource with improved URI handling");

  server.resource(
    "project",
    new ResourceTemplate("project://{path*}", { list: undefined }),
    async (
      uri: URL,
      variables: Record<string, unknown>
    ): Promise<ResourceResponse> => {
      // Extract the project path from the URI
      const projectPath = extractProjectPath(uri, variables);
      
      try {
        logger.debug(`Analyzing project structure at: ${projectPath}`);

        // Ensure the path exists
        await fs.stat(projectPath);

        // Get project structure
        const projectStructure = await getProjectStructure(projectPath);

        // Get package.json if it exists
        const packageInfo = await getPackageInfo(projectPath);

        return {
          contents: [
            {
              uri: uri.href,
              text: `Project Structure for ${projectPath}:${packageInfo}\n\nFiles:\n${projectStructure}`,
              mimeType: "text/plain",
            },
          ],
        };
      } catch (error) {
        const err = error as Error;
        logger.error(
          `Failed to analyze project structure at '${projectPath}':`,
          { error: err.message }
        );
        
        // More descriptive error messages
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(`Project directory not found: ${projectPath}. Please check that the path exists.`);
        } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          throw new Error(`Permission denied when accessing project: ${projectPath}. Please check directory permissions.`);
        } else {
          throw new Error(`Failed to analyze project: ${err.message}`);
        }
      }
    }
  );
}

/**
 * Get the project structure using the find command
 * @param {string} projectPath - Path to the project
 * @returns {Promise<string>} Project structure as a string
 */
async function getProjectStructure(projectPath: string): Promise<string> {
  try {
    const { stdout } = await processUtils.runProcess(
      "find",
      [
        projectPath,
        "-type",
        "f",
        "-not",
        "-path",
        "*/node_modules/*",
        "-not",
        "-path",
        "*/.git/*",
      ],
      { allowNonZeroExitCode: true }
    );

    return stdout;
  } catch (error) {
    const err = error as Error;
    logger.warn(
      `Failed to get project structure with find, falling back to readdir`,
      {
        error: err.message,
      }
    );

    // If find fails, fall back to a simpler method
    return getProjectStructureWithFs(projectPath);
  }
}

/**
 * Get the project structure using fs.readdir (fallback)
 * @param {string} projectPath - Path to the project
 * @param {string} [basePath=''] - Base path for recursion
 * @returns {Promise<string>} Project structure as a string
 */
async function getProjectStructureWithFs(
  projectPath: string,
  basePath = ""
): Promise<string> {
  try {
    const entries = await fs.readdir(path.join(projectPath, basePath), {
      withFileTypes: true,
    });

    const result: string[] = [];

    for (const entry of entries) {
      const relativePath = path.join(basePath, entry.name);

      // Skip node_modules and .git
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively get contents of directory
        const subDirContent = await getProjectStructureWithFs(
          projectPath,
          relativePath
        );
        result.push(subDirContent);
      } else {
        // Add file to result
        result.push(path.join(projectPath, relativePath));
      }
    }

    return result.join("\n");
  } catch (error) {
    const err = error as Error;
    logger.error(`Failed to get project structure with fs: ${projectPath}`, {
      error: err.message,
    });
    throw error;
  }
}

/**
 * Interface for package.json structure
 */
interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  dependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Get package.json information
 * @param {string} projectPath - Path to the project
 * @returns {Promise<string>} Package info as a string
 */
async function getPackageInfo(projectPath: string): Promise<string> {
  try {
    const packagePath = path.join(projectPath, "package.json");
    const packageContent = await fs.readFile(packagePath, "utf8");
    const pkg: PackageJson = JSON.parse(packageContent);

    return `\nProject: ${pkg.name}@${pkg.version}
Description: ${pkg.description || "N/A"}
Main: ${pkg.main || "N/A"}
Dependencies: ${Object.keys(pkg.dependencies || {}).join(", ") || "None"}`;
  } catch (error) {
    const err = error as Error;
    logger.debug(`No package.json found or error reading it: ${projectPath}`, {
      error: err.message,
    });
    return "\nNo package.json found";
  }
}

export default {
  registerProjectResource,
};
