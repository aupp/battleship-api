#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createGame,
  joinGame,
  getGameState,
  getPlayerByToken,
  placeShips,
  fire,
} from "./services/gameService.js";
import { Ship } from "./types/game.js";

const server = new McpServer({
  name: "battleship",
  version: "1.0.0",
});

// Tool: Create a new game
server.tool(
  "create_game",
  "Create a new battleship game. Returns a game code to share with opponent and a player token for authentication.",
  {
    name: z.string().describe("Your player name"),
  },
  async ({ name }) => {
    try {
      const { game, player } = await createGame(name);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              gameCode: game.code,
              playerToken: player.token,
              message: `Game created! Share code ${game.code} with your opponent.`,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Join an existing game
server.tool(
  "join_game",
  "Join an existing battleship game using a game code.",
  {
    code: z.string().describe("The 6-character game code"),
    name: z.string().describe("Your player name"),
  },
  async ({ code, name }) => {
    try {
      const { game, player } = await joinGame(code, name);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              gameCode: game.code,
              playerToken: player.token,
              message: `Joined game ${game.code}. Both players can now place ships.`,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get game state
server.tool(
  "get_game_state",
  "Get the current state of your battleship game including your board, shots fired, and whether it's your turn.",
  {
    playerToken: z.string().describe("Your player token from create_game or join_game"),
  },
  async ({ playerToken }) => {
    try {
      const player = await getPlayerByToken(playerToken);
      if (!player) {
        throw new Error("Invalid player token");
      }
      const state = await getGameState(player.game_id, playerToken);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              ...state,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Place ships
server.tool(
  "place_ships",
  `Place your ships on the board. Ships required: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2). Each ship needs positions as {x, y} coordinates (0-9). Ships must be in a straight line (horizontal or vertical) and cannot overlap.`,
  {
    playerToken: z.string().describe("Your player token"),
    ships: z
      .array(
        z.object({
          name: z.string().describe("Ship name: Carrier, Battleship, Cruiser, Submarine, or Destroyer"),
          size: z.number().describe("Ship size: 5, 4, 3, 3, or 2"),
          positions: z
            .array(
              z.object({
                x: z.number().min(0).max(9).describe("X coordinate (0-9)"),
                y: z.number().min(0).max(9).describe("Y coordinate (0-9)"),
              })
            )
            .describe("Array of {x, y} positions the ship occupies"),
        })
      )
      .describe("Array of 5 ships with their positions"),
  },
  async ({ playerToken, ships }) => {
    try {
      await placeShips(playerToken, ships as Ship[]);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: "Ships placed successfully. Waiting for opponent to place ships.",
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Fire at a position
server.tool(
  "fire",
  "Fire at a position on your opponent's board. Coordinates are 0-9 for both x and y.",
  {
    playerToken: z.string().describe("Your player token"),
    x: z.number().min(0).max(9).describe("X coordinate to fire at (0-9)"),
    y: z.number().min(0).max(9).describe("Y coordinate to fire at (0-9)"),
  },
  async ({ playerToken, x, y }) => {
    try {
      const result = await fire(playerToken, { x, y });
      let message = result.hit ? "Hit!" : "Miss!";
      if (result.sunk) {
        message += ` You sunk their ${result.sunk}!`;
      }
      if (result.gameOver) {
        message += ` Game over - you win!`;
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              ...result,
              message,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Battleship MCP server running on stdio");
}

main().catch(console.error);
