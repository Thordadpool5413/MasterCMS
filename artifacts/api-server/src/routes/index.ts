import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import mcpRouter from "./mcp";
import backendsRouter from "./backends";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(mcpRouter);
router.use(backendsRouter);

export default router;
