import { Router, Request, Response } from "express";
import { createGame, joinGame, getGameState, getPlayerByToken } from "../services/gameService.js";

const router = Router();

// Create a new game
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Player name is required" });
      return;
    }

    const { game, player } = await createGame(name.trim());

    res.status(201).json({
      gameCode: game.code,
      gameId: game.id,
      playerToken: player.token,
      status: game.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Join an existing game
router.post("/:code/join", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Player name is required" });
      return;
    }

    const { game, player } = await joinGame(code, name.trim());

    res.status(200).json({
      gameCode: game.code,
      gameId: game.id,
      playerToken: player.token,
      status: game.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Game not found" ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

// Get game state
router.get("/:code", async (req: Request, res: Response) => {
  try {
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

    const gameState = await getGameState(player.game_id, playerToken);
    res.json(gameState);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

export default router;
