/**
 * NASA APOD MCP Server
 * 
 * An MCP server that provides access to NASA's Astronomy Picture of the Day API,
 * enabling LLMs to explore and discover stunning astronomy content.
 * 
 * Features:
 * - Get today's APOD
 * - Browse historical APODs by date
 * - Explore date ranges
 * - Discover random APODs
 * - Search the archive by keyword
 * 
 * Usage:
 *   - stdio transport (default): node dist/index.js
 *   - HTTP transport: TRANSPORT=http node dist/index.js
 *   - Set NASA_API_KEY for higher rate limits
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { SERVER_NAME, SERVER_VERSION, DEFAULT_PORT } from "./constants.js";
import { registerApodTools } from "./tools/apod.js";

/**
 * Create and configure the MCP server
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });

  // Register all APOD tools
  registerApodTools(server);

  return server;
}

/**
 * Run server with stdio transport (for local integrations)
 */
async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  
  // Log to stderr (stdout is for MCP protocol)
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
  console.error("Press Ctrl+C to stop");
}

/**
 * Run server with HTTP transport (for remote access)
 */
async function runHTTP(): Promise<void> {
  const server = createServer();
  const app = express();
  
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: SERVER_NAME, version: SERVER_VERSION });
  });

  // MCP endpoint - stateless mode for simplicity
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    
    res.on("close", () => transport.close());
    
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || String(DEFAULT_PORT));
  
  app.listen(port, () => {
    console.error(`${SERVER_NAME} v${SERVER_VERSION} running on http://localhost:${port}/mcp`);
    console.error(`Health check: http://localhost:${port}/health`);
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const transport = process.env.TRANSPORT || "stdio";
  
  try {
    if (transport === "http") {
      await runHTTP();
    } else {
      await runStdio();
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
