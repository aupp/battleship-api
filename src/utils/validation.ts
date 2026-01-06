import { Ship, Coordinate, BOARD_SIZE, SHIPS } from "../types/game.js";

export function isValidCoordinate(coord: Coordinate): boolean {
  return (
    coord.x >= 0 &&
    coord.x < BOARD_SIZE &&
    coord.y >= 0 &&
    coord.y < BOARD_SIZE
  );
}

export function validateShipPlacement(ships: Ship[]): {
  valid: boolean;
  error?: string;
} {
  // Check correct number of ships
  if (ships.length !== SHIPS.length) {
    return { valid: false, error: `Must place exactly ${SHIPS.length} ships` };
  }

  // Check each ship matches expected configuration
  const expectedShips = [...SHIPS].sort((a, b) => b.size - a.size);
  const providedShips = [...ships].sort((a, b) => b.size - a.size);

  for (let i = 0; i < expectedShips.length; i++) {
    const expected = expectedShips[i];
    const provided = providedShips[i];

    if (!provided) {
      return { valid: false, error: `Missing ship: ${expected.name}` };
    }

    if (provided.size !== expected.size) {
      return {
        valid: false,
        error: `Ship ${provided.name} has wrong size. Expected ${expected.size}, got ${provided.size}`,
      };
    }

    if (provided.positions.length !== provided.size) {
      return {
        valid: false,
        error: `Ship ${provided.name} must have ${provided.size} positions`,
      };
    }

    // Check all positions are valid coordinates
    for (const pos of provided.positions) {
      if (!isValidCoordinate(pos)) {
        return {
          valid: false,
          error: `Ship ${provided.name} has invalid position: (${pos.x}, ${pos.y})`,
        };
      }
    }

    // Check positions are in a straight line (horizontal or vertical)
    if (!isValidShipShape(provided.positions)) {
      return {
        valid: false,
        error: `Ship ${provided.name} must be placed in a straight line`,
      };
    }
  }

  // Check no overlapping ships
  const allPositions = ships.flatMap((s) => s.positions);
  const positionSet = new Set(allPositions.map((p) => `${p.x},${p.y}`));
  if (positionSet.size !== allPositions.length) {
    return { valid: false, error: "Ships cannot overlap" };
  }

  return { valid: true };
}

function isValidShipShape(positions: Coordinate[]): boolean {
  if (positions.length <= 1) return true;

  const sorted = [...positions].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  const isHorizontal = sorted.every((p) => p.y === sorted[0]!.y);
  const isVertical = sorted.every((p) => p.x === sorted[0]!.x);

  if (!isHorizontal && !isVertical) return false;

  // Check consecutive positions
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;

    if (isHorizontal && curr.x !== prev.x + 1) return false;
    if (isVertical && curr.y !== prev.y + 1) return false;
  }

  return true;
}

export function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
