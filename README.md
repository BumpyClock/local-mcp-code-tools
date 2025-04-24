# CodeTools MCP

A TypeScript-based Model Context Protocol (MCP) server providing tools for code development, file operations, and project management.

## Overview

CodeTools MCP is a server implementation of the [Model Context Protocol](https://modelcontextprotocol.io) that provides various tools and resources to help with development tasks:

- **File Operations:** Read, write, search, and modify files
- **Project Management:** Initialize projects, run commands, manage Git repositories
- **Code Generation:** Generate tests, documentation, and more through prompts

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd code-tools-mcp

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Link the package (optional, for global use)
npm link
```

## Usage

### Running the Server

You can run the server directly:

```bash
npm start
```

Or if you've linked the package:

```bash
code-tools-server
```

### Running the Test Client

To test the server with the provided client:

```bash
npm run client
```

Or if you've linked the package:

```bash
code-tools-client
```

### Development Mode

To run the server in development mode with auto-restart:

```bash
npm run dev
```

## TypeScript Development

This project uses TypeScript for type safety and better development experience. The source code is in the `src` directory and gets compiled to JavaScript in the `dist` directory.

### Compiling TypeScript

```bash
# Build the project
npm run build

# Watch mode with automatic rebuilding
npm run dev

# Clean build output
npm run clean
```

### Type Checking and Linting

```bash
# Run TypeScript type checking
npx tsc --noEmit

# Run ESLint
npm run lint
```

## Project Structure

```
code-tools-mcp/
├─ src/               # TypeScript source code
│  ├─ bin/            # Executable scripts
│  │  ├─ server.ts    # Server executable
│  │  └─ client.ts    # Client executable
│  ├─ prompts/        # MCP prompts
│  ├─ resources/      # MCP resources
│  ├─ tools/          # MCP tools
│  ├─ types/          # TypeScript type definitions
│  ├─ utils/          # Utility functions
│  ├─ server.ts       # Main server implementation
│  └─ client.ts       # Test client implementation
├─ dist/              # Compiled JavaScript output
├─ tsconfig.json      # TypeScript configuration
├─ package.json       # Project configuration
└─ README.md          # Project documentation
```

## Available Tools

### File Operations

- **update_file:** Create or update a file with specified content
- **apply_patch:** Apply a unified diff patch to a file
- **list_directory:** List the contents of a directory
- **create_directory:** Create a new directory
- **search_files:** Search for text patterns in files

### Project Operations

- **init_npm_project:** Initialize a new NPM project
- **git_operation:** Perform Git operations (clone, init, status, etc.)
- **run_command:** Execute shell commands
- **ping:** Check if the server is responsive

## Available Resources

- **file://{path}:** Access files and directories in the filesystem
- **project://{path}:** Get information about a project's structure

## Available Prompts

- **code-review:** Get a comprehensive code review
- **generate-tests:** Generate tests for given code
- **generate-docs:** Generate documentation for given code
- **refactor-code:** Get suggestions for code refactoring

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
