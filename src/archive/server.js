/**
 * CodeTools MCP Server
 * 
 * Main server implementation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import modules
import { logger } from './utils/index.js';
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

/**
 * Create and configure the MCP server
 * @returns {Promise<object>} The configured MCP server
 */
export async function createServer() {
  // Create an MCP server
  const server = new McpServer({
    name: "CodeTools",
    version: "1.0.0",
    capabilities: {
      tools: { listChanged: true },
      resources: { listChanged: true },
      prompts: { listChanged: true },
    },
  });

  // Register all modules
  registerTools(server);
  registerResources(server);
  registerPrompts(server);
  
  return server;
}

/**
 * Start the MCP server with stdio transport
 * @returns {Promise<void>}
 */
export async function startServer() {
  try {
    logger.info("Starting CodeTools MCP server...");
    
    const server = await createServer();
    const transport = new StdioServerTransport();
    
    logger.info("Connecting to transport...");
    await server.connect(transport);
    
    logger.info("Server connected and ready");
    
    // Keep server running until transport closes
    await new Promise((resolve) => {
      transport.onclose = resolve;
    });
    
    logger.info("Transport closed, shutting down server");
  } catch (error) {
    logger.error("Fatal error starting or connecting server", { error: error.message });
    process.exit(1);
  }
}

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
    .catch((error) => {
      logger.error("Unhandled error", { error: error.message });
      process.exit(1);
    });
}
