#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBattleshipServer } from "./mcp/tools.js";

async function main() {
  const server = createBattleshipServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Battleship MCP server running on stdio");
}

main().catch(console.error);
