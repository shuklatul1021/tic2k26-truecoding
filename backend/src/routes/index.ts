import { Router } from "express";
import adminRouter from "./admin.js";
import authRouter from "./auth.js";
import classifyRouter from "./classify.js";
import healthRouter from "./health.js";
import issuesRouter from "./issues.js";
import uploadRouter from "./upload.js";
import usersRouter from "./users.js";
import workersRouter from "./workers.js";

const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/issues", issuesRouter);
router.use("/admin", adminRouter);
router.use("/users", usersRouter);
router.use("/workers", workersRouter);
router.use("/upload", uploadRouter);
router.use("/classify", classifyRouter);

export default router;
