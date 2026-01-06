# Battleship API

A PvP Battleship game backend with both REST API and MCP (Model Context Protocol) server for AI agents.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a [Supabase](https://supabase.com) project
2. Run the migration in `supabase/migrations/001_create_tables.sql`
3. Copy `.env.example` to `.env` and add your credentials:

```bash
cp .env.example .env
```

```env
PORT=3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Build & Run

```bash
npm run build
npm start        # REST API server
npm run mcp      # MCP server
```

## Game Rules

- 10x10 grid per player
- Ships: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2)
- Players place ships, then take turns firing
- Game ends when all ships of one player are sunk

## REST API

Base URL: `http://localhost:3000`

Interactive docs available at `/api-docs` when server is running.

### Endpoints

#### Health Check

```
GET /health
```

Response:
```json
{ "status": "ok" }
```

---

#### Create Game

```
POST /games
Content-Type: application/json

{ "name": "Player1" }
```

Response:
```json
{
  "gameCode": "ABC123",
  "gameId": "uuid",
  "playerToken": "uuid",
  "status": "waiting"
}
```

---

#### Join Game

```
POST /games/:code/join
Content-Type: application/json

{ "name": "Player2" }
```

Response:
```json
{
  "gameCode": "ABC123",
  "gameId": "uuid",
  "playerToken": "uuid",
  "status": "placing"
}
```

---

#### Get Game State

```
GET /games/:code
X-Player-Token: your-player-token
```

Response:
```json
{
  "game": {
    "id": "uuid",
    "code": "ABC123",
    "status": "playing",
    "current_turn": "player1",
    "winner": null
  },
  "you": {
    "name": "Player1",
    "board": [...],
    "shots": [...],
    "ready": true
  },
  "opponent": {
    "name": "Player2",
    "shots": [...],
    "ready": true,
    "shipsSunk": 0
  },
  "isYourTurn": true
}
```

---

#### Place Ships

```
POST /games/:code/place-ships
X-Player-Token: your-player-token
Content-Type: application/json

{
  "ships": [
    {
      "name": "Carrier",
      "size": 5,
      "positions": [
        {"x": 0, "y": 0},
        {"x": 1, "y": 0},
        {"x": 2, "y": 0},
        {"x": 3, "y": 0},
        {"x": 4, "y": 0}
      ]
    },
    {
      "name": "Battleship",
      "size": 4,
      "positions": [
        {"x": 0, "y": 1},
        {"x": 1, "y": 1},
        {"x": 2, "y": 1},
        {"x": 3, "y": 1}
      ]
    },
    {
      "name": "Cruiser",
      "size": 3,
      "positions": [
        {"x": 0, "y": 2},
        {"x": 1, "y": 2},
        {"x": 2, "y": 2}
      ]
    },
    {
      "name": "Submarine",
      "size": 3,
      "positions": [
        {"x": 0, "y": 3},
        {"x": 1, "y": 3},
        {"x": 2, "y": 3}
      ]
    },
    {
      "name": "Destroyer",
      "size": 2,
      "positions": [
        {"x": 0, "y": 4},
        {"x": 1, "y": 4}
      ]
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "message": "Ships placed successfully"
}
```

---

#### Fire

```
POST /games/:code/fire
X-Player-Token: your-player-token
Content-Type: application/json

{ "x": 5, "y": 3 }
```

Response:
```json
{
  "hit": true,
  "sunk": "Destroyer",
  "gameOver": false,
  "winner": null
}
```

---

## MCP Server

The MCP server exposes the Battleship API as tools for AI coding agents.

### Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_game` | Create a new game | `name` |
| `join_game` | Join existing game | `code`, `name` |
| `get_game_state` | Get current state | `playerToken` |
| `place_ships` | Place ships on board | `playerToken`, `ships` |
| `fire` | Fire at coordinate | `playerToken`, `x`, `y` |

### Configuration

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "battleship": {
      "command": "node",
      "args": ["/path/to/battleship-api/dist/mcp-server.js"],
      "env": {
        "SUPABASE_URL": "your_supabase_url",
        "SUPABASE_ANON_KEY": "your_supabase_anon_key"
      }
    }
  }
}
```

Or for a project-specific config (`.claude/settings.local.json`):

```json
{
  "mcpServers": {
    "battleship": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/battleship-api",
      "env": {
        "SUPABASE_URL": "your_supabase_url",
        "SUPABASE_ANON_KEY": "your_supabase_anon_key"
      }
    }
  }
}
```

### Example Usage (Two AI Agents Playing)

**Agent 1 (creates game):**
```
create_game(name: "AI-Player-1")
→ { gameCode: "XYZ789", playerToken: "token1" }
```

**Agent 2 (joins game):**
```
join_game(code: "XYZ789", name: "AI-Player-2")
→ { playerToken: "token2" }
```

**Both agents place ships:**
```
place_ships(playerToken: "token1", ships: [...])
place_ships(playerToken: "token2", ships: [...])
```

**Take turns firing:**
```
fire(playerToken: "token1", x: 5, y: 3)
→ { hit: true, sunk: null, gameOver: false }

fire(playerToken: "token2", x: 0, y: 0)
→ { hit: false, sunk: null, gameOver: false }
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run REST API server |
| `npm run mcp` | Run MCP server |

## License

ISC
