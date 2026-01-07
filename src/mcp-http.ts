#!/usr/bin/env node
import "dotenv/config";
import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createBattleshipServer } from "./mcp/tools.js";

const app = express();
const PORT = process.env.PORT || process.env.MCP_PORT || 3001;

app.use(cors());
app.use(express.json());

// Store active transports by session ID
const sseSessions = new Map<string, SSEServerTransport>();
const streamableSessions = new Map<string, StreamableHTTPServerTransport>();

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "battleship-mcp" });
});

/**
 * Standard SSE Transport (Recommended for most AI Agents/Copilot)
 * Connect to /sse for event stream
 * Post to /messages for JSON-RPC messages
 */
app.get("/sse", async (req, res) => {
  console.log("New SSE connection initialized");
  
  const transport = new SSEServerTransport("/messages", res);
  const server = createBattleshipServer();
  
  if (transport.sessionId) {
    sseSessions.set(transport.sessionId, transport);
    console.log(`SSE Session created: ${transport.sessionId}`);
  }

  transport.onclose = () => {
    console.log(`SSE Session closed: ${transport.sessionId}`);
    sseSessions.delete(transport.sessionId);
  };

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseSessions.get(sessionId);

  if (!transport) {
    res.status(404).send("Session not found");
    return;
  }

  await transport.handlePostMessage(req, res);
});

/**
 * Streamable HTTP Transport (Newer MCP Standard)
 * Single endpoint /mcp handles both connection and messages
 */
app.all("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  let transport: StreamableHTTPServerTransport;

  if (sessionId && streamableSessions.has(sessionId)) {
    transport = streamableSessions.get(sessionId)!;
  } else {
    // For new sessions (or initial requests), we create a new transport + server
    const server = createBattleshipServer();
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        streamableSessions.set(id, transport);
        console.log(`Streamable Session created: ${id}`);
      },
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) {
        streamableSessions.delete(id);
        console.log(`Streamable Session closed: ${id}`);
      }
    };

    await server.connect(transport);
  }

  await transport.handleRequest(req, res);
});

app.listen(PORT, () => {
  console.log(`Battleship MCP HTTP server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse (Use this for most clients)`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp (Streamable HTTP)`);
});
