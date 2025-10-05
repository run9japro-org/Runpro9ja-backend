import nodemailer from "nodemailer";
import { env } from "./src/config/env.js";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

transporter.verify((error, success) => {
  if (error) console.error("❌ Error:", error);
  else console.log("✅ Server is ready to take our messages!");
});
