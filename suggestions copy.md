# Code-Tools MCP Server Testing and Suggestions

## Summary

I thoroughly tested the code-tools MCP server and found most tool functionality works well, but there are some issues with a few tools and the resource implementations. The server has a good architecture with well-structured code and clear separation of concerns.

## Functionality Tested (April 2025 Update)

### Tools Working ✅

1. **Ping Tool**: Successfully returns a pong response with timestamp.
2. **List Directory Tool**: Correctly lists directory contents.
3. **Create Directory Tool**: Successfully creates directories.
4. **Write File Tool**: Successfully creates and updates files.
5. **Edit File Tool**: Successfully makes changes to files with a nice diff output.
6. **Run Command Tool**: Successfully executes shell commands.
7. **Create Project Tool**: Creates project structures with package.json.
8. **Init NPM Project Tool**: Creates NPM projects with appropriate files.
9. **Shell Tool**: Correctly executes shell commands.
10. **Directory Tree Tool**: Creates a nice JSON tree representation of directories.
11. **Get File Info Tool**: Returns metadata about files.
12. **List Allowed Directories Tool**: Shows which directories can be accessed.

### Tools Not Working ❌

1. **Search Files Tool**: Did not return expected results when searching for files.
2. **Git Tool**: Failed with a "spawn /bin/sh ENOENT" error.
3. **Update File Tool**: Failed with parameter validation errors.
4. **Apply Patch Tool**: Not explicitly tested, but likely has issues similar to Update File.
5. **List Projects Tool**: Returns a placeholder "not implemented" message.

### Resources (Not Tested)

1. **File Resource**: Not tested in this round.
2. **Project Resource**: Not tested in this round.

## Issues Found and Fixes

### 1. Search Files Tool

The search_files tool doesn't seem to return expected results. Using various patterns like "test.js", ".js", or "*" doesn't work properly.

**Suggested Fix:**
```typescript
// Modify the search_files tool implementation to use more reliable file search methods
function registerSearchFilesTool(server: McpServer): void {
  server.tool(
    "search_files",
    {
      path: z.string().describe("Path to search in"),
      pattern: z.string().describe("Pattern to search for"),
      recursive: z.boolean().optional().default(true).describe("Whether to search recursively"),
      excludePatterns: z.array(z.string()).optional().default([]).describe("Patterns to exclude"),
    },
    async ({ path: searchPath, pattern, recursive, excludePatterns }, _extra): Promise<ToolResponse> => {
      try {
        // Use glob patterns for more reliable file searching
        const globby = await import('globby');
        
        // Build the search pattern
        const searchPattern = recursive 
          ? `${searchPath}/**/${pattern}` 
          : `${searchPath}/${pattern}`;
          
        // Execute the search
        const files = await globby.default([searchPattern], {
          ignore: excludePatterns,
          onlyFiles: false,
          dot: true,
        });
        
        if (files.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No matches found for pattern "${pattern}" in ${searchPath}`,
              },
            ],
            isError: false,
          };
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Found ${files.length} matches for pattern "${pattern}" in ${searchPath}:\n\n${files.join('\n')}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error searching files: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
```

### 2. Git Tool

The git tool fails with a "spawn /bin/sh ENOENT" error, suggesting issues with command execution.

**Suggested Fix:**
```typescript
// Ensure proper path to shell and handle different platforms
function registerGitTool(server: McpServer): void {
  server.tool(
    "git",
    {
      operation: z.enum(["clone", "init", "status", "add", "commit", "push", "pull", "checkout"]),
      path: z.string(),
      args: z.string().optional(),
    },
    async ({ operation, path: repoPath, args }, _extra): Promise<ToolResponse> => {
      try {
        // Handle the execution in a more robust way
        const { exec } = await import('child_process');
        const util = await import('util');
        const execPromise = util.promisify(exec);
        
        // Determine shell based on platform
        const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
        
        // Build the command
        const command = `git ${operation} ${args || ''}`;
        
        // Execute the command in the specified directory
        const { stdout, stderr } = await execPromise(command, {
          cwd: repoPath,
          shell: shell,
        });
        
        return {
          content: [
            {
              type: "text",
              text: stdout || stderr || `Git ${operation} completed successfully.`,
            },
          ],
          isError: !!stderr,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error running git: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
```

### 3. Update File Tool

The update_file tool fails with parameter validation errors. It appears to expect different parameter names than what we provided.

**Suggested Fix:**
```typescript
// Make sure to use the correct parameter names in the tool schema
function registerUpdateFileTool(server: McpServer): void {
  server.tool(
    "update_file",
    {
      path: z.string().describe("Path to the file to modify or create"),
      file_text: z.string().describe("The new content to write to the file"),
    },
    async ({ path: filePath, file_text: newContent }, _extra): Promise<ToolResponse> => {
      try {
        const fs = await import('fs/promises');
        await fs.writeFile(filePath, newContent, 'utf8');
        
        return {
          content: [
            {
              type: "text",
              text: `File updated at ${filePath}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error updating file: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
```

### 4. Implement Proper List Projects Tool

The list_projects tool currently returns a placeholder message. Implementation is needed:

```typescript
function registerListProjectsTool(server: McpServer): void {
  server.tool(
    "list_projects",
    {},
    async (_args, _extra): Promise<ToolResponse> => {
      try {
        // Search for package.json files to identify projects
        const { exec } = await import('child_process');
        const util = await import('util');
        const execPromise = util.promisify(exec);
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Use find to locate package.json files (excluding node_modules)
        const { stdout } = await execPromise(
          "find . -name package.json -not -path '*/node_modules/*' -not -path '*/.git/*'",
          { cwd: process.cwd() }
        );
        
        // If find command fails, return empty list
        if (!stdout.trim()) {
          return {
            content: [
              {
                type: "text",
                text: "No projects found in the current directory.",
              },
            ],
            isError: false,
          };
        }
        
        // Parse the output and create project list
        const projectPaths = stdout.trim().split("\n");
        const projectInfo = await Promise.all(
          projectPaths.map(async (packageJsonPath) => {
            try {
              const fullPath = path.join(process.cwd(), packageJsonPath);
              const content = await fs.readFile(fullPath, "utf8");
              const pkg = JSON.parse(content);
              const projectDir = path.dirname(fullPath);
              
              return {
                name: pkg.name || "unnamed",
                version: pkg.version || "unknown",
                path: projectDir,
                description: pkg.description || "",
              };
            } catch (e) {
              return null;
            }
          })
        );
        
        // Filter out nulls and format output
        const validProjects = projectInfo.filter(Boolean);
        const formattedOutput = validProjects
          .map((p) => `${p.name}@${p.version} - ${p.path}\n  ${p.description}`)
          .join("\n\n");
        
        return {
          content: [
            {
              type: "text",
              text:
                validProjects.length > 0
                  ? `Found ${validProjects.length} projects:\n\n${formattedOutput}`
                  : "No valid projects found in the current directory.",
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error listing projects: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
```

## New Tool Suggestions

In addition to the suggestions from the previous run, here are some new tool ideas:

### 1. File Diff Tool

```typescript
function registerFileDiffTool(server: McpServer): void {
  server.tool(
    "diff_files",
    {
      fileA: z.string().describe("Path to the first file"),
      fileB: z.string().describe("Path to the second file"),
      format: z.enum(["unified", "side-by-side"]).optional().default("unified"),
    },
    async ({ fileA, fileB, format }, _extra): Promise<ToolResponse> => {
      try {
        const fs = await import('fs/promises');
        const diff = await import('diff');
        
        const contentA = await fs.readFile(fileA, 'utf8');
        const contentB = await fs.readFile(fileB, 'utf8');
        
        let diffResult: string;
        if (format === "unified") {
          diffResult = diff.createPatch(fileA, contentA, contentB, 'File A', 'File B');
        } else {
          // Side by side diff
          diffResult = diff.createTwoFilesPatch(fileA, fileB, contentA, contentB, 'File A', 'File B');
        }
        
        return {
          content: [
            {
              type: "text",
              text: diffResult || "Files are identical",
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error creating diff: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
```

### 2. Code Documentation Generator

```typescript
function registerDocGenTool(server: McpServer): void {
  server.tool(
    "generate_docs",
    {
      path: z.string().describe("Path to the source code file or directory"),
      output: z.string().optional().describe("Output path for documentation"),
      format: z.enum(["markdown", "html", "json"]).optional().default("markdown"),
      recursive: z.boolean().optional().default(true),
    },
    async ({ path: sourcePath, output, format, recursive }, _extra): Promise<ToolResponse> => {
      try {
        // Implementation would use tools like JSDoc, TypeDoc, etc. to generate documentation
        // This is a simplified example
        const { exec } = await import('child_process');
        const util = await import('util');
        const execPromise = util.promisify(exec);
        
        const outputPath = output || `${sourcePath}-docs`;
        
        // For TypeScript/JavaScript code, use JSDoc or TypeDoc
        let command = '';
        if (sourcePath.endsWith('.ts') || sourcePath.endsWith('.js')) {
          if (format === 'markdown') {
            command = `typedoc --out ${outputPath} --theme markdown ${recursive ? '--recurse' : ''} ${sourcePath}`;
          } else if (format === 'html') {
            command = `typedoc --out ${outputPath} ${recursive ? '--recurse' : ''} ${sourcePath}`;
          } else {
            command = `typedoc --out ${outputPath} --json ${outputPath}/docs.json ${recursive ? '--recurse' : ''} ${sourcePath}`;
          }
        }
        
        const { stdout, stderr } = await execPromise(command);
        
        return {
          content: [
            {
              type: "text",
              text: stdout || `Documentation generated successfully at ${outputPath}`,
            },
          ],
          isError: !!stderr,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error generating documentation: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
```

### 3. Auto-Formatter Tool

```typescript
function registerAutoFormatterTool(server: McpServer): void {
  server.tool(
    "format_code",
    {
      path: z.string().describe("Path to the file or directory to format"),
      style: z.enum(["default", "airbnb", "google", "standard"]).optional().default("default"),
      dryRun: z.boolean().optional().default(false).describe("Show changes without making them"),
    },
    async ({ path: codePath, style, dryRun }, _extra): Promise<ToolResponse> => {
      try {
        const { exec } = await import('child_process');
        const util = await import('util');
        const execPromise = util.promisify(exec);
        
        let configArg = '';
        if (style === 'airbnb') {
          configArg = '--config airbnb';
        } else if (style === 'google') {
          configArg = '--config google';
        } else if (style === 'standard') {
          configArg = '--config standard';
        }
        
        const command = `prettier ${configArg} ${dryRun ? '--check' : '--write'} "${codePath}"`;
        const { stdout, stderr } = await execPromise(command);
        
        return {
          content: [
            {
              type: "text",
              text: stdout || (dryRun ? "Format check passed" : "Files formatted successfully"),
            },
          ],
          isError: !!stderr,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error formatting code: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
```

### 4. Interactive Code Explorer

A tool that would allow interactive exploration of code structure:

```typescript
function registerCodeExplorerTool(server: McpServer): void {
  server.tool(
    "explore_code",
    {
      path: z.string().describe("Path to the code to explore"),
      view: z.enum(["functions", "classes", "imports", "exports", "dependencies"]),
      includeDetails: z.boolean().optional().default(true),
    },
    async ({ path: codePath, view, includeDetails }, _extra): Promise<ToolResponse> => {
      try {
        // Implementation would use AST parsers to analyze code structure
        // and return a structured view of the code components
        
        // For a full implementation, libraries like Babel, TypeScript Compiler API,
        // or other AST parsers would be used to analyze the code structure
        
        // Here's a placeholder implementation
        const fs = await import('fs/promises');
        const content = await fs.readFile(codePath, 'utf8');
        
        // Simple regex-based detection for demo purposes
        // In a real implementation, we would use proper parsing
        let output = '';
        
        if (view === 'functions') {
          const functionMatches = content.match(/function\s+(\w+)\s*\(/g) || [];
          const arrowFunctions = content.match(/const\s+(\w+)\s*=\s*(\([^)]*\)|[^=]*)\s*=>/g) || [];
          
          output = `Functions found in ${codePath}:\n\n`;
          output += [...functionMatches, ...arrowFunctions].join('\n');
        } else if (view === 'classes') {
          const classMatches = content.match(/class\s+(\w+)/g) || [];
          
          output = `Classes found in ${codePath}:\n\n`;
          output += classMatches.join('\n');
        } else if (view === 'imports') {
          const importMatches = content.match(/import\s+.*\s+from\s+['"](.*)['"]/g) || [];
          
          output = `Imports found in ${codePath}:\n\n`;
          output += importMatches.join('\n');
        } else if (view === 'exports') {
          const exportMatches = content.match(/export\s+/g) || [];
          
          output = `Exports found in ${codePath}:\n\n`;
          output += exportMatches.join('\n');
        } else if (view === 'dependencies') {
          // For dependencies, we would need to parse package.json
          // or look at import statements
          output = 'Dependencies analysis would be implemented here';
        }
        
        return {
          content: [
            {
              type: "text",
              text: output || `No ${view} found in ${codePath}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error exploring code: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
```

### 5. Bundle Size Analyzer

```typescript
function registerBundleSizeAnalyzerTool(server: McpServer): void {
  server.tool(
    "analyze_bundle",
    {
      path: z.string().describe("Path to the entry file or directory"),
      output: z.string().optional().describe("Output path for the bundle analysis"),
      format: z.enum(["json", "html", "text"]).optional().default("html"),
    },
    async ({ path: entryPath, output, format }, _extra): Promise<ToolResponse> => {
      try {
        // Implementation would use tools like webpack-bundle-analyzer
        // or similar to analyze bundle size
        const { exec } = await import('child_process');
        const util = await import('util');
        const execPromise = util.promisify(exec);
        
        const outputPath = output || `${entryPath}-bundle-analysis`;
        
        // Command to run webpack with bundle analyzer
        const command = `npx webpack --config webpack.config.js --entry ${entryPath} --profile --json > ${outputPath}.json`;
        await execPromise(command);
        
        // Generate the appropriate format
        let formatCommand = '';
        if (format === 'html') {
          formatCommand = `npx webpack-bundle-analyzer ${outputPath}.json -O ${outputPath}.html`;
        } else if (format === 'text') {
          formatCommand = `npx webpack-bundle-size-analyzer ${outputPath}.json > ${outputPath}.txt`;
        }
        
        if (formatCommand) {
          await execPromise(formatCommand);
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Bundle analysis complete. Results saved to ${outputPath}.${format}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const err = error as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing bundle: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
```

## Conclusion

The MCP code-tools server provides a solid foundation with many functional tools, but there are a few issues to address. The most important fixes would be:

1. Fixing the search_files tool to properly find files based on patterns
2. Addressing the shell-related errors in the git tool
3. Fixing parameter validation in the update_file tool
4. Implementing a proper list_projects tool

The suggested new tools would further enhance the functionality and usefulness of the MCP server for code-related tasks.
