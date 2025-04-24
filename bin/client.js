#!/usr/bin/env node

/**
 * CodeTools MCP Client executable
 */

import { runClient } from '../src/client.js';

// Run the client
runClient()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
