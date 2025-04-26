/**
 * Prompts module index
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCodePrompts } from "./code-prompts.js";
import { logger } from "../utils/index.js";

/**
 * Register all prompts with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerPrompts(server: McpServer): void {
  logger.info("Registering all prompts");

  registerCodePrompts(server);
}

export default {
  registerPrompts,
  registerCodePrompts,
};
