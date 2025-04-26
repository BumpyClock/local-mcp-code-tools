/**
 * Tools module index - April 24, 2025
 * 
 * This module registers all available tools with the MCP server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFileTools } from "./file-tools.js";
import { registerProjectTools } from "./project-tools.js";
import { registerFileDiffTool } from "./file-diff-tool.js";
import { registerListProjectsTool } from "./list-projects-tool.js";
import { registerFileConversionTool } from "./file-conversion-tool.js";
import { registerTemplateTool } from "./template-tool.js";
import { registerFileMoveCopyTools } from "./file-move-copy-tool.js";
import { registerFileCompressionTools } from "./file-compression-tool.js";
import { registerCodeAnalysisTool } from "./code-analysis-tool.js";
import { logger } from "../utils/index.js";

/**
 * Register all tools with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerTools(server: McpServer): void {
  logger.info("Registering all tools");

  // Register core tools
  registerFileTools(server);
  registerProjectTools(server);
  registerFileDiffTool(server);
  
  // Register improved tools
  registerListProjectsTool(server);
  
  // Register new tools
  registerFileConversionTool(server);
  registerTemplateTool(server);
  registerFileMoveCopyTools(server);
  registerFileCompressionTools(server);
  registerCodeAnalysisTool(server);
}

export default {
  registerTools,
  registerFileTools,
  registerProjectTools,
  registerFileDiffTool,
  registerListProjectsTool,
  registerFileConversionTool,
  registerTemplateTool,
  registerFileMoveCopyTools,
  registerFileCompressionTools,
  registerCodeAnalysisTool,
};
