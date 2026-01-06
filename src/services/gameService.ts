import { supabase } from "../config/supabase.js";
import {
  Game,
  Player,
  Ship,
  Shot,
  GameState,
  PlayerNumber,
  Coordinate,
} from "../types/game.js";
import { generateGameCode, validateShipPlacement } from "../utils/validation.js";

export async function createGame(playerName: string): Promise<{
  game: Game;
  player: Player;
}> {
  const code = generateGameCode();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({ code })
    .select()
    .single();

  if (gameError) throw new Error(`Failed to create game: ${gameError.message}`);

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      game_id: game.id,
      player_number: "player1",
      name: playerName,
    })
    .select()
    .single();

  if (playerError) throw new Error(`Failed to create player: ${playerError.message}`);

  return { game, player };
}

export async function joinGame(
  code: string,
  playerName: string
): Promise<{ game: Game; player: Player }> {
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select()
    .eq("code", code.toUpperCase())
    .single();

  if (gameError || !game) throw new Error("Game not found");
  if (game.status !== "waiting") throw new Error("Game is not available to join");

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      game_id: game.id,
      player_number: "player2",
      name: playerName,
    })
    .select()
    .single();

  if (playerError) throw new Error(`Failed to join game: ${playerError.message}`);

  // Update game status to placing
  await supabase
    .from("games")
    .update({ status: "placing" })
    .eq("id", game.id);

  return { game: { ...game, status: "placing" }, player };
}

export async function getPlayerByToken(token: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from("players")
    .select()
    .eq("token", token)
    .single();

  if (error) return null;
  return data;
}

export async function getGameState(
  gameId: string,
  playerToken: string
): Promise<GameState> {
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select()
    .eq("id", gameId)
    .single();

  if (gameError || !game) throw new Error("Game not found");

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select()
    .eq("game_id", gameId);

  if (playersError) throw new Error("Failed to fetch players");

  const currentPlayer = players.find((p) => p.token === playerToken);
  if (!currentPlayer) throw new Error("Player not found in this game");

  const opponent = players.find((p) => p.token !== playerToken);

  return {
    game,
    you: {
      name: currentPlayer.name,
      board: currentPlayer.board,
      shots: currentPlayer.shots,
      ready: currentPlayer.ready,
    },
    opponent: opponent
      ? {
          name: opponent.name,
          shots: opponent.shots,
          ready: opponent.ready,
          shipsSunk: countSunkShips(opponent.board, currentPlayer.shots),
        }
      : null,
    isYourTurn: game.current_turn === currentPlayer.player_number,
  };
}

export async function placeShips(
  playerToken: string,
  ships: Ship[]
): Promise<void> {
  const player = await getPlayerByToken(playerToken);
  if (!player) throw new Error("Player not found");

  const { data: game } = await supabase
    .from("games")
    .select()
    .eq("id", player.game_id)
    .single();

  if (!game || game.status !== "placing") {
    throw new Error("Cannot place ships at this time");
  }

  const validation = validateShipPlacement(ships);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  await supabase
    .from("players")
    .update({ board: ships, ready: true })
    .eq("id", player.id);

  // Check if both players are ready
  const { data: players } = await supabase
    .from("players")
    .select()
    .eq("game_id", player.game_id);

  const allReady = players?.length === 2 && players.every((p) => p.ready || p.id === player.id);

  if (allReady) {
    await supabase
      .from("games")
      .update({ status: "playing", current_turn: "player1" })
      .eq("id", player.game_id);
  }
}

export async function fire(
  playerToken: string,
  target: Coordinate
): Promise<{ hit: boolean; sunk: string | null; gameOver: boolean; winner: PlayerNumber | null }> {
  const player = await getPlayerByToken(playerToken);
  if (!player) throw new Error("Player not found");

  const { data: game } = await supabase
    .from("games")
    .select()
    .eq("id", player.game_id)
    .single();

  if (!game || game.status !== "playing") {
    throw new Error("Game is not in playing state");
  }

  if (game.current_turn !== player.player_number) {
    throw new Error("Not your turn");
  }

  // Check if already shot at this position
  const existingShot = player.shots.find(
    (s: Shot) => s.x === target.x && s.y === target.y
  );
  if (existingShot) {
    throw new Error("Already fired at this position");
  }

  // Get opponent
  const { data: opponent } = await supabase
    .from("players")
    .select()
    .eq("game_id", player.game_id)
    .neq("id", player.id)
    .single();

  if (!opponent) throw new Error("Opponent not found");

  // Check if hit
  const hit = isHit(opponent.board, target);
  const newShots = [...player.shots, { x: target.x, y: target.y, hit }];

  await supabase
    .from("players")
    .update({ shots: newShots })
    .eq("id", player.id);

  // Check for sunk ship
  const sunkShip = getSunkShip(opponent.board, newShots, target);

  // Check for game over
  const allSunk = areAllShipsSunk(opponent.board, newShots);

  if (allSunk) {
    await supabase
      .from("games")
      .update({ status: "finished", winner: player.player_number })
      .eq("id", player.game_id);

    return { hit, sunk: sunkShip, gameOver: true, winner: player.player_number };
  }

  // Switch turns
  const nextTurn: PlayerNumber = player.player_number === "player1" ? "player2" : "player1";
  await supabase
    .from("games")
    .update({ current_turn: nextTurn })
    .eq("id", player.game_id);

  return { hit, sunk: sunkShip, gameOver: false, winner: null };
}

function isHit(board: Ship[], target: Coordinate): boolean {
  return board.some((ship) =>
    ship.positions.some((pos) => pos.x === target.x && pos.y === target.y)
  );
}

function getSunkShip(board: Ship[], shots: Shot[], lastShot: Coordinate): string | null {
  for (const ship of board) {
    const hitOnThisShip = ship.positions.some(
      (pos) => pos.x === lastShot.x && pos.y === lastShot.y
    );
    if (!hitOnThisShip) continue;

    const allHit = ship.positions.every((pos) =>
      shots.some((s) => s.x === pos.x && s.y === pos.y && s.hit)
    );
    if (allHit) return ship.name;
  }
  return null;
}

function areAllShipsSunk(board: Ship[], shots: Shot[]): boolean {
  return board.every((ship) =>
    ship.positions.every((pos) =>
      shots.some((s) => s.x === pos.x && s.y === pos.y && s.hit)
    )
  );
}

function countSunkShips(board: Ship[], shots: Shot[]): number {
  return board.filter((ship) =>
    ship.positions.every((pos) =>
      shots.some((s) => s.x === pos.x && s.y === pos.y && s.hit)
    )
  ).length;
}
