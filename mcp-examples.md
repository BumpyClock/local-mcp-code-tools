================================================
FILE: src/examples/README.md
================================================

# MCP TypeScript SDK Examples

This directory contains example implementations of MCP clients and servers using the TypeScript SDK.

## Table of Contents

- [Client Implementations](#client-implementations)
  - [Streamable HTTP Client](#streamable-http-client)
  - [Backwards Compatible Client](#backwards-compatible-client)
- [Server Implementations](#server-implementations)
  - [Single Node Deployment](#single-node-deployment)
    - [Streamable HTTP Transport](#streamable-http-transport)
    - [Deprecated SSE Transport](#deprecated-sse-transport)
    - [Backwards Compatible Server](#streamable-http-backwards-compatible-server-with-sse)
  - [Multi-Node Deployment](#multi-node-deployment)
- [Backwards Compatibility](#testing-streamable-http-backwards-compatibility-with-sse)

## Client Implementations

### Streamable HTTP Client

A full-featured interactive client that connects to a Streamable HTTP server, demonstrating how to:

- Establish and manage a connection to an MCP server
- List and call tools with arguments
- Handle notifications through the SSE stream
- List and get prompts with arguments
- List available resources
- Handle session termination and reconnection
- Support for resumability with Last-Event-ID tracking

```bash
npx tsx src/examples/client/simpleStreamableHttp.ts
```

### Backwards Compatible Client

A client that implements backwards compatibility according to the [MCP specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#backwards-compatibility), allowing it to work with both new and legacy servers. This client demonstrates:

- The client first POSTs an initialize request to the server URL:
  - If successful, it uses the Streamable HTTP transport
  - If it fails with a 4xx status, it attempts a GET request to establish an SSE stream

```bash
npx tsx src/examples/client/streamableHttpWithSseFallbackClient.ts
```

## Server Implementations

### Single Node Deployment

These examples demonstrate how to set up an MCP server on a single node with different transport options.

#### Streamable HTTP Transport

##### Simple Streamable HTTP Server

A server that implements the Streamable HTTP transport (protocol version 2025-03-26).

- Basic server setup with Express and the Streamable HTTP transport
- Session management with an in-memory event store for resumability
- Tool implementation with the `greet` and `multi-greet` tools
- Prompt implementation with the `greeting-template` prompt
- Static resource exposure
- Support for notifications via SSE stream established by GET requests
- Session termination via DELETE requests

```bash
npx tsx src/examples/server/simpleStreamableHttp.ts
```

##### JSON Response Mode Server

A server that uses Streamable HTTP transport with JSON response mode enabled (no SSE).

- Streamable HTTP with JSON response mode, which returns responses directly in the response body
- Limited support for notifications (since SSE is disabled)
- Proper response handling according to the MCP specification for servers that don't support SSE
- Returning appropriate HTTP status codes for unsupported methods

```bash
npx tsx src/examples/server/jsonResponseStreamableHttp.ts
```

##### Streamable HTTP with server notifications

A server that demonstrates server notifications using Streamable HTTP.

- Resource list change notifications with dynamically added resources
- Automatic resource creation on a timed interval

```bash
npx tsx src/examples/server/standaloneSseWithGetStreamableHttp.ts
```

#### Deprecated SSE Transport

A server that implements the deprecated HTTP+SSE transport (protocol version 2024-11-05). This example only used for testing backwards compatibility for clients.

- Two separate endpoints: `/mcp` for the SSE stream (GET) and `/messages` for client messages (POST)
- Tool implementation with a `start-notification-stream` tool that demonstrates sending periodic notifications

```bash
npx tsx src/examples/server/simpleSseServer.ts
```

#### Streamable Http Backwards Compatible Server with SSE

A server that supports both Streamable HTTP and SSE transports, adhering to the [MCP specification for backwards compatibility](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#backwards-compatibility).

- Single MCP server instance with multiple transport options
- Support for Streamable HTTP requests at `/mcp` endpoint (GET/POST/DELETE)
- Support for deprecated SSE transport with `/sse` (GET) and `/messages` (POST)
- Session type tracking to avoid mixing transport types
- Notifications and tool execution across both transport types

```bash
npx tsx src/examples/server/sseAndStreamableHttpCompatibleServer.ts
```

### Multi-Node Deployment

When deploying MCP servers in a horizontally scaled environment (multiple server instances), there are a few different options that can be useful for different use cases:

- **Stateless mode** - No need to maintain state between calls to MCP servers. Useful for simple API wrapper servers.
- **Persistent storage mode** - No local state needed, but session data is stored in a database. Example: an MCP server for online ordering where the shopping cart is stored in a database.
- **Local state with message routing** - Local state is needed, and all requests for a session must be routed to the correct node. This can be done with a message queue and pub/sub system.

#### Stateless Mode

The Streamable HTTP transport can be configured to operate without tracking sessions. This is perfect for simple API proxies or when each request is completely independent.

##### Implementation

To enable stateless mode, configure the `StreamableHTTPServerTransport` with:

```typescript
sessionIdGenerator: undefined;
```

This disables session management entirely, and the server won't generate or expect session IDs.

- No session ID headers are sent or expected
- Any server node can process any request
- No state is preserved between requests
- Perfect for RESTful or stateless API scenarios
- Simplest deployment model with minimal infrastructure requirements

```
┌─────────────────────────────────────────────┐
│                  Client                     │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│                Load Balancer                │
└─────────────────────────────────────────────┘
          │                       │
          ▼                       ▼
┌─────────────────┐     ┌─────────────────────┐
│  MCP Server #1  │     │    MCP Server #2    │
│ (Node.js)       │     │  (Node.js)          │
└─────────────────┘     └─────────────────────┘
```

#### Persistent Storage Mode

For cases where you need session continuity but don't need to maintain in-memory state on specific nodes, you can use a database to persist session data while still allowing any node to handle requests.

##### Implementation

Configure the transport with session management, but retrieve and store all state in an external persistent storage:

```typescript
sessionIdGenerator: () => randomUUID(),
eventStore: databaseEventStore
```

All session state is stored in the database, and any node can serve any client by retrieving the state when needed.

- Maintains sessions with unique IDs
- Stores all session data in an external database
- Provides resumability through the database-backed EventStore
- Any node can handle any request for the same session
- No node-specific memory state means no need for message routing
- Good for applications where state can be fully externalized
- Somewhat higher latency due to database access for each request

```
┌─────────────────────────────────────────────┐
│                  Client                     │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│                Load Balancer                │
└─────────────────────────────────────────────┘
          │                       │
          ▼                       ▼
┌─────────────────┐     ┌─────────────────────┐
│  MCP Server #1  │     │    MCP Server #2    │
│ (Node.js)       │     │  (Node.js)          │
└─────────────────┘     └─────────────────────┘
          │                       │
          │                       │
          ▼                       ▼
┌─────────────────────────────────────────────┐
│           Database (PostgreSQL)             │
│                                             │
│  • Session state                            │
│  • Event storage for resumability           │
└─────────────────────────────────────────────┘
```

#### Streamable HTTP with Distributed Message Routing

For scenarios where local in-memory state must be maintained on specific nodes (such as Computer Use or complex session state), the Streamable HTTP transport can be combined with a pub/sub system to route messages to the correct node handling each session.

1. **Bidirectional Message Queue Integration**:

   - All nodes both publish to and subscribe from the message queue
   - Each node registers the sessions it's actively handling
   - Messages are routed based on session ownership

2. **Request Handling Flow**:

   - When a client connects to Node A with an existing `mcp-session-id`
   - If Node A doesn't own this session, it:
     - Establishes and maintains the SSE connection with the client
     - Publishes the request to the message queue with the session ID
     - Node B (which owns the session) receives the request from the queue
     - Node B processes the request with its local session state
     - Node B publishes responses/notifications back to the queue
     - Node A subscribes to the response channel and forwards to the client

3. **Channel Identification**:
   - Each message channel combines both `mcp-session-id` and `stream-id`
   - This ensures responses are correctly routed back to the originating connection

```
┌─────────────────────────────────────────────┐
│                  Client                     │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│                Load Balancer                │
└─────────────────────────────────────────────┘
          │                       │
          ▼                       ▼
┌─────────────────┐     ┌─────────────────────┐
│  MCP Server #1  │◄───►│    MCP Server #2    │
│ (Has Session A) │     │  (Has Session B)    │
└─────────────────┘     └─────────────────────┘
          ▲│                     ▲│
          │▼                     │▼
┌─────────────────────────────────────────────┐
│         Message Queue / Pub-Sub             │
│                                             │
│  • Session ownership registry               │
│  • Bidirectional message routing            │
│  • Request/response forwarding              │
└─────────────────────────────────────────────┘
```

- Maintains session affinity for stateful operations without client redirection
- Enables horizontal scaling while preserving complex in-memory state
- Provides fault tolerance through the message queue as intermediary

## Backwards Compatibility

### Testing Streamable HTTP Backwards Compatibility with SSE

To test the backwards compatibility features:

1. Start one of the server implementations:

   ```bash
   # Legacy SSE server (protocol version 2024-11-05)
   npx tsx src/examples/server/simpleSseServer.ts

   # Streamable HTTP server (protocol version 2025-03-26)
   npx tsx src/examples/server/simpleStreamableHttp.ts

   # Backwards compatible server (supports both protocols)
   npx tsx src/examples/server/sseAndStreamableHttpCompatibleServer.ts
   ```

2. Then run the backwards compatible client:
   ```bash
   npx tsx src/examples/client/streamableHttpWithSseFallbackClient.ts
   ```

This demonstrates how the MCP ecosystem ensures interoperability between clients and servers regardless of which protocol version they were built for.

================================================
FILE: src/examples/client/multipleClientsParallel.ts
================================================
import { Client } from '../../client/index.js';
import { StreamableHTTPClientTransport } from '../../client/streamableHttp.js';
import {
CallToolRequest,
CallToolResultSchema,
LoggingMessageNotificationSchema,
CallToolResult,
} from '../../types.js';

/\*\*

- Multiple Clients MCP Example
-
- This client demonstrates how to:
- 1.  Create multiple MCP clients in parallel
- 2.  Each client calls a single tool
- 3.  Track notifications from each client independently
      \*/

// Command line args processing
const args = process.argv.slice(2);
const serverUrl = args[0] || 'http://localhost:3000/mcp';

interface ClientConfig {
id: string;
name: string;
toolName: string;
toolArguments: Record<string, string | number | boolean>;
}

async function createAndRunClient(config: ClientConfig): Promise<{ id: string; result: CallToolResult }> {
console.log(`[${config.id}] Creating client: ${config.name}`);

const client = new Client({
name: config.name,
version: '1.0.0'
});

const transport = new StreamableHTTPClientTransport(new URL(serverUrl));

// Set up client-specific error handler
client.onerror = (error) => {
console.error(`[${config.id}] Client error:`, error);
};

// Set up client-specific notification handler
client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
console.log(`[${config.id}] Notification: ${notification.params.data}`);
});

try {
// Connect to the server
await client.connect(transport);
console.log(`[${config.id}] Connected to MCP server`);

    // Call the specified tool
    console.log(`[${config.id}] Calling tool: ${config.toolName}`);
    const toolRequest: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: config.toolName,
        arguments: {
          ...config.toolArguments,
          // Add client ID to arguments for identification in notifications
          caller: config.id
        }
      }
    };

    const result = await client.request(toolRequest, CallToolResultSchema);
    console.log(`[${config.id}] Tool call completed`);

    // Keep the connection open for a bit to receive notifications
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Disconnect
    await transport.close();
    console.log(`[${config.id}] Disconnected from MCP server`);

    return { id: config.id, result };

} catch (error) {
console.error(`[${config.id}] Error:`, error);
throw error;
}
}

async function main(): Promise<void> {
console.log('MCP Multiple Clients Example');
console.log('============================');
console.log(`Server URL: ${serverUrl}`);
console.log('');

try {
// Define client configurations
const clientConfigs: ClientConfig[] = [
{
id: 'client1',
name: 'basic-client-1',
toolName: 'start-notification-stream',
toolArguments: {
interval: 3, // 1 second between notifications
count: 5 // Send 5 notifications
}
},
{
id: 'client2',
name: 'basic-client-2',
toolName: 'start-notification-stream',
toolArguments: {
interval: 2, // 2 seconds between notifications
count: 3 // Send 3 notifications
}
},
{
id: 'client3',
name: 'basic-client-3',
toolName: 'start-notification-stream',
toolArguments: {
interval: 1, // 0.5 second between notifications
count: 8 // Send 8 notifications
}
}
];

    // Start all clients in parallel
    console.log(`Starting ${clientConfigs.length} clients in parallel...`);
    console.log('');

    const clientPromises = clientConfigs.map(config => createAndRunClient(config));
    const results = await Promise.all(clientPromises);

    // Display results from all clients
    console.log('\n=== Final Results ===');
    results.forEach(({ id, result }) => {
      console.log(`\n[${id}] Tool result:`);
      if (Array.isArray(result.content)) {
        result.content.forEach((item: { type: string; text?: string }) => {
          if (item.type === 'text' && item.text) {
            console.log(`  ${item.text}`);
          } else {
            console.log(`  ${item.type} content:`, item);
          }
        });
      } else {
        console.log(`  Unexpected result format:`, result);
      }
    });

    console.log('\n=== All clients completed successfully ===');

} catch (error) {
console.error('Error running multiple clients:', error);
process.exit(1);
}
}

// Start the example
main().catch((error: unknown) => {
console.error('Error running MCP multiple clients example:', error);
process.exit(1);
});

================================================
FILE: src/examples/client/parallelToolCallsClient.ts
================================================
import { Client } from '../../client/index.js';
import { StreamableHTTPClientTransport } from '../../client/streamableHttp.js';
import {
ListToolsRequest,
ListToolsResultSchema,
CallToolResultSchema,
LoggingMessageNotificationSchema,
CallToolResult,
} from '../../types.js';

/\*\*

- Parallel Tool Calls MCP Client
-
- This client demonstrates how to:
- 1.  Start multiple tool calls in parallel
- 2.  Track notifications from each tool call using a caller parameter
      \*/

// Command line args processing
const args = process.argv.slice(2);
const serverUrl = args[0] || 'http://localhost:3000/mcp';

async function main(): Promise<void> {
console.log('MCP Parallel Tool Calls Client');
console.log('==============================');
console.log(`Connecting to server at: ${serverUrl}`);

let client: Client;
let transport: StreamableHTTPClientTransport;

try {
// Create client with streamable HTTP transport
client = new Client({
name: 'parallel-tool-calls-client',
version: '1.0.0'
});

    client.onerror = (error) => {
      console.error('Client error:', error);
    };

    // Connect to the server
    transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    await client.connect(transport);
    console.log('Successfully connected to MCP server');

    // Set up notification handler with caller identification
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      console.log(`Notification: ${notification.params.data}`);
    });

    console.log("List tools")
    const toolsRequest = await listTools(client);
    console.log("Tools: ", toolsRequest)


    // 2. Start multiple notification tools in parallel
    console.log('\n=== Starting Multiple Notification Streams in Parallel ===');
    const toolResults = await startParallelNotificationTools(client);

    // Log the results from each tool call
    for (const [caller, result] of Object.entries(toolResults)) {
      console.log(`\n=== Tool result for ${caller} ===`);
      result.content.forEach((item: { type: string; text?: string; }) => {
        if (item.type === 'text') {
          console.log(`  ${item.text}`);
        } else {
          console.log(`  ${item.type} content:`, item);
        }
      });
    }

    // 3. Wait for all notifications (10 seconds)
    console.log('\n=== Waiting for all notifications ===');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 4. Disconnect
    console.log('\n=== Disconnecting ===');
    await transport.close();
    console.log('Disconnected from MCP server');

} catch (error) {
console.error('Error running client:', error);
process.exit(1);
}
}

/\*\*

- List available tools on the server
  \*/
  async function listTools(client: Client): Promise<void> {
  try {
  const toolsRequest: ListToolsRequest = {
  method: 'tools/list',
  params: {}
  };
  const toolsResult = await client.request(toolsRequest, ListToolsResultSchema);

      console.log('Available tools:');
      if (toolsResult.tools.length === 0) {
        console.log('  No tools available');
      } else {
        for (const tool of toolsResult.tools) {
          console.log(`  - ${tool.name}: ${tool.description}`);
        }
      }

  } catch (error) {
  console.log(`Tools not supported by this server: ${error}`);
  }
  }

/\*\*

- Start multiple notification tools in parallel with different configurations
- Each tool call includes a caller parameter to identify its notifications
  \*/
  async function startParallelNotificationTools(client: Client): Promise<Record<string, CallToolResult>> {
  try {
  // Define multiple tool calls with different configurations
  const toolCalls = [
  {
  caller: 'fast-notifier',
  request: {
  method: 'tools/call',
  params: {
  name: 'start-notification-stream',
  arguments: {
  interval: 2, // 0.5 second between notifications
  count: 10, // Send 10 notifications
  caller: 'fast-notifier' // Identify this tool call
  }
  }
  }
  },
  {
  caller: 'slow-notifier',
  request: {
  method: 'tools/call',
  params: {
  name: 'start-notification-stream',
  arguments: {
  interval: 5, // 2 seconds between notifications
  count: 5, // Send 5 notifications
  caller: 'slow-notifier' // Identify this tool call
  }
  }
  }
  },
  {
  caller: 'burst-notifier',
  request: {
  method: 'tools/call',
  params: {
  name: 'start-notification-stream',
  arguments: {
  interval: 1, // 0.1 second between notifications
  count: 3, // Send just 3 notifications
  caller: 'burst-notifier' // Identify this tool call
  }
  }
  }
  }
  ];

      console.log(`Starting ${toolCalls.length} notification tools in parallel...`);

      // Start all tool calls in parallel
      const toolPromises = toolCalls.map(({ caller, request }) => {
        console.log(`Starting tool call for ${caller}...`);
        return client.request(request, CallToolResultSchema)
          .then(result => ({ caller, result }))
          .catch(error => {
            console.error(`Error in tool call for ${caller}:`, error);
            throw error;
          });
      });

      // Wait for all tool calls to complete
      const results = await Promise.all(toolPromises);

      // Organize results by caller
      const resultsByTool: Record<string, CallToolResult> = {};
      results.forEach(({ caller, result }) => {
        resultsByTool[caller] = result;
      });

      return resultsByTool;

  } catch (error) {
  console.error(`Error starting parallel notification tools:`, error);
  throw error;
  }
  }

// Start the client
main().catch((error: unknown) => {
console.error('Error running MCP client:', error);
process.exit(1);
});

================================================
FILE: src/examples/client/simpleStreamableHttp.ts
================================================
import { Client } from '../../client/index.js';
import { StreamableHTTPClientTransport } from '../../client/streamableHttp.js';
import { createInterface } from 'node:readline';
import {
ListToolsRequest,
ListToolsResultSchema,
CallToolRequest,
CallToolResultSchema,
ListPromptsRequest,
ListPromptsResultSchema,
GetPromptRequest,
GetPromptResultSchema,
ListResourcesRequest,
ListResourcesResultSchema,
LoggingMessageNotificationSchema,
ResourceListChangedNotificationSchema,
} from '../../types.js';

// Create readline interface for user input
const readline = createInterface({
input: process.stdin,
output: process.stdout
});

// Track received notifications for debugging resumability
let notificationCount = 0;

// Global client and transport for interactive commands
let client: Client | null = null;
let transport: StreamableHTTPClientTransport | null = null;
let serverUrl = 'http://localhost:3000/mcp';
let notificationsToolLastEventId: string | undefined = undefined;
let sessionId: string | undefined = undefined;

async function main(): Promise<void> {
console.log('MCP Interactive Client');
console.log('=====================');

// Connect to server immediately with default settings
await connect();

// Print help and start the command loop
printHelp();
commandLoop();
}

function printHelp(): void {
console.log('\nAvailable commands:');
console.log(' connect [url] - Connect to MCP server (default: http://localhost:3000/mcp)');
console.log(' disconnect - Disconnect from server');
console.log(' terminate-session - Terminate the current session');
console.log(' reconnect - Reconnect to the server');
console.log(' list-tools - List available tools');
console.log(' call-tool <name> [args] - Call a tool with optional JSON arguments');
console.log(' greet [name] - Call the greet tool');
console.log(' multi-greet [name] - Call the multi-greet tool with notifications');
console.log(' start-notifications [interval] [count] - Start periodic notifications');
console.log(' list-prompts - List available prompts');
console.log(' get-prompt [name] [args] - Get a prompt with optional JSON arguments');
console.log(' list-resources - List available resources');
console.log(' help - Show this help');
console.log(' quit - Exit the program');
}

function commandLoop(): void {
readline.question('\n> ', async (input) => {
const args = input.trim().split(/\s+/);
const command = args[0]?.toLowerCase();

    try {
      switch (command) {
        case 'connect':
          await connect(args[1]);
          break;

        case 'disconnect':
          await disconnect();
          break;

        case 'terminate-session':
          await terminateSession();
          break;

        case 'reconnect':
          await reconnect();
          break;

        case 'list-tools':
          await listTools();
          break;

        case 'call-tool':
          if (args.length < 2) {
            console.log('Usage: call-tool <name> [args]');
          } else {
            const toolName = args[1];
            let toolArgs = {};
            if (args.length > 2) {
              try {
                toolArgs = JSON.parse(args.slice(2).join(' '));
              } catch {
                console.log('Invalid JSON arguments. Using empty args.');
              }
            }
            await callTool(toolName, toolArgs);
          }
          break;

        case 'greet':
          await callGreetTool(args[1] || 'MCP User');
          break;

        case 'multi-greet':
          await callMultiGreetTool(args[1] || 'MCP User');
          break;

        case 'start-notifications': {
          const interval = args[1] ? parseInt(args[1], 10) : 2000;
          const count = args[2] ? parseInt(args[2], 10) : 10;
          await startNotifications(interval, count);
          break;
        }

        case 'list-prompts':
          await listPrompts();
          break;

        case 'get-prompt':
          if (args.length < 2) {
            console.log('Usage: get-prompt <name> [args]');
          } else {
            const promptName = args[1];
            let promptArgs = {};
            if (args.length > 2) {
              try {
                promptArgs = JSON.parse(args.slice(2).join(' '));
              } catch {
                console.log('Invalid JSON arguments. Using empty args.');
              }
            }
            await getPrompt(promptName, promptArgs);
          }
          break;

        case 'list-resources':
          await listResources();
          break;

        case 'help':
          printHelp();
          break;

        case 'quit':
        case 'exit':
          await cleanup();
          return;

        default:
          if (command) {
            console.log(`Unknown command: ${command}`);
          }
          break;
      }
    } catch (error) {
      console.error(`Error executing command: ${error}`);
    }

    // Continue the command loop
    commandLoop();

});
}

async function connect(url?: string): Promise<void> {
if (client) {
console.log('Already connected. Disconnect first.');
return;
}

if (url) {
serverUrl = url;
}

console.log(`Connecting to ${serverUrl}...`);

try {
// Create a new client
client = new Client({
name: 'example-client',
version: '1.0.0'
});
client.onerror = (error) => {
console.error('\x1b[31mClient error:', error, '\x1b[0m');
}

    transport = new StreamableHTTPClientTransport(
      new URL(serverUrl),
      {
        sessionId: sessionId
      }
    );

    // Set up notification handlers
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      notificationCount++;
      console.log(`\nNotification #${notificationCount}: ${notification.params.level} - ${notification.params.data}`);
      // Re-display the prompt
      process.stdout.write('> ');
    });

    client.setNotificationHandler(ResourceListChangedNotificationSchema, async (_) => {
      console.log(`\nResource list changed notification received!`);
      try {
        if (!client) {
          console.log('Client disconnected, cannot fetch resources');
          return;
        }
        const resourcesResult = await client.request({
          method: 'resources/list',
          params: {}
        }, ListResourcesResultSchema);
        console.log('Available resources count:', resourcesResult.resources.length);
      } catch {
        console.log('Failed to list resources after change notification');
      }
      // Re-display the prompt
      process.stdout.write('> ');
    });

    // Connect the client
    await client.connect(transport);
    sessionId = transport.sessionId
    console.log('Transport created with session ID:', sessionId);
    console.log('Connected to MCP server');

} catch (error) {
console.error('Failed to connect:', error);
client = null;
transport = null;
}
}

async function disconnect(): Promise<void> {
if (!client || !transport) {
console.log('Not connected.');
return;
}

try {
await transport.close();
console.log('Disconnected from MCP server');
client = null;
transport = null;
} catch (error) {
console.error('Error disconnecting:', error);
}
}

async function terminateSession(): Promise<void> {
if (!client || !transport) {
console.log('Not connected.');
return;
}

try {
console.log('Terminating session with ID:', transport.sessionId);
await transport.terminateSession();
console.log('Session terminated successfully');

    // Check if sessionId was cleared after termination
    if (!transport.sessionId) {
      console.log('Session ID has been cleared');
      sessionId = undefined;

      // Also close the transport and clear client objects
      await transport.close();
      console.log('Transport closed after session termination');
      client = null;
      transport = null;
    } else {
      console.log('Server responded with 405 Method Not Allowed (session termination not supported)');
      console.log('Session ID is still active:', transport.sessionId);
    }

} catch (error) {
console.error('Error terminating session:', error);
}
}

async function reconnect(): Promise<void> {
if (client) {
await disconnect();
}
await connect();
}

async function listTools(): Promise<void> {
if (!client) {
console.log('Not connected to server.');
return;
}

try {
const toolsRequest: ListToolsRequest = {
method: 'tools/list',
params: {}
};
const toolsResult = await client.request(toolsRequest, ListToolsResultSchema);

    console.log('Available tools:');
    if (toolsResult.tools.length === 0) {
      console.log('  No tools available');
    } else {
      for (const tool of toolsResult.tools) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }

} catch (error) {
console.log(`Tools not supported by this server (${error})`);
}
}

async function callTool(name: string, args: Record<string, unknown>): Promise<void> {
if (!client) {
console.log('Not connected to server.');
return;
}

try {
const request: CallToolRequest = {
method: 'tools/call',
params: {
name,
arguments: args
}
};

    console.log(`Calling tool '${name}' with args:`, args);
    const onLastEventIdUpdate = (event: string) => {
      notificationsToolLastEventId = event;
    };
    const result = await client.request(request, CallToolResultSchema, {
      resumptionToken: notificationsToolLastEventId, onresumptiontoken: onLastEventIdUpdate
    });

    console.log('Tool result:');
    result.content.forEach(item => {
      if (item.type === 'text') {
        console.log(`  ${item.text}`);
      } else {
        console.log(`  ${item.type} content:`, item);
      }
    });

} catch (error) {
console.log(`Error calling tool ${name}: ${error}`);
}
}

async function callGreetTool(name: string): Promise<void> {
await callTool('greet', { name });
}

async function callMultiGreetTool(name: string): Promise<void> {
console.log('Calling multi-greet tool with notifications...');
await callTool('multi-greet', { name });
}

async function startNotifications(interval: number, count: number): Promise<void> {
console.log(`Starting notification stream: interval=${interval}ms, count=${count || 'unlimited'}`);
await callTool('start-notification-stream', { interval, count });
}

async function listPrompts(): Promise<void> {
if (!client) {
console.log('Not connected to server.');
return;
}

try {
const promptsRequest: ListPromptsRequest = {
method: 'prompts/list',
params: {}
};
const promptsResult = await client.request(promptsRequest, ListPromptsResultSchema);
console.log('Available prompts:');
if (promptsResult.prompts.length === 0) {
console.log(' No prompts available');
} else {
for (const prompt of promptsResult.prompts) {
console.log(`  - ${prompt.name}: ${prompt.description}`);
}
}
} catch (error) {
console.log(`Prompts not supported by this server (${error})`);
}
}

async function getPrompt(name: string, args: Record<string, unknown>): Promise<void> {
if (!client) {
console.log('Not connected to server.');
return;
}

try {
const promptRequest: GetPromptRequest = {
method: 'prompts/get',
params: {
name,
arguments: args as Record<string, string>
}
};

    const promptResult = await client.request(promptRequest, GetPromptResultSchema);
    console.log('Prompt template:');
    promptResult.messages.forEach((msg, index) => {
      console.log(`  [${index + 1}] ${msg.role}: ${msg.content.text}`);
    });

} catch (error) {
console.log(`Error getting prompt ${name}: ${error}`);
}
}

async function listResources(): Promise<void> {
if (!client) {
console.log('Not connected to server.');
return;
}

try {
const resourcesRequest: ListResourcesRequest = {
method: 'resources/list',
params: {}
};
const resourcesResult = await client.request(resourcesRequest, ListResourcesResultSchema);

    console.log('Available resources:');
    if (resourcesResult.resources.length === 0) {
      console.log('  No resources available');
    } else {
      for (const resource of resourcesResult.resources) {
        console.log(`  - ${resource.name}: ${resource.uri}`);
      }
    }

} catch (error) {
console.log(`Resources not supported by this server (${error})`);
}
}

async function cleanup(): Promise<void> {
if (client && transport) {
try {
// First try to terminate the session gracefully
if (transport.sessionId) {
try {
console.log('Terminating session before exit...');
await transport.terminateSession();
console.log('Session terminated successfully');
} catch (error) {
console.error('Error terminating session:', error);
}
}

      // Then close the transport
      await transport.close();
    } catch (error) {
      console.error('Error closing transport:', error);
    }

}

process.stdin.setRawMode(false);
readline.close();
console.log('\nGoodbye!');
process.exit(0);
}

// Set up raw mode for keyboard input to capture Escape key
process.stdin.setRawMode(true);
process.stdin.on('data', async (data) => {
// Check for Escape key (27)
if (data.length === 1 && data[0] === 27) {
console.log('\nESC key pressed. Disconnecting from server...');

    // Abort current operation and disconnect from server
    if (client && transport) {
      await disconnect();
      console.log('Disconnected. Press Enter to continue.');
    } else {
      console.log('Not connected to server.');
    }

    // Re-display the prompt
    process.stdout.write('> ');

}
});

// Handle Ctrl+C
process.on('SIGINT', async () => {
console.log('\nReceived SIGINT. Cleaning up...');
await cleanup();
});

// Start the interactive client
main().catch((error: unknown) => {
console.error('Error running MCP client:', error);
process.exit(1);
});

================================================
FILE: src/examples/client/streamableHttpWithSseFallbackClient.ts
================================================
import { Client } from '../../client/index.js';
import { StreamableHTTPClientTransport } from '../../client/streamableHttp.js';
import { SSEClientTransport } from '../../client/sse.js';
import {
ListToolsRequest,
ListToolsResultSchema,
CallToolRequest,
CallToolResultSchema,
LoggingMessageNotificationSchema,
} from '../../types.js';

/\*\*

- Simplified Backwards Compatible MCP Client
-
- This client demonstrates backward compatibility with both:
- 1.  Modern servers using Streamable HTTP transport (protocol version 2025-03-26)
- 2.  Older servers using HTTP+SSE transport (protocol version 2024-11-05)
-
- Following the MCP specification for backwards compatibility:
- - Attempts to POST an initialize request to the server URL first (modern transport)
- - If that fails with 4xx status, falls back to GET request for SSE stream (older transport)
    \*/

// Command line args processing
const args = process.argv.slice(2);
const serverUrl = args[0] || 'http://localhost:3000/mcp';

async function main(): Promise<void> {
console.log('MCP Backwards Compatible Client');
console.log('===============================');
console.log(`Connecting to server at: ${serverUrl}`);

let client: Client;
let transport: StreamableHTTPClientTransport | SSEClientTransport;

try {
// Try connecting with automatic transport detection
const connection = await connectWithBackwardsCompatibility(serverUrl);
client = connection.client;
transport = connection.transport;

    // Set up notification handler
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      console.log(`Notification: ${notification.params.level} - ${notification.params.data}`);
    });

    // DEMO WORKFLOW:
    // 1. List available tools
    console.log('\n=== Listing Available Tools ===');
    await listTools(client);

    // 2. Call the notification tool
    console.log('\n=== Starting Notification Stream ===');
    await startNotificationTool(client);

    // 3. Wait for all notifications (5 seconds)
    console.log('\n=== Waiting for all notifications ===');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. Disconnect
    console.log('\n=== Disconnecting ===');
    await transport.close();
    console.log('Disconnected from MCP server');

} catch (error) {
console.error('Error running client:', error);
process.exit(1);
}
}

/\*\*

- Connect to an MCP server with backwards compatibility
- Following the spec for client backward compatibility
  \*/
  async function connectWithBackwardsCompatibility(url: string): Promise<{
  client: Client,
  transport: StreamableHTTPClientTransport | SSEClientTransport,
  transportType: 'streamable-http' | 'sse'
  }> {
  console.log('1. Trying Streamable HTTP transport first...');

// Step 1: Try Streamable HTTP transport first
const client = new Client({
name: 'backwards-compatible-client',
version: '1.0.0'
});

client.onerror = (error) => {
console.error('Client error:', error);
};
const baseUrl = new URL(url);

try {
// Create modern transport
const streamableTransport = new StreamableHTTPClientTransport(baseUrl);
await client.connect(streamableTransport);

    console.log('Successfully connected using modern Streamable HTTP transport.');
    return {
      client,
      transport: streamableTransport,
      transportType: 'streamable-http'
    };

} catch (error) {
// Step 2: If transport fails, try the older SSE transport
console.log(`StreamableHttp transport connection failed: ${error}`);
console.log('2. Falling back to deprecated HTTP+SSE transport...');

    try {
      // Create SSE transport pointing to /sse endpoint
      const sseTransport = new SSEClientTransport(baseUrl);
      const sseClient = new Client({
        name: 'backwards-compatible-client',
        version: '1.0.0'
      });
      await sseClient.connect(sseTransport);

      console.log('Successfully connected using deprecated HTTP+SSE transport.');
      return {
        client: sseClient,
        transport: sseTransport,
        transportType: 'sse'
      };
    } catch (sseError) {
      console.error(`Failed to connect with either transport method:\n1. Streamable HTTP error: ${error}\n2. SSE error: ${sseError}`);
      throw new Error('Could not connect to server with any available transport');
    }

}
}

/\*\*

- List available tools on the server
  \*/
  async function listTools(client: Client): Promise<void> {
  try {
  const toolsRequest: ListToolsRequest = {
  method: 'tools/list',
  params: {}
  };
  const toolsResult = await client.request(toolsRequest, ListToolsResultSchema);

      console.log('Available tools:');
      if (toolsResult.tools.length === 0) {
        console.log('  No tools available');
      } else {
        for (const tool of toolsResult.tools) {
          console.log(`  - ${tool.name}: ${tool.description}`);
        }
      }

  } catch (error) {
  console.log(`Tools not supported by this server: ${error}`);
  }
  }

/\*\*

- Start a notification stream by calling the notification tool
  \*/
  async function startNotificationTool(client: Client): Promise<void> {
  try {
  // Call the notification tool using reasonable defaults
  const request: CallToolRequest = {
  method: 'tools/call',
  params: {
  name: 'start-notification-stream',
  arguments: {
  interval: 1000, // 1 second between notifications
  count: 5 // Send 5 notifications
  }
  }
  };

      console.log('Calling notification tool...');
      const result = await client.request(request, CallToolResultSchema);

      console.log('Tool result:');
      result.content.forEach(item => {
        if (item.type === 'text') {
          console.log(`  ${item.text}`);
        } else {
          console.log(`  ${item.type} content:`, item);
        }
      });

  } catch (error) {
  console.log(`Error calling notification tool: ${error}`);
  }
  }

// Start the client
main().catch((error: unknown) => {
console.error('Error running MCP client:', error);
process.exit(1);
});

================================================
FILE: src/examples/server/jsonResponseStreamableHttp.ts
================================================
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '../../server/mcp.js';
import { StreamableHTTPServerTransport } from '../../server/streamableHttp.js';
import { z } from 'zod';
import { CallToolResult, isInitializeRequest } from '../../types.js';

// Create an MCP server with implementation details
const getServer = () => {
const server = new McpServer({
name: 'json-response-streamable-http-server',
version: '1.0.0',
}, {
capabilities: {
logging: {},
}
});

// Register a simple tool that returns a greeting
server.tool(
'greet',
'A simple greeting tool',
{
name: z.string().describe('Name to greet'),
},
async ({ name }): Promise<CallToolResult> => {
return {
content: [
{
type: 'text',
text: `Hello, ${name}!`,
},
],
};
}
);

// Register a tool that sends multiple greetings with notifications
server.tool(
'multi-greet',
'A tool that sends different greetings with delays between them',
{
name: z.string().describe('Name to greet'),
},
async ({ name }, { sendNotification }): Promise<CallToolResult> => {
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      await sendNotification({
        method: "notifications/message",
        params: { level: "debug", data: `Starting multi-greet for ${name}` }
      });

      await sleep(1000); // Wait 1 second before first greeting

      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: `Sending first greeting to ${name}` }
      });

      await sleep(1000); // Wait another second before second greeting

      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: `Sending second greeting to ${name}` }
      });

      return {
        content: [
          {
            type: 'text',
            text: `Good morning, ${name}!`,
          }
        ],
      };
    }

);
return server;
}

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

app.post('/mcp', async (req: Request, res: Response) => {
console.log('Received MCP request:', req.body);
try {
// Check for existing session ID
const sessionId = req.headers['mcp-session-id'] as string | undefined;
let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request - use JSON response mode
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true, // Enable JSON response mode
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID when session is initialized
          // This avoids race conditions where requests might come in before the session is stored
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        }
      });

      // Connect the transport to the MCP server BEFORE handling the request
      const server = getServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return; // Already handled
    } else {
      // Invalid request - no session ID or not initialization request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request with existing transport - no need to reconnect
    await transport.handleRequest(req, res, req.body);

} catch (error) {
console.error('Error handling MCP request:', error);
if (!res.headersSent) {
res.status(500).json({
jsonrpc: '2.0',
error: {
code: -32603,
message: 'Internal server error',
},
id: null,
});
}
}
});

// Handle GET requests for SSE streams according to spec
app.get('/mcp', async (req: Request, res: Response) => {
// Since this is a very simple example, we don't support GET requests for this server
// The spec requires returning 405 Method Not Allowed in this case
res.status(405).set('Allow', 'POST').send('Method Not Allowed');
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
console.log('Shutting down server...');
process.exit(0);
});

================================================
FILE: src/examples/server/simpleSseServer.ts
================================================
import express, { Request, Response } from 'express';
import { McpServer } from '../../server/mcp.js';
import { SSEServerTransport } from '../../server/sse.js';
import { z } from 'zod';
import { CallToolResult } from '../../types.js';

/\*\*

- This example server demonstrates the deprecated HTTP+SSE transport
- (protocol version 2024-11-05). It mainly used for testing backward compatible clients.
-
- The server exposes two endpoints:
- - /mcp: For establishing the SSE stream (GET)
- - /messages: For receiving client messages (POST)
- \*/

// Create an MCP server instance
const getServer = () => {
const server = new McpServer({
name: 'simple-sse-server',
version: '1.0.0',
}, { capabilities: { logging: {} } });

server.tool(
'start-notification-stream',
'Starts sending periodic notifications',
{
interval: z.number().describe('Interval in milliseconds between notifications').default(1000),
count: z.number().describe('Number of notifications to send').default(10),
},
async ({ interval, count }, { sendNotification }): Promise<CallToolResult> => {
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let counter = 0;

      // Send the initial notification
      await sendNotification({
        method: "notifications/message",
        params: {
          level: "info",
          data: `Starting notification stream with ${count} messages every ${interval}ms`
        }
      });

      // Send periodic notifications
      while (counter < count) {
        counter++;
        await sleep(interval);

        try {
          await sendNotification({
            method: "notifications/message",
            params: {
              level: "info",
              data: `Notification #${counter} at ${new Date().toISOString()}`
            }
          });
        }
        catch (error) {
          console.error("Error sending notification:", error);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Completed sending ${count} notifications every ${interval}ms`,
          }
        ],
      };
    }

);
return server;
};

const app = express();
app.use(express.json());

// Store transports by session ID
const transports: Record<string, SSEServerTransport> = {};

// SSE endpoint for establishing the stream
app.get('/mcp', async (req: Request, res: Response) => {
console.log('Received GET request to /sse (establishing SSE stream)');

try {
// Create a new SSE transport for the client
// The endpoint for POST messages is '/messages'
const transport = new SSEServerTransport('/messages', res);

    // Store the transport by session ID
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;

    // Set up onclose handler to clean up transport when closed
    transport.onclose = () => {
      console.log(`SSE transport closed for session ${sessionId}`);
      delete transports[sessionId];
    };

    // Connect the transport to the MCP server
    const server = getServer();
    await server.connect(transport);

    console.log(`Established SSE stream with session ID: ${sessionId}`);

} catch (error) {
console.error('Error establishing SSE stream:', error);
if (!res.headersSent) {
res.status(500).send('Error establishing SSE stream');
}
}
});

// Messages endpoint for receiving client JSON-RPC requests
app.post('/messages', async (req: Request, res: Response) => {
console.log('Received POST request to /messages');

// Extract session ID from URL query parameter
// In the SSE protocol, this is added by the client based on the endpoint event
const sessionId = req.query.sessionId as string | undefined;

if (!sessionId) {
console.error('No session ID provided in request URL');
res.status(400).send('Missing sessionId parameter');
return;
}

const transport = transports[sessionId];
if (!transport) {
console.error(`No active transport found for session ID: ${sessionId}`);
res.status(404).send('Session not found');
return;
}

try {
// Handle the POST message with the transport
await transport.handlePostMessage(req, res, req.body);
} catch (error) {
console.error('Error handling request:', error);
if (!res.headersSent) {
res.status(500).send('Error handling request');
}
}
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
console.log(`Simple SSE Server (deprecated protocol version 2024-11-05) listening on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
console.log('Shutting down server...');

// Close all active transports to properly clean up resources
for (const sessionId in transports) {
try {
console.log(`Closing transport for session ${sessionId}`);
await transports[sessionId].close();
delete transports[sessionId];
} catch (error) {
console.error(`Error closing transport for session ${sessionId}:`, error);
}
}
console.log('Server shutdown complete');
process.exit(0);
});

================================================
FILE: src/examples/server/simpleStatelessStreamableHttp.ts
================================================
import express, { Request, Response } from 'express';
import { McpServer } from '../../server/mcp.js';
import { StreamableHTTPServerTransport } from '../../server/streamableHttp.js';
import { z } from 'zod';
import { CallToolResult, GetPromptResult, ReadResourceResult } from '../../types.js';

const getServer = () => {
// Create an MCP server with implementation details
const server = new McpServer({
name: 'stateless-streamable-http-server',
version: '1.0.0',
}, { capabilities: { logging: {} } });

// Register a simple prompt
server.prompt(
'greeting-template',
'A simple greeting prompt template',
{
name: z.string().describe('Name to include in greeting'),
},
async ({ name }): Promise<GetPromptResult> => {
return {
messages: [
{
role: 'user',
content: {
type: 'text',
text: `Please greet ${name} in a friendly manner.`,
},
},
],
};
}
);

// Register a tool specifically for testing resumability
server.tool(
'start-notification-stream',
'Starts sending periodic notifications for testing resumability',
{
interval: z.number().describe('Interval in milliseconds between notifications').default(100),
count: z.number().describe('Number of notifications to send (0 for 100)').default(10),
},
async ({ interval, count }, { sendNotification }): Promise<CallToolResult> => {
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let counter = 0;

      while (count === 0 || counter < count) {
        counter++;
        try {
          await sendNotification({
            method: "notifications/message",
            params: {
              level: "info",
              data: `Periodic notification #${counter} at ${new Date().toISOString()}`
            }
          });
        }
        catch (error) {
          console.error("Error sending notification:", error);
        }
        // Wait for the specified interval
        await sleep(interval);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Started sending periodic notifications every ${interval}ms`,
          }
        ],
      };
    }

);

// Create a simple resource at a fixed URI
server.resource(
'greeting-resource',
'https://example.com/greetings/default',
{ mimeType: 'text/plain' },
async (): Promise<ReadResourceResult> => {
return {
contents: [
{
uri: 'https://example.com/greetings/default',
text: 'Hello, world!',
},
],
};
}
);
return server;
}

const app = express();
app.use(express.json());

app.post('/mcp', async (req: Request, res: Response) => {
const server = getServer();
try {
const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
sessionIdGenerator: undefined,
});
await server.connect(transport);
await transport.handleRequest(req, res, req.body);
res.on('close', () => {
console.log('Request closed');
transport.close();
server.close();
});
} catch (error) {
console.error('Error handling MCP request:', error);
if (!res.headersSent) {
res.status(500).json({
jsonrpc: '2.0',
error: {
code: -32603,
message: 'Internal server error',
},
id: null,
});
}
}
});

app.get('/mcp', async (req: Request, res: Response) => {
console.log('Received GET MCP request');
res.writeHead(405).end(JSON.stringify({
jsonrpc: "2.0",
error: {
code: -32000,
message: "Method not allowed."
},
id: null
}));
});

app.delete('/mcp', async (req: Request, res: Response) => {
console.log('Received DELETE MCP request');
res.writeHead(405).end(JSON.stringify({
jsonrpc: "2.0",
error: {
code: -32000,
message: "Method not allowed."
},
id: null
}));
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
console.log(`MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
console.log('Shutting down server...');
process.exit(0);
});

================================================
FILE: src/examples/server/simpleStreamableHttp.ts
================================================
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { McpServer } from '../../server/mcp.js';
import { StreamableHTTPServerTransport } from '../../server/streamableHttp.js';
import { CallToolResult, GetPromptResult, isInitializeRequest, ReadResourceResult } from '../../types.js';
import { InMemoryEventStore } from '../shared/inMemoryEventStore.js';

// Create an MCP server with implementation details
const getServer = () => {
const server = new McpServer({
name: 'simple-streamable-http-server',
version: '1.0.0',
}, { capabilities: { logging: {} } });

// Register a simple tool that returns a greeting
server.tool(
'greet',
'A simple greeting tool',
{
name: z.string().describe('Name to greet'),
},
async ({ name }): Promise<CallToolResult> => {
return {
content: [
{
type: 'text',
text: `Hello, ${name}!`,
},
],
};
}
);

// Register a tool that sends multiple greetings with notifications (with annotations)
server.tool(
'multi-greet',
'A tool that sends different greetings with delays between them',
{
name: z.string().describe('Name to greet'),
},
{
title: 'Multiple Greeting Tool',
readOnlyHint: true,
openWorldHint: false
},
async ({ name }, { sendNotification }): Promise<CallToolResult> => {
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      await sendNotification({
        method: "notifications/message",
        params: { level: "debug", data: `Starting multi-greet for ${name}` }
      });

      await sleep(1000); // Wait 1 second before first greeting

      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: `Sending first greeting to ${name}` }
      });

      await sleep(1000); // Wait another second before second greeting

      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: `Sending second greeting to ${name}` }
      });

      return {
        content: [
          {
            type: 'text',
            text: `Good morning, ${name}!`,
          }
        ],
      };
    }

);

// Register a simple prompt
server.prompt(
'greeting-template',
'A simple greeting prompt template',
{
name: z.string().describe('Name to include in greeting'),
},
async ({ name }): Promise<GetPromptResult> => {
return {
messages: [
{
role: 'user',
content: {
type: 'text',
text: `Please greet ${name} in a friendly manner.`,
},
},
],
};
}
);

// Register a tool specifically for testing resumability
server.tool(
'start-notification-stream',
'Starts sending periodic notifications for testing resumability',
{
interval: z.number().describe('Interval in milliseconds between notifications').default(100),
count: z.number().describe('Number of notifications to send (0 for 100)').default(50),
},
async ({ interval, count }, { sendNotification }): Promise<CallToolResult> => {
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let counter = 0;

      while (count === 0 || counter < count) {
        counter++;
        try {
          await sendNotification({
            method: "notifications/message",
            params: {
              level: "info",
              data: `Periodic notification #${counter} at ${new Date().toISOString()}`
            }
          });
        }
        catch (error) {
          console.error("Error sending notification:", error);
        }
        // Wait for the specified interval
        await sleep(interval);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Started sending periodic notifications every ${interval}ms`,
          }
        ],
      };
    }

);

// Create a simple resource at a fixed URI
server.resource(
'greeting-resource',
'https://example.com/greetings/default',
{ mimeType: 'text/plain' },
async (): Promise<ReadResourceResult> => {
return {
contents: [
{
uri: 'https://example.com/greetings/default',
text: 'Hello, world!',
},
],
};
}
);
return server;
};

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

app.post('/mcp', async (req: Request, res: Response) => {
console.log('Received MCP request:', req.body);
try {
// Check for existing session ID
const sessionId = req.headers['mcp-session-id'] as string | undefined;
let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore, // Enable resumability
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID when session is initialized
          // This avoids race conditions where requests might come in before the session is stored
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        }
      });

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}, removing from transports map`);
          delete transports[sid];
        }
      };

      // Connect the transport to the MCP server BEFORE handling the request
      // so responses can flow back through the same transport
      const server = getServer();
      await server.connect(transport);

      await transport.handleRequest(req, res, req.body);
      return; // Already handled
    } else {
      // Invalid request - no session ID or not initialization request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request with existing transport - no need to reconnect
    // The existing transport is already connected to the server
    await transport.handleRequest(req, res, req.body);

} catch (error) {
console.error('Error handling MCP request:', error);
if (!res.headersSent) {
res.status(500).json({
jsonrpc: '2.0',
error: {
code: -32603,
message: 'Internal server error',
},
id: null,
});
}
}
});

// Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
app.get('/mcp', async (req: Request, res: Response) => {
const sessionId = req.headers['mcp-session-id'] as string | undefined;
if (!sessionId || !transports[sessionId]) {
res.status(400).send('Invalid or missing session ID');
return;
}

// Check for Last-Event-ID header for resumability
const lastEventId = req.headers['last-event-id'] as string | undefined;
if (lastEventId) {
console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
} else {
console.log(`Establishing new SSE stream for session ${sessionId}`);
}

const transport = transports[sessionId];
await transport.handleRequest(req, res);
});

// Handle DELETE requests for session termination (according to MCP spec)
app.delete('/mcp', async (req: Request, res: Response) => {
const sessionId = req.headers['mcp-session-id'] as string | undefined;
if (!sessionId || !transports[sessionId]) {
res.status(400).send('Invalid or missing session ID');
return;
}

console.log(`Received session termination request for session ${sessionId}`);

try {
const transport = transports[sessionId];
await transport.handleRequest(req, res);
} catch (error) {
console.error('Error handling session termination:', error);
if (!res.headersSent) {
res.status(500).send('Error processing session termination');
}
}
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
console.log('Shutting down server...');

// Close all active transports to properly clean up resources
for (const sessionId in transports) {
try {
console.log(`Closing transport for session ${sessionId}`);
await transports[sessionId].close();
delete transports[sessionId];
} catch (error) {
console.error(`Error closing transport for session ${sessionId}:`, error);
}
}
console.log('Server shutdown complete');
process.exit(0);
});

================================================
FILE: src/examples/server/sseAndStreamableHttpCompatibleServer.ts
================================================
import express, { Request, Response } from 'express';
import { randomUUID } from "node:crypto";
import { McpServer } from '../../server/mcp.js';
import { StreamableHTTPServerTransport } from '../../server/streamableHttp.js';
import { SSEServerTransport } from '../../server/sse.js';
import { z } from 'zod';
import { CallToolResult, isInitializeRequest } from '../../types.js';
import { InMemoryEventStore } from '../shared/inMemoryEventStore.js';

/\*\*

- This example server demonstrates backwards compatibility with both:
- 1.  The deprecated HTTP+SSE transport (protocol version 2024-11-05)
- 2.  The Streamable HTTP transport (protocol version 2025-03-26)
-
- It maintains a single MCP server instance but exposes two transport options:
- - /mcp: The new Streamable HTTP endpoint (supports GET/POST/DELETE)
- - /sse: The deprecated SSE endpoint for older clients (GET to establish stream)
- - /messages: The deprecated POST endpoint for older clients (POST to send messages)
    \*/

const getServer = () => {
const server = new McpServer({
name: 'backwards-compatible-server',
version: '1.0.0',
}, { capabilities: { logging: {} } });

// Register a simple tool that sends notifications over time
server.tool(
'start-notification-stream',
'Starts sending periodic notifications for testing resumability',
{
interval: z.number().describe('Interval in milliseconds between notifications').default(100),
count: z.number().describe('Number of notifications to send (0 for 100)').default(50),
},
async ({ interval, count }, { sendNotification }): Promise<CallToolResult> => {
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let counter = 0;

      while (count === 0 || counter < count) {
        counter++;
        try {
          await sendNotification({
            method: "notifications/message",
            params: {
              level: "info",
              data: `Periodic notification #${counter} at ${new Date().toISOString()}`
            }
          });
        }
        catch (error) {
          console.error("Error sending notification:", error);
        }
        // Wait for the specified interval
        await sleep(interval);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Started sending periodic notifications every ${interval}ms`,
          }
        ],
      };
    }

);
return server;
};

// Create Express application
const app = express();
app.use(express.json());

// Store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport | SSEServerTransport> = {};

//=============================================================================
// STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
//=============================================================================

// Handle all MCP Streamable HTTP requests (GET, POST, DELETE) on a single endpoint
app.all('/mcp', async (req: Request, res: Response) => {
console.log(`Received ${req.method} request to /mcp`);

try {
// Check for existing session ID
const sessionId = req.headers['mcp-session-id'] as string | undefined;
let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Check if the transport is of the correct type
      const existingTransport = transports[sessionId];
      if (existingTransport instanceof StreamableHTTPServerTransport) {
        // Reuse existing transport
        transport = existingTransport;
      } else {
        // Transport exists but is not a StreamableHTTPServerTransport (could be SSEServerTransport)
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Session exists but uses a different transport protocol',
          },
          id: null,
        });
        return;
      }
    } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore, // Enable resumability
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID when session is initialized
          console.log(`StreamableHTTP session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        }
      });

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}, removing from transports map`);
          delete transports[sid];
        }
      };

      // Connect the transport to the MCP server
      const server = getServer();
      await server.connect(transport);
    } else {
      // Invalid request - no session ID or not initialization request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request with the transport
    await transport.handleRequest(req, res, req.body);

} catch (error) {
console.error('Error handling MCP request:', error);
if (!res.headersSent) {
res.status(500).json({
jsonrpc: '2.0',
error: {
code: -32603,
message: 'Internal server error',
},
id: null,
});
}
}
});

//=============================================================================
// DEPRECATED HTTP+SSE TRANSPORT (PROTOCOL VERSION 2024-11-05)
//=============================================================================

app.get('/sse', async (req: Request, res: Response) => {
console.log('Received GET request to /sse (deprecated SSE transport)');
const transport = new SSEServerTransport('/messages', res);
transports[transport.sessionId] = transport;
res.on("close", () => {
delete transports[transport.sessionId];
});
const server = getServer();
await server.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
const sessionId = req.query.sessionId as string;
let transport: SSEServerTransport;
const existingTransport = transports[sessionId];
if (existingTransport instanceof SSEServerTransport) {
// Reuse existing transport
transport = existingTransport;
} else {
// Transport exists but is not a SSEServerTransport (could be StreamableHTTPServerTransport)
res.status(400).json({
jsonrpc: '2.0',
error: {
code: -32000,
message: 'Bad Request: Session exists but uses a different transport protocol',
},
id: null,
});
return;
}
if (transport) {
await transport.handlePostMessage(req, res, req.body);
} else {
res.status(400).send('No transport found for sessionId');
}
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
console.log(`Backwards compatible MCP server listening on port ${PORT}`);
console.log(`
==============================================
SUPPORTED TRANSPORT OPTIONS:

1. Streamable Http(Protocol version: 2025-03-26)
   Endpoint: /mcp
   Methods: GET, POST, DELETE
   Usage:

   - Initialize with POST to /mcp
   - Establish SSE stream with GET to /mcp
   - Send requests with POST to /mcp
   - Terminate session with DELETE to /mcp

2. Http + SSE (Protocol version: 2024-11-05)
   Endpoints: /sse (GET) and /messages (POST)
   Usage: - Establish SSE stream with GET to /sse - Send requests with POST to /messages?sessionId=<id>
   ==============================================
   `);
   });

// Handle server shutdown
process.on('SIGINT', async () => {
console.log('Shutting down server...');

// Close all active transports to properly clean up resources
for (const sessionId in transports) {
try {
console.log(`Closing transport for session ${sessionId}`);
await transports[sessionId].close();
delete transports[sessionId];
} catch (error) {
console.error(`Error closing transport for session ${sessionId}:`, error);
}
}
console.log('Server shutdown complete');
process.exit(0);
});

================================================
FILE: src/examples/server/standaloneSseWithGetStreamableHttp.ts
================================================
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '../../server/mcp.js';
import { StreamableHTTPServerTransport } from '../../server/streamableHttp.js';
import { isInitializeRequest, ReadResourceResult } from '../../types.js';

// Create an MCP server with implementation details
const server = new McpServer({
name: 'resource-list-changed-notification-server',
version: '1.0.0',
});

// Store transports by session ID to send notifications
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

const addResource = (name: string, content: string) => {
const uri = `https://mcp-example.com/dynamic/${encodeURIComponent(name)}`;
server.resource(
name,
uri,
{ mimeType: 'text/plain', description: `Dynamic resource: ${name}` },
async (): Promise<ReadResourceResult> => {
return {
contents: [{ uri, text: content }],
};
}
);

};

addResource('example-resource', 'Initial content for example-resource');

const resourceChangeInterval = setInterval(() => {
const name = randomUUID();
addResource(name, `Content for ${name}`);
}, 5000); // Change resources every 5 seconds for testing

const app = express();
app.use(express.json());

app.post('/mcp', async (req: Request, res: Response) => {
console.log('Received MCP request:', req.body);
try {
// Check for existing session ID
const sessionId = req.headers['mcp-session-id'] as string | undefined;
let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID when session is initialized
          // This avoids race conditions where requests might come in before the session is stored
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        }
      });

      // Connect the transport to the MCP server
      await server.connect(transport);

      // Handle the request - the onsessioninitialized callback will store the transport
      await transport.handleRequest(req, res, req.body);
      return; // Already handled
    } else {
      // Invalid request - no session ID or not initialization request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request with existing transport
    await transport.handleRequest(req, res, req.body);

} catch (error) {
console.error('Error handling MCP request:', error);
if (!res.headersSent) {
res.status(500).json({
jsonrpc: '2.0',
error: {
code: -32603,
message: 'Internal server error',
},
id: null,
});
}
}
});

// Handle GET requests for SSE streams (now using built-in support from StreamableHTTP)
app.get('/mcp', async (req: Request, res: Response) => {
const sessionId = req.headers['mcp-session-id'] as string | undefined;
if (!sessionId || !transports[sessionId]) {
res.status(400).send('Invalid or missing session ID');
return;
}

console.log(`Establishing SSE stream for session ${sessionId}`);
const transport = transports[sessionId];
await transport.handleRequest(req, res);
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
console.log(`Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
console.log('Shutting down server...');
clearInterval(resourceChangeInterval);
await server.close();
process.exit(0);
});

================================================
FILE: src/examples/shared/inMemoryEventStore.ts
================================================
import { JSONRPCMessage } from '../../types.js';
import { EventStore } from '../../server/streamableHttp.js';

/\*\*

- Simple in-memory implementation of the EventStore interface for resumability
- This is primarily intended for examples and testing, not for production use
- where a persistent storage solution would be more appropriate.
  \*/
  export class InMemoryEventStore implements EventStore {
  private events: Map<string, { streamId: string, message: JSONRPCMessage }> = new Map();

/\*\*

- Generates a unique event ID for a given stream ID
  \*/
  private generateEventId(streamId: string): string {
  return `${streamId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

/\*\*

- Extracts the stream ID from an event ID
  \*/
  private getStreamIdFromEventId(eventId: string): string {
  const parts = eventId.split('\_');
  return parts.length > 0 ? parts[0] : '';
  }

/\*\*

- Stores an event with a generated event ID
- Implements EventStore.storeEvent
  \*/
  async storeEvent(streamId: string, message: JSONRPCMessage): Promise<string> {
  const eventId = this.generateEventId(streamId);
  this.events.set(eventId, { streamId, message });
  return eventId;
  }

/\*\*

- Replays events that occurred after a specific event ID
- Implements EventStore.replayEventsAfter
  \*/
  async replayEventsAfter(lastEventId: string,
  { send }: { send: (eventId: string, message: JSONRPCMessage) => Promise<void> }
  ): Promise<string> {
  if (!lastEventId || !this.events.has(lastEventId)) {
  return '';
  }


    // Extract the stream ID from the event ID
    const streamId = this.getStreamIdFromEventId(lastEventId);
    if (!streamId) {
      return '';
    }

    let foundLastEvent = false;

    // Sort events by eventId for chronological ordering
    const sortedEvents = [...this.events.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [eventId, { streamId: eventStreamId, message }] of sortedEvents) {
      // Only include events from the same stream
      if (eventStreamId !== streamId) {
        continue;
      }

      // Start sending events after we find the lastEventId
      if (eventId === lastEventId) {
        foundLastEvent = true;
        continue;
      }

      if (foundLastEvent) {
        await send(eventId, message);
      }
    }
    return streamId;

}
}
