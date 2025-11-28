import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter;

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

      // Fix: Check the actual response structure from Termii
      if (data.message === "Successfully Sent" || data.message === "Successfully sent") {
        console.log(`✅ SMS sent to ${to}: ${data.message_id || data.messageId}`);
        return { 
          success: true, 
          service: "sms", 
          messageId: data.message_id || data.messageId,
          data 
        };
      } else {
        console.error("❌ Termii API error:", data.message || JSON.stringify(data));
        return { 
          success: false, 
          service: "sms", 
          error: data.message || "Unknown error" 
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

      console.log("📨 Termii OTP Response:", JSON.stringify(data, null, 2));

      // Fix: Handle different possible response structures from Termii
      if (data.status === "success" || data.code === "ok") {
        console.log(`✅ OTP sent to ${to}: ${data.pinId || data.pin_id}`);
        return { 
          success: true, 
          service: "sms", 
          pinId: data.pinId || data.pin_id,
          data 
        };
      } else {
        const errorMsg = data.message || data.error || "Unknown Termii error";
        console.error("❌ Termii OTP error:", errorMsg);
        
        // Fallback to regular SMS with better error handling
        console.log("🔄 Falling back to regular SMS...");
        return this.sendSMS({ 
          to, 
          message: `Your RunPro9ja verification code is: ${code}. Valid for 10 minutes.` 
        });
      }
    } catch (error) {
      console.error("❌ Failed to send OTP via Termii:", error.message);
      // Fallback to regular SMS
      return this.sendSMS({ 
        to, 
        message: `Your RunPro9ja verification code is: ${code}. Valid for 10 minutes.` 
      });
    }
  }
}

// Initialize Termii service
const termiiService = new TermiiService();

// ===== SEND SMS OTP (USING TERMII) =====
export const sendSmsOtp = async ({ to, code }) => {
  if (!to) {
    console.error("❌ Phone number missing for SMS OTP");
    return { 
      success: false, 
      service: "sms", 
      error: "Phone number missing" 
    };
  }

  console.log(`📱 Attempting to send SMS OTP to: ${to}`);
  const result = await termiiService.sendOtp({ to, code });
  
  // Log the complete result for debugging
  console.log(`📋 SMS OTP Result for ${to}:`, {
    success: result.success,
    service: result.service,
    pinId: result.pinId,
    error: result.error
  });
  
  return result;
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

