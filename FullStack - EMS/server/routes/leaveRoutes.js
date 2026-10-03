import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import {
  createLeave,
  getLeaves,
  updateLeaveStatus,
} from "../controllers/leaveController.js";

const leaveRouter = Router();

leaveRouter.post("/", protect, createLeave);
leaveRouter.post("/", protect, getLeaves);
leaveRouter.post("/:id", protect, protectAdmin, updateLeaveStatus);

export default leaveRouter;
