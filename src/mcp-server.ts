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

// Tool: Get realtime subscription instructions
server.tool(
  "get_realtime_instructions",
  "Get code examples for subscribing to real-time game updates using Supabase Realtime. Useful for building clients that need live updates without polling.",
  {
    gameId: z.string().optional().describe("Optional game ID to include in the example filter"),
    gameCode: z.string().optional().describe("Optional game code to include in the example filter"),
  },
  async ({ gameId, gameCode }) => {
    const gameFilter = gameCode ? `code=eq.${gameCode}` : "code=eq.YOUR_GAME_CODE";
    const playerFilter = gameId ? `game_id=eq.${gameId}` : "game_id=eq.YOUR_GAME_ID";

    const instructions = `
# Supabase Realtime Subscriptions for Battleship

Clients can subscribe to live game updates instead of polling. This requires the Supabase client library.

## Installation
\`\`\`bash
npm install @supabase/supabase-js
\`\`\`

## Setup
\`\`\`javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
\`\`\`

## Subscribe to Game Updates
Notifies when: game status changes, turn changes, winner declared
\`\`\`javascript
const gameSubscription = supabase
  .channel('game-updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'games',
      filter: '${gameFilter}'
    },
    (payload) => {
      console.log('Game updated:', payload.new);
      // payload.new contains: { id, code, status, current_turn, winner, created_at }
    }
  )
  .subscribe();
\`\`\`

## Subscribe to Player Updates
Notifies when: opponent joins, ships placed, shots fired
\`\`\`javascript
const playerSubscription = supabase
  .channel('player-updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'players',
      filter: '${playerFilter}'
    },
    (payload) => {
      console.log('Player updated:', payload.new);
      // payload.new contains: { id, game_id, player_number, name, ready, shots }
      // Note: 'board' contains ship positions - don't expose opponent's board!
    }
  )
  .subscribe();
\`\`\`

## Cleanup
\`\`\`javascript
// When leaving the game
await gameSubscription.unsubscribe();
await playerSubscription.unsubscribe();
\`\`\`

## Events Reference
| Table   | Event  | Trigger                                    |
|---------|--------|--------------------------------------------|
| games   | UPDATE | Status/turn/winner changes                 |
| players | INSERT | Opponent joined                            |
| players | UPDATE | Ships placed (ready=true) or shots updated |
`;

    return {
      content: [
        {
          type: "text" as const,
          text: instructions,
        },
      ],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Battleship MCP server running on stdio");
}

main().catch(console.error);
