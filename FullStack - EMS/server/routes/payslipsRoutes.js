import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import {
  createPayslip,
  createPayslipById,
  getPayslips,
} from "../controllers/payslipController.js";

const payslipRouter = Router();

payslipRouter.post("/", protect, protectAdmin, createPayslip);
payslipRouter.get("/", protect, getPayslips);
payslipRouter.post("/:id", protect, createPayslipById);

export default payslipRouter;
