/**
 * CodeTools MCP Client
 * 
 * Test client for the MCP server
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the server script
const serverPath = resolve(__dirname, "./server.js");

/**
 * Run a test client connecting to the server
 * @returns {Promise<void>}
 */
export async function runClient(): Promise<void> {
  try {
    console.log("Starting CodeTools MCP client...");
    
    // Create a transport that spawns the server script
    const transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
    });
    
    // Create a client
    const client = new Client({
      name: "code-tools-client",
      version: "1.0.0",
    });
    
    // Connect to the server
    console.log("Connecting to server...");
    await client.connect(transport);
    console.log("Connected to server!");
    
    // Test the ping tool
    console.log("\nTesting ping tool...");
    const pingResult = await client.callTool({
      name: "ping",
      arguments: {},
    });
    console.log("Ping result:", pingResult);
    
    // Test the file resource
    console.log("\nTesting file resource...");
    const fileResult = await client.readResource({
      uri: `file://${resolve(__dirname, "../package.json")}`,
    });
    console.log("File resource result:", fileResult);
    
    // Test the code review prompt
    console.log("\nTesting code review prompt...");
    const sampleCode = `function add(a, b) {
  return a + b;
}`;
    
    const promptResult = await client.getPrompt({
      name: "code-review",
      arguments: {
        code: sampleCode,
        language: "javascript",
      },
    });
    console.log("Prompt result:", promptResult);
    
    // Close the connection
    console.log("\nClosing connection...");
    await client.close();
    console.log("Connection closed!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Only run the client if this file is run directly
if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  runClient()
    .catch((error: Error) => {
      console.error("Unhandled error:", error);
      process.exit(1);
    });
}
