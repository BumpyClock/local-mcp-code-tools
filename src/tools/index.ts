/**
 * Tools module index
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFileTools } from './file-tools.js';
import { registerProjectTools } from './project-tools.js';
import { logger } from '../utils/index.js';

/**
 * Register all tools with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerTools(server: McpServer): void {
  logger.info('Registering all tools');
  
  registerFileTools(server);
  registerProjectTools(server);
}

export default {
  registerTools,
  registerFileTools,
  registerProjectTools,
};
