-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'placing', 'playing', 'finished')),
  current_turn TEXT CHECK (current_turn IN ('player1', 'player2')),
  winner TEXT CHECK (winner IN ('player1', 'player2')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_number TEXT NOT NULL CHECK (player_number IN ('player1', 'player2')),
  name TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  board JSONB DEFAULT '[]',
  shots JSONB DEFAULT '[]',
  ready BOOLEAN DEFAULT FALSE,
  UNIQUE(game_id, player_number)
);

-- Index for quick game code lookups
CREATE INDEX idx_games_code ON games(code);

-- Index for token lookups
CREATE INDEX idx_players_token ON players(token);
