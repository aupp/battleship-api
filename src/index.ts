import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import gamesRouter from "./routes/games.js";
import gameplayRouter from "./routes/gameplay.js";
import swaggerDocument from "./swagger.json" with { type: "json" };

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/games", gamesRouter);
app.use("/games", gameplayRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});
