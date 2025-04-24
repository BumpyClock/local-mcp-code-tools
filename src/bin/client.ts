#!/usr/bin/env node

/**
 * CodeTools MCP Client executable
 */

import { runClient } from '../client.js';

// Run the client
runClient()
  .catch((error: Error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
