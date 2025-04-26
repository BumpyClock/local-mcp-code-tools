# CodeTools MCP Server

An MCP (Model Context Protocol) server that provides tools and resources for code-related operations. This server can be integrated with LLM applications to provide context-aware code tools, file system access, and project management capabilities.

## Features

### Tools

- **File Operations**
  - `update_file` - Create or modify files
  - `apply_patch` - Apply unified diff patches to files
  - `list_directory` - List contents of a directory
  - `create_directory` - Create new directories
  - `search_files` - Search for patterns in files

- **Project Management**
  - `init_npm_project` - Initialize a new NPM project
  - `git_operation` - Perform git operations
  - `run_command` - Run shell commands
  - `ping` - Check server status

### Resources

- **file** - Access files and directories (`file://{path}`)
- **project** - Get project structure information (`project://{path}`)

### Prompts

- **code-review** - Get a code review
- **generate-tests** - Generate tests for code
- **generate-docs** - Generate documentation for code
- **refactor-code** - Get refactoring suggestions

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/code-tools-mcp.git
cd code-tools-mcp

# Install dependencies
npm install

# Build the server
npm run build
```

## Usage

### Starting the Server

```bash
# Start the server using stdio transport (for MCP clients)
npm start

# Or use the executable directly
./dist/bin/server.js
```

### Using the Test Client

```bash
# Run the test client
npm run client

# Test with HTTP transport
node client.js --http --url=http://localhost:3000/mcp
```

## Examples

### Using the File Resource

```javascript
// Read a file using the file resource
const fileResult = await client.readResource({
  uri: `file:///path/to/your/file.js`,
});
```

### Using the Code Review Prompt

```javascript
// Get a code review for a piece of code
const promptResult = await client.getPrompt({
  name: "code-review",
  arguments: {
    code: `function add(a, b) { return a + b; }`,
    language: "javascript",
  },
});
```

### Updating a File

```javascript
// Update or create a file
const updateResult = await client.callTool({
  name: "update_file",
  arguments: {
    filePath: "/path/to/your/file.js",
    newContent: "// New content for the file\nconsole.log('Hello, world!');"
  },
});
```

## Troubleshooting

### File Resource Issues

If you encounter issues with the file resource, check that:
- The file path exists and is accessible
- You're using the correct URI format: `file:///absolute/path/to/file`
- The server has permission to read the file

### Connection Issues

If you have trouble connecting to the server:
- For stdio transport, ensure the server is running before connecting the client
- For HTTP transport, verify the server is listening on the correct port
- Check for any firewall or permission issues

## Development

### Project Structure

```
code-tools-mcp/
├── src/
│   ├── bin/             # Executable entry points
│   ├── prompts/         # Prompt implementations
│   ├── resources/       # Resource implementations
│   ├── tools/           # Tool implementations
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Shared utility functions
│   ├── client.ts        # Client implementation
│   └── server.ts        # Server implementation
├── dist/                # Compiled JavaScript output
└── test/                # Tests
```

### Adding New Tools

To add a new tool, create a new file in the `src/tools` directory and follow the pattern used in the existing tools. Then register your tool in the appropriate index.ts file.

## License

MIT
