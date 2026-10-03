import { inngest } from "../inngest/index.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/leaveApplication.js";

// Create Leave
// POST /api/leaves

export const createLeave = async (req, res) => {
  try {
    const session = req.session;
    const employee = await Employee.findOne({ userId: session.userId });
    if (!employee) return res.status(404).json({ error: "Employee Not Found" });
    if (employee.isDeleted) {
      return res.status(403).json({
        error: "Your Account Is Deactived, You Cannot Apply For Leave",
      });
    }

    const { type, startDate, endDate, reason } = req.body;

    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: "Missing Fields" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (new Date(startDate) <= today || new Date(endDate) <= today) {
      return res.status(400).json({ error: "Field Dates Must Be In Future" });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res
        .status(400)
        .json({ error: "End Date Cannot Be Before Start Date" });
    }

    const leave = LeaveApplication.create({
      employeeId: employee._id,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      status: "PENDING",
    });

    await inngest.send({
      name: "leave/pending",
      data: { leaveApplicationId: leave._id },
    });

    res.json({ success: true, data: leave });
  } catch (error) {
    return res.status(500).json({ error: "Failed" });
  }
};

// Get Leave
// GET /api/leaves

export const getLeaves = async (req, res) => {
  try {
    const session = req.session;
    const isAdmin = session.role === "ADMIN";
    if (isAdmin) {
      const status = req.query.status;
      const where = status ? { status } : {};
      const leaves = await LeaveApplication.find(where)
        .populate("employeeId")
        .sort({ createdAt: -1 });
      const data = leaves.map((l) => {
        const obj = l.toObject();
        return {
          ...obj,
          id: obj._id.toString(),
          employee: obj.employeeId,
          employeeId: obj.employeeId?._id.toString(),
        };
      });
      return res.json({ data });
    } else {
      const employee = await Employee.findOne({
        userId: session.userId,
      }).lean();

      if (!employee) {
        res.status(404).json({ error: "Not Found" });
      }

      const leaves = await LeaveApplication.find({
        employeeId: employee._id,
      }).sort({ createdAt: -1 });
      return res.json({
        data: leaves,
        employee: { ...employee, id: employee._id.toString() },
      });
    }
  } catch (error) {
    return res.status(500).json({ error: "Failed" });
  }
};

// Update Leave Status
// PATCH /api/leaves/:id

export const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      res.status(400).json({ error: "Invalid Status" });
    }
    const leave = LeaveApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocumen: "after" },
    );
    res.status(400).json({ success: true, data: leave });
  } catch (error) {
    return res.status(500).json({ error: "Failed" });
  }
};
