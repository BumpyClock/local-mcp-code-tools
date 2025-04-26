/**
 * Resources index
 *
 * Exports all resource registrations
 */

import { registerFileResource } from "./file-resource.js";
import { registerProjectResource } from "./project-resource.js";
import { logger } from "../utils/index.js";

/**
 * Register all resources with the MCP server
 * @param {import('@modelcontextprotocol/sdk/server/mcp').McpServer} server - The MCP server instance
 */
export function registerAllResources(server: any): void {
  logger.info("Registering all resources");
  registerFileResource(server);
  registerProjectResource(server);
}

export { registerFileResource, registerProjectResource };

export default {
  registerAllResources,
  registerFileResource,
  registerProjectResource,
};
