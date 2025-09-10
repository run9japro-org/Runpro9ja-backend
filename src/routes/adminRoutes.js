import express from "express";
import { authGuard, requireRoles } from "../middlewares/auth.js";
import { getAllUsers, blockUser } from "../controllers/adminController.js";

const router = express.Router();

router.get("/users", authGuard, requireRoles("head_admin", "agent_admin", "support_admin"), getAllUsers);
router.post("/users/:id/block", authGuard, requireRoles("head_admin", "support_admin"), blockUser);

export default router;
