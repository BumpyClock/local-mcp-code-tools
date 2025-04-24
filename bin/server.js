#!/usr/bin/env node

/**
 * CodeTools MCP Server executable
 */

import { startServer } from '../src/server.js';

// Start the server
startServer()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
