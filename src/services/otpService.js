import nodemailer from "nodemailer";
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
    port: 587,
    secure: false,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
    requireTLS: true,
    logger: true,
    debug: true,
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  });

  await transporter.verify();
  console.log("✅ Gmail transporter ready!");
} catch (err) {
  console.error("❌ Email setup failed:", err.message);
}

// ===== TERMII SMS SETUP =====
class TermiiService {
  constructor() {
    this.apiKey = env.termii.apiKey;
    this.senderId = env.termii.senderId;
    this.baseURL = "https://api.ng.termii.com/api";
  }

  async sendSMS({ to, message }) {
    if (!this.apiKey || !this.senderId) {
      console.log("⚠️ Termii not configured — SMS will only log to console");
      console.log(`📱 [SMS LOG] OTP for ${to}: ${message}`);
      return {
        success: true,
        service: "sms",
        message: `OTP logged (Termii not configured)`,
      };
    }

    try {
      const response = await fetch(`${this.baseURL}/sms/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          from: this.senderId,
          sms: message,
          type: "plain",
          channel: "generic",
          api_key: this.apiKey,
        }),
      });

      const data = await response.json();

      if (data.message === "Successfully sent") {
        console.log(`✅ SMS sent to ${to}: ${data.messageId}`);
        return { 
          success: true, 
          service: "sms", 
          messageId: data.messageId,
          data 
        };
      } else {
        console.error("❌ Termii API error:", data.message);
        return { 
          success: false, 
          service: "sms", 
          error: data.message 
        };
      }
    } catch (error) {
      console.error("❌ Failed to send SMS via Termii:", error.message);
      return { 
        success: false, 
        service: "sms", 
        error: error.message 
      };
    }
  }

  async sendOtp({ to, code }) {
    // Termii has a dedicated OTP endpoint
    if (!this.apiKey || !this.senderId) {
      return this.sendSMS({ to, message: `Your verification code is ${code}` });
    }

    try {
      // First, send the OTP using Termii's OTP service
      const otpResponse = await fetch(`${this.baseURL}/sms/otp/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          message_type: "NUMERIC",
          to,
          from: this.senderId,
          channel: "generic",
          pin_attempts: 3,
          pin_time_to_live: 10, // minutes
          pin_length: 6,
          pin_placeholder: `< ${code} >`,
          message_text: `Your verification code is < ${code} >`,
          pin_type: "NUMERIC"
        }),
      });

      const data = await otpResponse.json();

      if (data.status === "success") {
        console.log(`✅ OTP sent to ${to}: ${data.pinId}`);
        return { 
          success: true, 
          service: "sms", 
          pinId: data.pinId,
          data 
        };
      } else {
        console.error("❌ Termii OTP error:", data.message);
        // Fallback to regular SMS
        return this.sendSMS({ to, message: `Your verification code is ${code}` });
      }
    } catch (error) {
      console.error("❌ Failed to send OTP via Termii:", error.message);
      // Fallback to regular SMS
      return this.sendSMS({ to, message: `Your verification code is ${code}` });
    }
  }
}

// Initialize Termii service
const termiiService = new TermiiService();

// ===== SEND EMAIL OTP =====
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
      text: message,
    });

    console.log(`✅ Email sent to ${to}: ${info.response}`);
    return { success: true, service: "email", messageId: info.messageId };
  } catch (error) {
    console.error("❌ Failed to send email:", error.message);
    return { success: false, service: "email", error: error.message };
  }
};

// ===== SEND SMS OTP (USING TERMII) =====
export const sendSmsOtp = async ({ to, code }) => {
  if (!to) return { success: false, service: "sms", error: "Phone number missing" };

  return await termiiService.sendOtp({ to, code });
};

// ===== SEND BOTH CHANNELS =====
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

// ===== VERIFY OTP WITH TERMII =====
export const verifySmsOtp = async ({ pinId, code }) => {
  if (!env.termii.apiKey) {
    console.log("⚠️ Termii not configured — OTP verification skipped");
    return { success: true, verified: true };
  }

  try {
    const response = await fetch(`${termiiService.baseURL}/sms/otp/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: env.termii.apiKey,
        pin_id: pinId,
        pin: code,
      }),
    });

    const data = await response.json();

    if (data.verified === true) {
      return { success: true, verified: true, data };
    } else {
      return { success: false, verified: false, error: data.message, data };
    }
  } catch (error) {
    console.error("❌ Failed to verify OTP:", error.message);
    return { success: false, verified: false, error: error.message };
  }
};

