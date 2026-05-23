import { Router } from "express";
import { getAvailableBackends } from "../lib/cms-direct.js";

const router = Router();

router.get("/backends", (_req, res) => {
  res.json({ backends: getAvailableBackends() });
});

export default router;
