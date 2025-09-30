import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use TLS
  auth: { 
    user: env.smtp.user, 
    pass: env.smtp.pass 
  },
  // Increase timeouts for slower connections
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  // Additional options for better reliability
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5
});

// Verify transporter configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection error:', error.message);
  } else {
    console.log('✓ SMTP server is ready to send emails');
  }
});

export const sendEmailOtp = async ({ to, name, code }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Your App Name" <${env.smtp.user}>`,
      to,
      subject: 'Your Verification Code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#333;">Verification Code</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Your verification code is:</p>
          <div style="background:#f4f4f4;padding:20px;text-align:center;border-radius:8px;margin:20px 0;">
            <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#333;">${code}</div>
          </div>
          <p style="color:#666;">This code expires in 10 minutes.</p>
          <p style="color:#999;font-size:12px;margin-top:30px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `
    });
    console.log('✓ Email sent:', info.messageId);
    return info.messageId;
  } catch (error) {
    console.error('✗ Email sending failed:', error.message);
    throw new Error('Failed to send verification email');
  }
};

// Placeholder: SMS via Twilio (to be added later)
// --- SMS ---
const twilioClient = twilio(env.twilio.accountSid, env.twilio.authToken);

export const sendSmsOtp = async ({ to, code }) => {
  try {
    const message = await twilioClient.messages.create({
      body: `Your RunPro9ja verification code is: ${code}`,
      from: env.twilio.phoneNumber, // must be your Twilio number
      to: to.startsWith('+') ? to : `+234${to.replace(/^0/, '')}` // normalize Nigerian numbers
    });
    console.log('SMS sent:', message.sid);
    return true;
  } catch (err) {
    console.error('SMS sending failed:', err.message);
    return false;
  }
};