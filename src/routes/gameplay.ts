import { Router, Request, Response } from "express";
import { placeShips, fire, getPlayerByToken } from "../services/gameService.js";
import { isValidCoordinate } from "../utils/validation.js";
import { Ship } from "../types/game.js";

const router = Router();

// Middleware to validate player token
async function validateToken(req: Request, res: Response, next: () => void) {
  const playerToken = req.headers["x-player-token"];
  if (!playerToken || typeof playerToken !== "string") {
    res.status(401).json({ error: "Player token required" });
    return;
  }

  const player = await getPlayerByToken(playerToken);
  if (!player) {
    res.status(401).json({ error: "Invalid player token" });
    return;
  }

  req.playerToken = playerToken;
  next();
}

// Place ships on the board
router.post("/:code/place-ships", validateToken, async (req: Request, res: Response) => {
  try {
    const { ships } = req.body;

    if (!Array.isArray(ships)) {
      res.status(400).json({ error: "Ships array is required" });
      return;
    }

    await placeShips(req.playerToken!, ships as Ship[]);
    res.json({ success: true, message: "Ships placed successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

// Fire at a position
router.post("/:code/fire", validateToken, async (req: Request, res: Response) => {
  try {
    const { x, y } = req.body;

    if (typeof x !== "number" || typeof y !== "number") {
      res.status(400).json({ error: "x and y coordinates are required" });
      return;
    }

    if (!isValidCoordinate({ x, y })) {
      res.status(400).json({ error: "Invalid coordinates" });
      return;
    }

    const result = await fire(req.playerToken!, { x, y });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

export default router;

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      playerToken?: string;
    }
  }
}
