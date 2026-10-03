import Employee from "../models/Employee.js";

// Get Profile
// GET /api/profile
export const getProfile = async (req, res) => {
  try {
    const session = req.session;
    const employee = Employee.findOne({ userId: session.userId });

    if (!employee) {
      // Authenticated User Is Not Employee Then Return Admin Profile
      return res.json({
        firstName: "Admin",
        lastName: "",
        email: session.email,
      });
    }

    return res.json(employee);
  } catch (error) {
    return res.status(500).json({ error: "Failed To Fetch Profile" });
  }
};

// Create Profile
// PUT /api/profile

export const updateProfile = async (req, res) => {
  try {
    const session = req.session;
    const employee = await Employee.findOne({ userId: session.userId });
    if (!employee) return res.status(400).json({ error: "Employee Not Found" });
    if (employee.isDeleted) {
      res.status(403).json({
        error: "Your Account Is Deactived, You Cannot Update Your Profile",
      });
    }

    await Employee.findByIdAndUpdate(employee._id, { bio: req.body.bio });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed To Update Profile" });
  }
};
