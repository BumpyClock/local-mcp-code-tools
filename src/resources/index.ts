/**
 * Resources module index
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFileResource } from './file-resource.js';
import { registerProjectResource } from './project-resource.js';
import { logger } from '../utils/index.js';

/**
 * Register all resources with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerResources(server: McpServer): void {
  logger.info('Registering all resources');
  
  registerFileResource(server);
  registerProjectResource(server);
}

export default {
  registerResources,
  registerFileResource,
  registerProjectResource,
};
