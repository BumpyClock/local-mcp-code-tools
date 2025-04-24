import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from "child_process";
import { readFile, writeFile, stat, readdir, mkdir } from "fs/promises";
import { z } from "zod";
import * as Diff from 'diff';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Log startup information to STDERR
console.error("INFO", "CodeTools MCP server starting up", {
  timestamp: new Date().toISOString(),
  serverVersion: "1.0.0",
  directory: __dirname
});

// --- Helper function to run a process ---
function runProcess(command, args = [], cwd, stdinData) {
  return new Promise((resolve, reject) => {
    console.error(`Running command: ${command} ${args.join(" ")} ${cwd ? `in ${cwd}` : ''}`);
    
    const process = spawn(command, args, {
      cwd: cwd || undefined,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    if (stdinData) {
      process.stdin.write(stdinData);
      process.stdin.end();
    }

    process.on("close", (code) => {
      if (code === 0 || code === 1) { // Sometimes 1 is OK (e.g., for grep when no matches)
        resolve({ stdout, stderr, code });
      } else {
        reject({ stdout, stderr, code });
      }
    });

    process.on("error", (err) => {
      reject({ error: err.message, stderr, stdout, code: -1 });
    });
  });
}

// Helper function to determine MIME type
function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html', 
    '.css': 'text/css', 
    '.js': 'text/javascript', 
    '.mjs': 'text/javascript',
    '.json': 'application/json', 
    '.xml': 'application/xml',
    '.png': 'image/png', 
    '.jpg': 'image/jpeg', 
    '.jpeg': 'image/jpeg', 
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml', 
    '.webp': 'image/webp', 
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf', 
    '.zip': 'application/zip', 
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip', 
    '.wasm': 'application/wasm',
    '.md': 'text/markdown', 
    '.txt': 'text/plain', 
    '.csv': 'text/csv',
    '.py': 'text/x-python', 
    '.java': 'text/x-java-source', 
    '.c': 'text/x-c', 
    '.cpp': 'text/x-c++',
    '.ts': 'text/typescript', 
    '.tsx': 'text/tsx', 
    '.jsx': 'text/jsx',
    '.woff': 'font/woff', 
    '.woff2': 'font/woff2', 
    '.ttf': 'font/ttf', 
    '.otf': 'font/otf',
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

// --- Resource Implementations ---

// File resource for accessing the filesystem
server.resource(
  "file", 
  new ResourceTemplate("file://{path}", { list: undefined }), 
  async (uri, { path }) => {
    try {
      console.error(`Reading resource: ${path}`);
      const fileStats = await stat(path);
      
      if (fileStats.isDirectory()) {
        const files = await readdir(path);
        const formattedFiles = await Promise.all(files.map(async (file) => {
          const fullPath = `${path}/${file}`;
          try {
            const stats = await stat(fullPath);
            return `${stats.isDirectory() ? 'D' : 'F'} ${file}`;
          } catch (e) {
            return `? ${file}`;
          }
        }));
        
        return {
          contents: [{
            uri: uri.href,
            text: `Directory: ${path}\n\nContents:\n${formattedFiles.join('\n')}`,
            mimeType: 'text/plain'
          }]
        };
      }
      
      // Check if the file is binary based on extension
      const knownBinaryExtensions = /\.(jpg|jpeg|png|gif|bmp|ico|pdf|zip|tar|gz|exe|dll|so|bin|dat|webp|woff|woff2|ttf|otf)$/i;
      if (knownBinaryExtensions.test(path)) {
        const content = await readFile(path);
        return {
          contents: [{
            uri: uri.href,
            blob: content.toString('base64'),
            mimeType: getMimeType(path)
          }]
        };
      } else {
        const content = await readFile(path, 'utf8');
        return {
          contents: [{
            uri: uri.href,
            text: content,
            mimeType: getMimeType(path)
          }]
        };
      }
    } catch (error) {
      console.error(`Failed to read resource '${path}':`, error);
      throw new Error(`Failed to read file/directory: ${error.message}`);
    }
  }
);

// Project structure resource to get a high-level view
server.resource(
  "project",
  new ResourceTemplate("project://{path}", { list: undefined }),
  async (uri, { path }) => {
    try {
      console.error(`Analyzing project structure at: ${path}`);
      
      // Use 'find' command to get project structure
      const { stdout } = await runProcess('find', [path, '-type', 'f', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*']);
      
      // Get package.json if it exists
      let packageInfo = '';
      try {
        const packagePath = `${path}/package.json`;
        const packageContent = await readFile(packagePath, 'utf8');
        const pkg = JSON.parse(packageContent);
        packageInfo = `\nProject: ${pkg.name}@${pkg.version}\nDescription: ${pkg.description || 'N/A'}\nMain: ${pkg.main || 'N/A'}\nDependencies: ${Object.keys(pkg.dependencies || {}).join(', ') || 'None'}\n`;
      } catch (e) {
        packageInfo = '\nNo package.json found';
      }
      
      return {
        contents: [{
          uri: uri.href,
          text: `Project Structure for ${path}:${packageInfo}\n\nFiles:\n${stdout}`,
          mimeType: 'text/plain'
        }]
      };
    } catch (error) {
      console.error(`Failed to analyze project structure at '${path}':`, error);
      throw new Error(`Failed to analyze project: ${error.message}`);
    }
  }
);

// --- Tool Implementations ---

// Run command tool
server.tool(
  "run_command",
  {
    command: z.string().describe("The command to run (e.g., 'npm install express', 'git status')."),
    cwd: z.string().optional().describe("The working directory to run the command in. Defaults to the server's CWD."),
  },
  async ({ command, cwd }) => {
    try {
      const parts = command.split(' ');
      const executable = parts[0];
      const args = parts.slice(1);
      
      const result = await runProcess(executable, args, cwd);
      
      return {
        content: [{ 
          type: "text", 
          text: `Command: ${command}\nExit Code: ${result.code}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}` 
        }],
        isError: result.code !== 0 && result.code !== 1,
      };
    } catch (error) {
      console.error(`Error executing command '${command}':`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Failed to run command: ${error.message || JSON.stringify(error)}` 
        }],
        isError: true,
      };
    }
  }
);

// Apply patch tool
server.tool(
  "apply_patch",
  {
    filePath: z.string().describe("Path to the file to modify"),
    unifiedDiff: z.string().describe("The unified diff patch string to apply"),
  },
  async ({ filePath, unifiedDiff }) => {
    try {
      const currentContent = await readFile(filePath, 'utf8');
      const patchedContent = Diff.applyPatch(currentContent, unifiedDiff);
      
      if (patchedContent === false) {
        console.error(`Failed to apply patch to ${filePath}. Patch might not match content.`);
        return {
          content: [{ 
            type: "text", 
            text: "Error: Failed to apply patch. It may not match the current file content." 
          }],
          isError: true,
        };
      }
      
      await writeFile(filePath, patchedContent, 'utf8');
      
      return {
        content: [{ 
          type: "text", 
          text: `Successfully applied patch to ${filePath}` 
        }],
        isError: false,
      };
    } catch (error) {
      console.error(`Error applying patch to '${filePath}':`, error);
      
      if (error.code === 'ENOENT') {
        return {
          content: [{ 
            type: "text", 
            text: `Error: File not found at path: ${filePath}` 
          }],
          isError: true,
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `Error applying patch: ${error.message}` 
        }],
        isError: true,
      };
    }
  }
);

// Update file tool
server.tool(
  "update_file",
  {
    filePath: z.string().describe("Path to the file to modify or create."),
    newContent: z.string().describe("The new content to write to the file."),
  },
  async ({ filePath, newContent }) => {
    try {
      // Create parent directories if needed
      const dirPath = path.dirname(filePath);
      await mkdir(dirPath, { recursive: true });
      
      await writeFile(filePath, newContent, 'utf8');
      
      return {
        content: [{ 
          type: "text", 
          text: `Successfully updated ${filePath}` 
        }],
        isError: false,
      };
    } catch (error) {
      console.error(`Error updating file '${filePath}':`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error updating file: ${error.message}` 
        }],
        isError: true,
      };
    }
  }
);

// List directory tool
server.tool(
  "list_directory",
  {
    path: z.string().describe("Path to the directory to list."),
  },
  async ({ path }) => {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      const formattedEntries = entries.map(entry => {
        return `${entry.isDirectory() ? 'D' : 'F'} ${entry.name}`;
      });
      
      return {
        content: [{ 
          type: "text", 
          text: `Contents of ${path}:\n${formattedEntries.join('\n')}` 
        }],
        isError: false,
      };
    } catch (error) {
      console.error(`Error listing directory '${path}':`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error listing directory: ${error.message}` 
        }],
        isError: true,
      };
    }
  }
);

// Create directory tool
server.tool(
  "create_directory",
  {
    path: z.string().describe("Path of the directory to create."),
    parents: z.boolean().optional().default(false).describe("Create parent directories if they do not exist."),
  },
  async ({ path, parents }) => {
    try {
      await mkdir(path, { recursive: parents });
      
      return {
        content: [{ 
          type: "text", 
          text: `Directory created successfully at ${path}` 
        }],
        isError: false,
      };
    } catch (error) {
      console.error(`Error creating directory '${path}':`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error creating directory: ${error.message}` 
        }],
        isError: true,
      };
    }
  }
);

// Search files tool
server.tool(
  "search_files",
  {
    pattern: z.string().describe("The text pattern to search for."),
    path: z.string().describe("The directory path to start the search from."),
    recursive: z.boolean().optional().default(true).describe("Whether to search recursively into subdirectories."),
  },
  async ({ pattern, path, recursive }) => {
    try {
      const grepArgs = [
        recursive ? '-r' : '',
        '-n',
        '-I',
        '-e', pattern,
        path
      ].filter(Boolean);
      
      const { stdout, stderr, code } = await runProcess('grep', grepArgs);
      
      if (code === 1 && !stderr && !stdout) {
        return {
          content: [{ 
            type: "text", 
            text: `No matches found for pattern "${pattern}" in ${path}` 
          }],
          isError: false,
        };
      } else if (code !== 0) {
        console.error(`Grep search failed with code ${code} for pattern "${pattern}" in ${path}. Stderr: ${stderr}`);
        return {
          content: [{ 
            type: "text", 
            text: `Error during search: ${stderr || 'Unknown grep error'}` 
          }],
          isError: true,
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `Search results for "${pattern}" in ${path}:\n\n${stdout}` 
        }],
        isError: false,
      };
    } catch (error) {
      console.error(`Error searching files for pattern "${pattern}" in ${path}:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error searching files: ${error.message}` 
        }],
        isError: true,
      };
    }
  }
);

// Init NPM project tool
server.tool(
  "init_npm_project",
  {
    path: z.string().describe("Path where the project should be initialized."),
    name: z.string().describe("Project name."),
    description: z.string().optional().describe("Project description."),
  },
  async ({ path, name, description }) => {
    try {
      // Create directory if it doesn't exist
      await mkdir(path, { recursive: true });
      
      // Create a package.json file
      const packageJson = {
        name,
        version: "1.0.0",
        description: description || "",
        main: "index.js",
        type: "module",
        scripts: {
          start: "node index.js"
        },
        keywords: [],
        author: "",
        license: "ISC",
        dependencies: {},
        devDependencies: {}
      };
      
      await writeFile(`${path}/package.json`, JSON.stringify(packageJson, null, 2), 'utf8');
      
      // Create basic index.js file
      const indexJs = `// ${name} - main file\n\nconsole.log('${name} is running!');\n`;
      await writeFile(`${path}/index.js`, indexJs, 'utf8');
      
      // Create README.md
      const readmeMd = `# ${name}\n\n${description || ''}\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n`;
      await writeFile(`${path}/README.md`, readmeMd, 'utf8');
      
      return {
        content: [{ 
          type: "text", 
          text: `Successfully initialized NPM project '${name}' at ${path}` 
        }],
        isError: false,
      };
    } catch (error) {
      console.error(`Error initializing NPM project at '${path}':`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error initializing NPM project: ${error.message}` 
        }],
        isError: true,
      };
    }
  }
);

// Git operations tool
server.tool(
  "git_operation",
  {
    operation: z.enum(["clone", "init", "status", "add", "commit", "push", "pull", "checkout"]).describe("Git operation to perform."),
    path: z.string().describe("Path where the operation should be performed."),
    args: z.string().optional().describe("Additional arguments for the git command."),
  },
  async ({ operation, path, args }) => {
    try {
      let command = 'git';
      let argsList = [operation];
      
      if (args) {
        argsList = argsList.concat(args.split(' '));
      }
      
      if (operation === 'clone' && !args) {
        return {
          content: [{ 
            type: "text", 
            text: "Error: Repository URL is required for git clone operation. Use the args parameter to specify it." 
          }],
          isError: true,
        };
      }
      
      const result = await runProcess(command, argsList, path);
      
      return {
        content: [{ 
          type: "text", 
          text: `Git ${operation} result:\n\n${result.stdout}\n\n${result.stderr ? `Errors/Warnings:\n${result.stderr}` : ''}` 
        }],
        isError: result.code !== 0,
      };
    } catch (error) {
      console.error(`Error performing git operation '${operation}' at '${path}':`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error performing git ${operation}: ${error.message || JSON.stringify(error)}` 
        }],
        isError: true,
      };
    }
  }
);

// Ping tool
server.tool(
  "ping",
  {},
  async () => {
    return {
      content: [{ 
        type: "text", 
        text: `Pong! Server is alive. Time: ${new Date().toISOString()}` 
      }],
      isError: false,
    };
  }
);

// --- Prompt Implementations ---

// Code review prompt
server.prompt(
  "code-review", 
  { 
    code: z.string(), 
    language: z.string().optional() 
  }, 
  ({ code, language }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please review this ${language || "code"}:\n\n${code}\n\nProvide feedback on:\n- Code structure and organization\n- Potential bugs or errors\n- Performance issues\n- Security concerns\n- Readability and maintainability\n- Best practices and coding standards\n`
        }
      }
    ]
  })
);

// Generate tests prompt
server.prompt(
  "generate-tests", 
  { 
    code: z.string(), 
    framework: z.string().optional() 
  }, 
  ({ code, framework }) => {
    const frameworkGuide = framework ? `Use ${framework} as the testing framework.` : "Choose an appropriate testing framework.";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please write tests for the following code:\n\n${code}\n\n${frameworkGuide}\n\nCreate comprehensive tests that cover:\n- Happy path scenarios\n- Edge cases\n- Error handling\n`
          }
        }
      ]
    };
  }
);

// Generate docs prompt
server.prompt(
  "generate-docs", 
  { 
    code: z.string(), 
    format: z.string().optional() 
  }, 
  ({ code, format }) => {
    const formatGuide = format ? `Use ${format} format for the documentation.` : "Use JSDoc, docstrings, or the appropriate format for the language.";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please generate documentation for the following code:\n\n${code}\n\n${formatGuide}\n\nInclude:\n- Function/method descriptions\n- Parameter details\n- Return value information\n- Usage examples where appropriate\n`
          }
        }
      ]
    };
  }
);

// Refactoring prompt
server.prompt(
  "refactor-code", 
  { 
    code: z.string(), 
    language: z.string().optional(),
    goal: z.string().optional()
  }, 
  ({ code, language, goal }) => {
    const goalInstruction = goal 
      ? `Focus on refactoring for ${goal}.` 
      : "Focus on improving readability, maintainability, and performance.";
    
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please refactor this ${language || "code"}:\n\n${code}\n\n${goalInstruction}\n\nProvide:\n- The refactored code\n- A brief explanation of the changes made\n- Any potential benefits of the refactoring\n`
          }
        }
      ]
    };
  }
);

// --- Server Connection ---
async function runServer() {
  try {
    const transport = new StdioServerTransport();
    
    console.error("INFO", "Starting server connection...");
    await server.connect(transport);
    console.error("INFO", "MCP Server connected via stdio and ready.");
    
    // Keep server running until transport closes
    await new Promise((resolve) => {
      transport.onclose = resolve;
    });
    
    console.error("INFO", "Transport closed, server shutting down.");
  } catch (error) {
    console.error("FATAL", "Error starting or connecting MCP server:", error);
    process.exit(1);
  } finally {
    await server.close();
    console.error("INFO", "Server closed.");
  }
}

runServer();