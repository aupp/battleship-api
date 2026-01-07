# Battleship API

A PvP Battleship game backend with both REST API and MCP (Model Context Protocol) server for AI agents.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a [Supabase](https://supabase.com) project

2. Run the database migration using one of these methods:

   **Option A: Supabase Dashboard (Easiest)**
   - Go to your project's [SQL Editor](https://supabase.com/dashboard/project/_/sql)
   - Copy the contents of `supabase/migrations/001_create_tables.sql`
   - Paste into the SQL Editor and click "Run"

   **Option B: Supabase CLI**
   ```bash
   # Install Supabase CLI if not already installed
   npm install -g supabase

   # Login to Supabase
   supabase login

   # Link to your project (find project ref in project settings)
   supabase link --project-ref your-project-ref

   # Push the migration
   supabase db push
   ```

   **Option C: Direct psql connection**
   ```bash
   # Find your connection string in Supabase Dashboard > Settings > Database
   psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f supabase/migrations/001_create_tables.sql
   ```

3. Get your API credentials from Supabase Dashboard > Settings > API:
   - `SUPABASE_URL`: Project URL
   - `SUPABASE_ANON_KEY`: anon/public key

4. Copy `.env.example` to `.env` and add your credentials:

```bash
cp .env.example .env
```

```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
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

## Realtime Subscriptions

Clients can subscribe to game updates in real-time using Supabase Realtime. This is useful for:
- Knowing when an opponent joins the game
- Knowing when an opponent places their ships
- Getting notified when it's your turn
- Receiving shot results without polling

### Client Example (JavaScript)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Subscribe to game updates
const gameSubscription = supabase
  .channel('game-updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'games',
      filter: `code=eq.${gameCode}`
    },
    (payload) => {
      console.log('Game updated:', payload.new);
      // Handle status changes, turn changes, winner
    }
  )
  .subscribe();

// Subscribe to player updates (shots fired, ships placed)
const playerSubscription = supabase
  .channel('player-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'players',
      filter: `game_id=eq.${gameId}`
    },
    (payload) => {
      console.log('Player updated:', payload.new);
      // Handle opponent ready status, new shots
    }
  )
  .subscribe();

// Cleanup when done
gameSubscription.unsubscribe();
playerSubscription.unsubscribe();
```

### Events to Watch

| Table | Event | Use Case |
|-------|-------|----------|
| `games` | UPDATE | Status changes (waiting→placing→playing→finished), turn changes, winner |
| `players` | UPDATE | Opponent ready (ships placed), new shots fired |
| `players` | INSERT | Opponent joined the game |

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
| `get_realtime_instructions` | Get code for live subscriptions | `gameId?`, `gameCode?` |

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
