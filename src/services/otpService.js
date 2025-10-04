import nodemailer from "nodemailer";
import twilio from "twilio";
import { env } from "../config/env.js";

let transporter;

// ===== EMAIL SETUP =====
try {
  console.log("🔧 Setting up Gmail transporter...");

  if (!env.smtp.user || !env.smtp.pass) {
    throw new Error("Missing Gmail credentials in .env");
  }

  transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // ✅ SSL required for port 465
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass
  },
  logger: true,  // ✅ show connection logs
  debug: true,   // ✅ print SMTP communication
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000
});

  await transporter.verify();
  console.log("✅ Gmail transporter ready!");
} catch (err) {
  console.error("❌ Email setup failed:", err.message);
}

// ===== SMS SETUP =====
let twilioClient = null;
try {
  if (env.twilio.sid && env.twilio.token) {
    twilioClient = twilio(env.twilio.sid, env.twilio.token);
    console.log("✅ Twilio client initialized");
  } else {
    console.log("⚠️ Twilio not configured — SMS will be logged only");
  }
} catch (err) {
  console.error("❌ Twilio setup failed:", err.message);
}

// ===== EMAIL FUNCTION =====
export const sendEmailOtp = async ({ to, name, code }) => {
  if (!transporter) {
    console.error("❌ Email transporter not initialized");
    return { success: false, service: "email", error: "Email not configured" };
  }

  const message = `
Hi ${name || "User"},

Your RunPro9ja verification code is: ${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Best regards,
RunPro9ja Team
  `;

  try {
    const info = await transporter.sendMail({
      from: `"RunPro9ja" <${env.smtp.user}>`,
      to,
      subject: "Your RunPro9ja Verification Code",
      text: message
    });

    console.log(`✅ Email sent to ${to}: ${info.response}`);
    return { success: true, service: "email", messageId: info.messageId };
  } catch (error) {
    console.error("❌ Failed to send email:", error.message);
    return { success: false, service: "email", error: error.message };
  }
};

// ===== SMS FUNCTION =====
export const sendSmsOtp = async ({ to, code }) => {
  if (!to) return { success: false, service: "sms", error: "Phone number missing" };

  if (!twilioClient) {
    console.log(`📱 [SMS LOG] OTP for ${to}: ${code}`);
    return {
      success: true,
      service: "sms",
      message: `OTP ${code} logged (Twilio not configured)`
    };
  }

  try {
    const message = await twilioClient.messages.create({
      body: `Your RunPro9ja verification code is ${code}`,
      from: env.twilio.phone,
      to
    });

    console.log(`✅ SMS sent to ${to}: ${message.sid}`);
    return { success: true, service: "sms", sid: message.sid };
  } catch (error) {
    console.error("❌ Failed to send SMS:", error.message);
    return { success: false, service: "sms", error: error.message };
  }
};

// ===== SEND BOTH =====
export const sendOtpBothChannels = async ({ to, name, code, phone }) => {
  console.log("🚀 Sending OTP via both channels...");
  console.log(`   📧 Email: ${to}`);
  console.log(`   📱 Phone: ${phone}`);
  console.log(`   🔑 Code: ${code}`);

  const emailResult = to ? await sendEmailOtp({ to, name, code }) : null;
  const smsResult = phone ? await sendSmsOtp({ to: phone, code }) : null;

  const allSuccessful = emailResult?.success && smsResult?.success;
  const partialSuccess = emailResult?.success || smsResult?.success;

  let message;
  if (allSuccessful) message = "OTP sent via Email and SMS!";
  else if (emailResult?.success) message = "OTP sent via Email!";
  else if (smsResult?.success) message = "OTP sent via SMS!";
  else message = "Failed to send OTP.";

  console.log("📊 Summary:", { allSuccessful, partialSuccess, message });

  return { emailResult, smsResult, allSuccessful, partialSuccess, message };
};
