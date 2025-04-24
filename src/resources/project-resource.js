/**
 * Project Resource
 * 
 * Resource for accessing project structure and information
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from 'path';
import fs from 'fs/promises';
import { process as processUtils, logger } from '../utils/index.js';

/**
 * Register the project resource with the MCP server
 * @param {object} server - The MCP server instance
 */
export function registerProjectResource(server) {
  logger.info('Registering project resource');
  
  server.resource(
    "project",
    new ResourceTemplate("project://{path}", { list: undefined }),
    async (uri, { path: projectPath }) => {
      try {
        logger.debug(`Analyzing project structure at: ${projectPath}`);
        
        // Ensure the path exists
        await fs.stat(projectPath);
        
        // Get project structure
        const projectStructure = await getProjectStructure(projectPath);
        
        // Get package.json if it exists
        const packageInfo = await getPackageInfo(projectPath);
        
        return {
          contents: [{
            uri: uri.href,
            text: `Project Structure for ${projectPath}:${packageInfo}\n\nFiles:\n${projectStructure}`,
            mimeType: 'text/plain'
          }]
        };
      } catch (error) {
        logger.error(`Failed to analyze project structure at '${projectPath}':`, { error: error.message });
        throw new Error(`Failed to analyze project: ${error.message}`);
      }
    }
  );
}

/**
 * Get the project structure using the find command
 * @param {string} projectPath - Path to the project
 * @returns {Promise<string>} Project structure as a string
 */
async function getProjectStructure(projectPath) {
  try {
    const { stdout } = await processUtils.runProcess('find', [
      projectPath,
      '-type', 'f',
      '-not', '-path', '*/node_modules/*',
      '-not', '-path', '*/.git/*'
    ], { allowNonZeroExitCode: true });
    
    return stdout;
  } catch (error) {
    logger.warn(`Failed to get project structure with find, falling back to readdir`, {
      error: error.message
    });
    
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
async function getProjectStructureWithFs(projectPath, basePath = '') {
  try {
    const entries = await fs.readdir(path.join(projectPath, basePath), { withFileTypes: true });
    
    let result = [];
    
    for (const entry of entries) {
      const relativePath = path.join(basePath, entry.name);
      
      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      
      if (entry.isDirectory()) {
        // Recursively get contents of directory
        const subDirContent = await getProjectStructureWithFs(projectPath, relativePath);
        result.push(subDirContent);
      } else {
        // Add file to result
        result.push(path.join(projectPath, relativePath));
      }
    }
    
    return result.join('\n');
  } catch (error) {
    logger.error(`Failed to get project structure with fs: ${projectPath}`, {
      error: error.message
    });
    throw error;
  }
}

/**
 * Get package.json information
 * @param {string} projectPath - Path to the project
 * @returns {Promise<string>} Package info as a string
 */
async function getPackageInfo(projectPath) {
  try {
    const packagePath = path.join(projectPath, 'package.json');
    const packageContent = await fs.readFile(packagePath, 'utf8');
    const pkg = JSON.parse(packageContent);
    
    return `\nProject: ${pkg.name}@${pkg.version}
Description: ${pkg.description || 'N/A'}
Main: ${pkg.main || 'N/A'}
Dependencies: ${Object.keys(pkg.dependencies || {}).join(', ') || 'None'}`;
  } catch (error) {
    logger.debug(`No package.json found or error reading it: ${projectPath}`, {
      error: error.message
    });
    return '\nNo package.json found';
  }
}

export default {
  registerProjectResource,
};
