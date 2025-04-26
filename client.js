import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { spawn } from "child_process";
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { setTimeout } from "timers/promises";
import fs from 'fs/promises';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the server script
const serverPath = resolve(__dirname, "./dist/server.js");

/**
 * Format a test result for display
 * @param {string} testName - The name of the test
 * @param {boolean} success - Whether the test succeeded
 * @param {any} result - The result data
 * @param {Error} [error] - Any error that occurred
 * @returns {string} Formatted test result
 */
function formatTestResult(testName, success, result, error) {
  const status = success ? '✅ PASSED' : '❌ FAILED';
  let output = `${status} | ${testName}\n`;
  
  if (success) {
    if (result) {
      // If result is an object with 'content' property, format it nicely
      if (result.content && Array.isArray(result.content)) {
        output += '  Result: ' + result.content.map(c => c.text || '[binary data]').join('\n  ');
      } else {
        output += '  Result: ' + JSON.stringify(result).substring(0, 150) + (JSON.stringify(result).length > 150 ? '...' : '');
      }
    }
  } else {
    output += `  Error: ${error?.message || 'Unknown error'}`;
    if (error?.stack) {
      output += `\n  Stack: ${error.stack.split('\n')[1]}`;
    }
  }
  
  return output;
}

/**
 * Run a test and report results
 * @param {function} testFn - The test function to run
 * @param {string} testName - The name of the test
 * @returns {Promise<{success: boolean, result?: any, error?: Error}>} Test result
 */
async function runTest(testFn, testName) {
  try {
    console.log(`🔄 Running test: ${testName}...`);
    const result = await testFn();
    console.log(formatTestResult(testName, true, result));
    return { success: true, result };
  } catch (error) {
    console.log(formatTestResult(testName, false, null, error));
    return { success: false, error };
  }
}

/**
 * Create a test file with sample content
 * @returns {Promise<string>} Path to the created file
 */
async function createTestFile() {
  const testFilePath = join(__dirname, 'test-sample.js');
  const content = `/**
 * Test sample file
 */

function add(a, b) {
  return a + b;
}

module.exports = { add };
`;
  
  await fs.writeFile(testFilePath, content, 'utf8');
  return testFilePath;
}

/**
 * Run all tests against the MCP server
 * @param {boolean} useHttp - Whether to use HTTP transport
 * @param {string} [httpUrl] - The HTTP URL if using HTTP transport
 */
async function runClient(useHttp = false, httpUrl = 'http://localhost:3000/mcp') {
  let client;
  let transport;
  let testFilePath;
  
  try {
    console.log("Starting MCP test client...");
    console.log("==========================");
    
    // Create a test file
    testFilePath = await createTestFile();
    console.log(`Created test file at: ${testFilePath}`);
    
    // Create appropriate transport
    if (useHttp) {
      console.log(`Using HTTP transport: ${httpUrl}`);
      transport = new StreamableHTTPClientTransport(new URL(httpUrl));
    } else {
      console.log("Using stdio transport");
      transport = new StdioClientTransport({
        command: "node",
        args: [serverPath],
      });
    }
    
    // Create a client
    client = new Client({
      name: "code-tools-test-client",
      version: "1.0.0",
    });
    
    // Connect to the server
    console.log("Connecting to server...");
    await client.connect(transport);
    console.log("Connected to server!\n");
    
    // Run all tests
    const testResults = [];
    
    // Test ping tool
    testResults.push(await runTest(
      async () => client.callTool({ name: "ping", arguments: {} }),
      "Ping Tool"
    ));
    
    // Test list_directory tool
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "list_directory", 
        arguments: { path: __dirname } 
      }),
      "List Directory Tool"
    ));
    
    // Test search_files tool
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "search_files", 
        arguments: { 
          pattern: "function", 
          path: testFilePath 
        } 
      }),
      "Search Files Tool"
    ));
    
    // Test file resource
    testResults.push(await runTest(
      async () => client.readResource({
        uri: `file://${testFilePath}`,
      }),
      "File Resource - Read File"
    ));
    
    // Test directory resource
    testResults.push(await runTest(
      async () => client.readResource({
        uri: `file://${__dirname}`,
      }),
      "File Resource - Read Directory"
    ));
    
    // Test code review prompt
    testResults.push(await runTest(
      async () => {
        const sampleCode = `function add(a, b) { return a + b; }`;
        
        return client.getPrompt({
          name: "code-review",
          arguments: {
            code: sampleCode,
            language: "javascript",
          },
        });
      },
      "Code Review Prompt"
    ));
    
    // Print summary
    console.log("\n==========================");
    console.log("Test Summary:");
    const passed = testResults.filter(r => r.success).length;
    const failed = testResults.filter(r => !r.success).length;
    console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${testResults.length}`);
    
    if (failed > 0) {
      console.log("\nFailed Tests:");
      testResults.filter(r => !r.success).forEach((result, i) => {
        console.log(`${i+1}. ${result.error?.message || 'Unknown error'}`);
      });
    }
    
  } catch (error) {
    console.error("Fatal error:", error.message);
    console.error(error.stack);
  } finally {
    // Close the connection
    if (client) {
      console.log("\nClosing connection...");
      await client.close();
      console.log("Connection closed!");
    }
    
    // Clean up test file
    if (testFilePath) {
      try {
        await fs.unlink(testFilePath);
        console.log(`Cleaned up test file: ${testFilePath}`);
      } catch (e) {
        console.warn(`Warning: Failed to clean up test file: ${e.message}`);
      }
    }
  }
}

// Allow specifying transport via command line
const useHttp = process.argv.includes('--http');
const httpUrl = process.argv.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'http://localhost:3000/mcp';

runClient(useHttp, httpUrl);
