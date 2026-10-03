import { cron, Inngest } from "inngest";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/leaveApplication.js";
import sendEmail from "../config/nodemailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "FullStack-EMS" });

// Auto Check-Out For Employees
const autoCheckOut = inngest.createFunction(
  { id: "auto-check-out", triggers: [{ event: "employee/check-out" }] },
  async ({ event, step }) => {
    const { employeeId, attendanceId } = event.data;

    // Wait For 9 Hours
    await step.sleepUntil(
      "wait-for-the-9-hours",
      new Date(new Date().getTime() + 9 * 60 * 60 * 1000),
    );

    // Get Attendance Data
    let attendance = await Attendance.findById(attendanceId);

    if (!attendance?.checkOut) {
      // Get Employee Data
      const employee = Employee.findById(employeeId);

      // Send Reminder Email
      await sendEmail({
        to: employee.email,
        subject: "Attendance Check Out Reminder",
        body: `<div style="max-width: 600px;">
                <h2> Hi ${employee.firstName}, </h2>
                <p style="font-size: 16px;">You Have Check-In In ${employee.department} today:</p>
                <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">${attendance?.checkIn?.toLocaleDateString()}</p>
                <p style="font-size: 16px;">Please Make Sure To Check Out In In One Hour.</p>
                <p style="font-size: 16px;">If You Have Any Questions, Please Contact Your Admin.</p>
                <p style="font-size: 16px;">Best Regards,</p>
                <p style="font-size: 16px;">EMS</p>
              </div>`,
      });

      // After 10 Hours, Mark Attendance As Check Out With Status "LATE"
      await step.sleepUntil(
        "wait-for-the-1-hour",
        new Date(new Date().getTime() + 1 * 60 * 60 * 1000),
      );

      attendance = await Attendance.findById(attendanceId);

      if (!attendance?.checkOut) {
        attendance.checkOut =
          new Date(attendance.checkIn).getTime() + 4 * 60 * 60 * 1000;
        attendance.workingHours = 4;
        attendance.dayType = "Half Day";
        attendance.status = "LATE";
        await attendance.save();
      }
    }
  },
);

// Send Email To Admin, If Admin Doesn't Take Action On Leave Application WithIn 24 Hours
const leaveApplicationReminder = inngest.createFunction(
  { id: "leave-application-reminder", triggers: [{ event: "leave/pending" }] },

  async ({ event, step }) => {
    const { leaveApplicationId } = event.data;

    // Wait For 24 Hours
    await step.sleepUntil(
      "wait-for-the-24-hours",
      new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
    );

    const leaveApplication =
      await LeaveApplication.findById(leaveApplicationId);

    if (leaveApplication?.status === "PENDING") {
      const employee = await Employee.findById(leaveApplicationId.employeeId);

      // Send Reminder Email To Admin To Take Action On Leave Application
      await sendEmail({
        tp: process.env.ADMIN_EMAIL,
        subject: `Leave Application Reminder`,
        body: `<div style="max-width: 600px;">
                <h2> Hi ADMIN, </h2>
                <p style="font-size: 16px;">You Have Leave Application ${employee.department} today:</p>
                <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">${attendance?.startDate?.toLocaleDateString()}</p>
                <p style="font-size: 16px;">Please Make Sure To Take Action On This Leave</p>
                <p style="font-size: 16px;">If You Have Any Questions, Please Contact Your Admin.</p>
                <p style="font-size: 16px;">Best Regards,</p>
                <p style="font-size: 16px;">EMS</p>
              </div>`,
      });
    }
  },
);

// Cron: Check Attendance At 11:30 A.M IST (06:00 UTC) And Email Absent Employees
const attendanceReminderCron = inngest.createFunction(
  {
    id: "attendance-reminder-cron",
    triggers: [{ cron: "TZ=Asia/Islamabad 30 11 * * *" }],
  }, // 06:00 UTC = 11:30 A.M
  async ({ step }) => {
    // Step 1: Get Today's Date Range (IST)
    const today = await step.run("get-today-date", () => {
      const startUTC = new Date(
        new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Islamabad" }) +
          "T00:00:00+05:30",
      );
      const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
      return {
        startUTC: startUTC.toISOString(),
        endUTC: endUTC.toISOString(),
      };
    });

    // Step 2: Get All Active, Non Deleted Employee
    const activeEmployees = await step.run("get-active-employees", async () => {
      const employees = await Employee.find({
        isDeleted: false,
        employmentStatus: "ACTIVE",
      }).lean();
      return employees.map((e) => ({
        _id: e._id.toString(),
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        department: e.department,
      }));
    });

    // Step 3: Get Employees Id On Approved Leaves Today
    const onLeaveIds = await step.run("get-on-leaves-id", async () => {
      const leaves = await LeaveApplication.find({
        status: "APPROVED",
        startDate: { $lte: new Date(today.endUTC) },
        endDate: { $lte: new Date(today.startDate) },
      }).lean();
      return leaves.map((l) => l.employeeId.toString());
    });

    // Step 4: Get Employee Ids Who Is Already Checked In Today
    const checkedInIds = await step.run("get-checked-in-ids", async () => {
      const attendances = await Attendance.find({
        date: { $gte: new Date(today.startUTC), $lt: new Date(today.endUTC) },
      }).lean();
      return attendances.map((a) => a.employeeId.toString());
    });

    // Step 5: Filter Absent Employees (Not On Leave & Not Checked In)
    const absentEmployees = activeEmployees.filter(
      (emp) => !onLeaveIds.includes(emp._id) && !checkedInIds.includes(emp._id),
    );

    // Send Reminder Email
    if (absentEmployees.lenght > 0) {
      await step.run("send-reminder-email", async () => {
        const emailPromises = absentEmployees.map((emp) => {
          // Send Email
          sendEmail({
            to: emp.email,
            subject: `Attendance Reminder - Please Mark Your Attendance`,
            body: `<div style="max-width: 600px; font-family: Arial, sans-serif;">
                    <h2>Hi ${emp.firstName}, 👋</h2>
                    <p style="font-size: 16px;">We noticed you haven't marked your attendance yet today.</p>
                    <p style="font-size: 16px;">The deadline was <strong>11:30 AM</strong> and your attendance is still missing.</p>
                    <p style="font-size: 16px;">Please check in as soon as possible or contact your admin if you're facing any issues.</p>
                    <br />
                    <p style="font-size: 14px; color: #666;">Department: ${emp.department}</p>
                    <br />
                    <p style="font-size: 16px;">Best Regards,</p>
                    <p style="font-size: 16px;"><strong>QuickEMS</strong></p>
                </div>`,
          });
        });
        await Promise.all(emailPromises);
        return { emailsSent: absentEmployees.length };
      });
    }

    return {
      totalActice: activeEmployees.length,
      onLeave: onLeaveIds.length,
      checkedIn: checkedInIds.length,
      absent: absentEmployees.length,
    };
  },
);

// Create an empty array where we'll export future Inngest functions
export const functions = [
  autoCheckOut,
  leaveApplicationReminder,
  attendanceReminderCron,
];
