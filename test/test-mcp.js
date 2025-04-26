import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import fs from 'fs/promises';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Path to the server script
const serverPath = resolve(projectRoot, "./dist/bin/server.js");

/**
 * Format a test result for display
 */
function formatTestResult(testName, success, result, error) {
  const status = success ? '✅ PASSED' : '❌ FAILED';
  let output = `${status} | ${testName}\n`;
  
  if (success) {
    if (result) {
      output += '  Result: ' + JSON.stringify(result).substring(0, 100) + '...';
    }
  } else {
    output += `  Error: ${error?.message || 'Unknown error'}`;
  }
  
  return output;
}

/**
 * Run a test and report results
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
 * Run all tests against the MCP server
 */
async function runTests() {
  let client;
  let transport;
  
  try {
    console.log("Starting MCP comprehensive test client...");
    console.log("========================================");
    
    // Create a client using stdio transport
    transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
    });
    
    client = new Client({
      name: "code-tools-test-client",
      version: "1.0.0",
    });
    
    // Connect to the server
    console.log("Connecting to server...");
    await client.connect(transport);
    console.log("Connected successfully!\n");
    
    // Run all tests
    const testResults = [];
    
    // ---- Test Tools ----
    console.log("\n=== Testing Tools ===");
    
    // 1. Ping tool
    testResults.push(await runTest(
      async () => client.callTool({ name: "ping", arguments: {} }),
      "Ping Tool"
    ));
    
    // 2. List directory tool
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "list_directory", 
        arguments: { path: __dirname } 
      }),
      "List Directory Tool"
    ));
    
    // 3. Create directory tool
    const newDirPath = join(__dirname, 'test-create-dir');
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "create_directory", 
        arguments: { 
          path: newDirPath,
          parents: true
        } 
      }),
      "Create Directory Tool"
    ));
    
    // 4. Search files tool
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "search_files", 
        arguments: { 
          pattern: "function", 
          path: __dirname,
          recursive: true
        } 
      }),
      "Search Files Tool"
    ));
    
    // 5. Update file tool
    const testUpdateFilePath = join(__dirname, 'test-update-file.js');
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "update_file", 
        arguments: { 
          filePath: testUpdateFilePath,
          newContent: "// This is a test file created by update_file tool\nconsole.log('Hello, MCP!');"
        } 
      }),
      "Update File Tool"
    ));
    
    // 6. Apply patch tool
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "apply_patch", 
        arguments: { 
          filePath: testUpdateFilePath,
          unifiedDiff: `--- test-update-file.js\n+++ test-update-file.js\n@@ -1,2 +1,3 @@\n // This is a test file created by update_file tool\n console.log('Hello, MCP!');\n+console.log('This line was added by apply_patch tool');`
        } 
      }),
      "Apply Patch Tool"
    ));
    
    // 7. Run command tool
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "run_command", 
        arguments: { 
          command: "echo 'Testing run_command tool'",
          cwd: __dirname
        } 
      }),
      "Run Command Tool"
    ));
    
    // 8. Create project tool
    const testProjectPath = join(__dirname, 'test-project-tool');
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "create_project", 
        arguments: { 
          path: testProjectPath,
          name: "test-project",
          description: "Project created by create_project tool"
        } 
      }),
      "Create Project Tool"
    ));
    
    // 9. Init npm project tool
    const npmProjectPath = join(__dirname, 'test-npm-project');
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "init_npm_project", 
        arguments: { 
          path: npmProjectPath,
          name: "test-npm-project",
          description: "Project created by init_npm_project tool"
        } 
      }),
      "Init NPM Project Tool"
    ));
    
    // 10. List projects tool
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "list_projects", 
        arguments: {} 
      }),
      "List Projects Tool"
    ));
    
    // 11. Shell tool
    testResults.push(await runTest(
      async () => client.callTool({ 
        name: "shell", 
        arguments: { 
          command: "ls -la",
          cwd: __dirname
        } 
      }),
      "Shell Tool"
    ));
    
    // ---- Test Resources ----
    console.log("\n=== Testing Resources ===");
    
    // 1. File resource - Read file
    testResults.push(await runTest(
      async () => client.readResource({
        uri: `file://${join(__dirname, 'test-sample.js')}`,
      }),
      "File Resource - Read File"
    ));
    
    // 2. File resource - Read directory
    testResults.push(await runTest(
      async () => client.readResource({
        uri: `file://${__dirname}`,
      }),
      "File Resource - Read Directory"
    ));
    
    // 3. Project resource
    testResults.push(await runTest(
      async () => client.readResource({
        uri: `project://${join(__dirname, 'project-test')}`,
      }),
      "Project Resource"
    ));
    
    // ---- Test Prompts ----
    console.log("\n=== Testing Prompts ===");
    
    // 1. Code Review prompt
    testResults.push(await runTest(
      async () => {
        const code = await fs.readFile(join(__dirname, 'complex-sample.js'), 'utf8');
        return client.getPrompt({
          name: "code-review",
          arguments: {
            code: code,
            language: "javascript",
          },
        });
      },
      "Code Review Prompt"
    ));
    
    // 2. Generate Tests prompt
    testResults.push(await runTest(
      async () => {
        const code = await fs.readFile(join(__dirname, 'test-sample.js'), 'utf8');
        return client.getPrompt({
          name: "generate-tests",
          arguments: {
            code: code,
            language: "javascript",
            framework: "jest",
          },
        });
      },
      "Generate Tests Prompt"
    ));
    
    // 3. Generate Docs prompt
    testResults.push(await runTest(
      async () => {
        const code = await fs.readFile(join(__dirname, 'test-sample.py'), 'utf8');
        return client.getPrompt({
          name: "generate-docs",
          arguments: {
            code: code,
            language: "python",
            style: "Google",
          },
        });
      },
      "Generate Docs Prompt"
    ));
    
    // 4. Refactor Code prompt
    testResults.push(await runTest(
      async () => {
        const code = await fs.readFile(join(__dirname, 'complex-sample.js'), 'utf8');
        return client.getPrompt({
          name: "refactor-code",
          arguments: {
            code: code,
            language: "javascript",
            goal: "improve readability and remove security issues",
          },
        });
      },
      "Refactor Code Prompt"
    ));
    
    // Print summary
    console.log("\n========================================");
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
    
    // Write results to file
    const resultsOutput = {
      total: testResults.length,
      passed: passed,
      failed: failed,
      tests: testResults.map((r, i) => ({
        name: r.testFnName,
        success: r.success,
        error: r.error?.message,
      })),
    };
    
    await fs.writeFile(
      join(__dirname, 'test-results.json'),
      JSON.stringify(resultsOutput, null, 2),
      'utf8'
    );
    
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
    
    // Clean up test files and directories
    try {
      const cleanupPaths = [
        join(__dirname, 'test-update-file.js'),
        join(__dirname, 'test-create-dir'),
        join(__dirname, 'test-project-tool'),
        join(__dirname, 'test-npm-project'),
      ];
      
      for (const path of cleanupPaths) {
        try {
          const stats = await fs.stat(path);
          if (stats.isDirectory()) {
            await fs.rm(path, { recursive: true, force: true });
          } else {
            await fs.unlink(path);
          }
        } catch (e) {
          // Ignore errors if the file doesn't exist
          if (e.code !== 'ENOENT') {
            console.warn(`Warning: Failed to clean up path: ${path}: ${e.message}`);
          }
        }
      }
      
      console.log("Cleaned up test files and directories");
    } catch (e) {
      console.warn(`Warning: Error during cleanup: ${e.message}`);
    }
  }
}

runTests();
