export interface Coordinate {
  x: number;
  y: number;
}

export interface Ship {
  name: string;
  size: number;
  positions: Coordinate[];
}

export interface Shot {
  x: number;
  y: number;
  hit: boolean;
}

export type GameStatus = "waiting" | "placing" | "playing" | "finished";
export type PlayerNumber = "player1" | "player2";

export interface Game {
  id: string;
  code: string;
  status: GameStatus;
  current_turn: PlayerNumber | null;
  winner: PlayerNumber | null;
  created_at: string;
}

export interface Player {
  id: string;
  game_id: string;
  player_number: PlayerNumber;
  name: string;
  token: string;
  board: Ship[];
  shots: Shot[];
  ready: boolean;
}

export interface GameState {
  game: Game;
  you: {
    name: string;
    board: Ship[];
    shots: Shot[];
    ready: boolean;
  };
  opponent: {
    name: string;
    shots: Shot[];
    ready: boolean;
    shipsSunk: number;
  } | null;
  isYourTurn: boolean;
}

export const SHIPS = [
  { name: "Carrier", size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser", size: 3 },
  { name: "Submarine", size: 3 },
  { name: "Destroyer", size: 2 },
] as const;

export const BOARD_SIZE = 10;
