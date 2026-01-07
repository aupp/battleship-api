#!/usr/bin/env node
import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createBattleshipServer } from "./mcp/tools.js";

const app = express();
const PORT = process.env.PORT || process.env.MCP_PORT || 3001;

app.use(cors());
app.use(express.json());

// Store active transports by session ID
const sessions = new Map<string, StreamableHTTPServerTransport>();

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "battleship-mcp" });
});

// Single MCP endpoint for Streamable HTTP transport
// Handles both POST (client->server messages) and GET (server->client SSE)
app.all("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (req.method === "GET") {
    // SSE stream for server-to-client messages
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }

    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }

  if (req.method === "POST") {
    // Handle client-to-server messages
    let transport: StreamableHTTPServerTransport;

    if (sessionId && sessions.has(sessionId)) {
      // Existing session
      transport = sessions.get(sessionId)!;
    } else {
      // New session - create server and transport
      const server = createBattleshipServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, transport);
          console.log(`Session created: ${id}`);
        },
      });

      transport.onclose = () => {
        const id = transport.sessionId;
        if (id) {
          sessions.delete(id);
          console.log(`Session closed: ${id}`);
        }
      };

      await server.connect(transport);
    }

    await transport.handleRequest(req, res);
    return;
  }

  if (req.method === "DELETE") {
    // Session termination
    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.close();
      sessions.delete(sessionId);
      res.status(204).send();
    } else {
      res.status(404).json({ error: "Session not found" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
});

app.listen(PORT, () => {
  console.log(`Battleship MCP HTTP server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
