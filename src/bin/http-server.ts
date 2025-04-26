#!/usr/bin/env node
/**
 * HTTP Server Entry Point
 *
 * Provides an HTTP transport for the CodeTools MCP server
 */

import express from "express";
import { randomUUID } from "node:crypto";
import cors from "cors";
import { createServer as createMcpServer } from "../server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { logger } from "../utils/index.js";

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Start an HTTP MCP server
 * @param {number} port - The port to listen on
 * @param {boolean} enableCors - Whether to enable CORS
 * @returns {Promise<void>}
 */
async function startHttpServer(port = 3000, enableCors = true) {
  // Create Express app
  const app = express();
  app.use(express.json());

  // Enable CORS if requested
  if (enableCors) {
    app.use(cors());
  }

  // Set up session management
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  // Handle POST requests for client-to-server communication
  app.post("/mcp", async (req, res) => {
    // Check for existing session ID
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
      logger.debug(`Using existing session: ${sessionId}`);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          // Store the transport by session ID
          transports[newSessionId] = transport;
          logger.info(`New session initialized: ${newSessionId}`);
        },
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
          logger.info(`Session closed: ${transport.sessionId}`);
        }
      };

      // Create and connect to the MCP server
      const server = await createMcpServer();
      await server.connect(transport);

      logger.info("New MCP server created and connected to transport");
    } else {
      // Invalid request
      logger.warn("Bad request: No valid session ID provided");
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  });

  // Reusable handler for GET and DELETE requests
  const handleSessionRequest = async (
    req: express.Request,
    res: express.Response
  ) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      logger.warn(`Invalid or missing session ID: ${sessionId}`);
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };

  // Handle GET requests for server-to-client notifications via SSE
  app.get("/mcp", handleSessionRequest);

  // Handle DELETE requests for session termination
  app.delete("/mcp", handleSessionRequest);

  // Serve static documentation
  app.use("/docs", express.static(join(__dirname, "../../docs")));

  // Start the server
  app.listen(port, () => {
    logger.info(`HTTP MCP server listening on port ${port}`);
    console.log(`MCP Server started on http://localhost:${port}/mcp`);
    console.log(`Documentation available at http://localhost:${port}/docs`);
  });
}

// Allow port to be specified via command line argument
const port = parseInt(process.argv[2] || "3000", 10);
const enableCors =
  process.argv.includes("--cors") || process.argv.includes("-c");

// Start server
startHttpServer(port, enableCors).catch((error) => {
  logger.error("Failed to start HTTP server", { error: error.message });
  console.error("Failed to start HTTP server:", error);
  process.exit(1);
});
