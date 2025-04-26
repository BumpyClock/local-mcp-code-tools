#!/usr/bin/env node

/**
 * CodeTools MCP Server executable
 */

import { startServer } from "../server.js";

// Start the server
startServer().catch((error: Error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
