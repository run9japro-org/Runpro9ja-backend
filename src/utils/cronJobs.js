import cron from "node-cron";
import bcrypt from "bcryptjs";
import {User} from "../models/User.js";
import { ROLES } from "../constants/roles.js";
import { generateStrongPassword } from "./passwordGenerator.js";
import { notifyUser } from "../services/notificationService.js";

// Define admin-related roles
export const ADMIN_ROLES = new Set([
  ROLES.ADMIN_CUSTOMER_SERVICE,
  ROLES.ADMIN_AGENT_SERVICE,
  ROLES.REPRESENTATIVE
]);

export const startCronJobs = () => {
  // Run every day at midnight (00:00)
  cron.schedule("0 0 * * *", async () => {
    console.log("🔁 Running daily password rotation for admin accounts...");

    try {
      // Fetch all admins based on defined roles
      const admins = await User.find({ role: { $in: Array.from(ADMIN_ROLES) } });

      for (const admin of admins) {
        const newPassword = generateStrongPassword();
        admin.password = await bcrypt.hash(newPassword, 10);
        admin.passwordLastRotated = new Date();
        await admin.save();

        // Optional — notify each admin about password rotation
        await notifyUser(admin._id, "SYSTEM_PASSWORD_ROTATED", [newPassword]);
      }

      console.log(`✅ Passwords rotated for ${admins.length} admin(s).`);
    } catch (error) {
      console.error("❌ Error rotating admin passwords:", error);
    }
  });
};
