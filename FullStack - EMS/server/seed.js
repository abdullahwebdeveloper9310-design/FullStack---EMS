import "dotenv/config";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import bcrypt from "bcrypt";

const TemporaryPassword = "admin123";

async function registerAdmin() {
  try {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

    if (!ADMIN_EMAIL) {
      console.error("ADMIN_EMAIL Env Not Available");
      process.exit(1);
    }

    await connectDB();

    const existingAdmin = await User.findOne({
      email: process.env.ADMIN_EMAIL,
    });

    if (!existingAdmin) {
      console.log("User Already Exist As Role", existingAdmin.role);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(TemporaryPassword, 10);

    const admin = await User.create({
      email: process.env.ADMIN_EMAIL,
      password: hashedPassword,
      role: "ADMIN",
    });

    console.log("Admin User Created");
    console.log("\nemail:", admin.email);
    console.log("password:", TemporaryPassword);
    console.log("\nChange The Password After Login");

    process.exit(1);
  } catch (error) {
    console.error("Seed Failed", error);
  }
}

registerAdmin();
