#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import { SPEC_REFERENCE } from "./reference.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "json-maps",
    version: "0.1.0",
  });

  registerTools(server);

  // Register spec reference resource
  server.resource("spec-reference", "json-maps://spec-reference", async () => ({
    contents: [
      {
        uri: "json-maps://spec-reference",
        mimeType: "text/markdown",
        text: SPEC_REFERENCE,
      },
    ],
  }));

  return server;
}

// Start server
const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
