// services/emailService.js
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  service: env.smtp.service || 'gmail',
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.secure,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass
  }
});

export const sendEmail = async ({ to, subject, html, text }) => {
  const info = await transporter.sendMail({
    from: env.smtp.from || env.smtp.user,
    to,
    subject,
    html,
    text
  });
  return info;
};

// Password reset email template
export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const subject = 'Reset Your Password - RunPro 9ja';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2E7D32; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { background: #2E7D32; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .code { background: #f4f4f4; padding: 10px; border-radius: 5px; font-family: monospace; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>RunPro 9ja</h1>
                <p>Password Reset Request</p>
            </div>
            <div class="content">
                <h2>Hello ${name},</h2>
                <p>You requested to reset your password for your RunPro 9ja account.</p>
                <p>Click the button below to create a new password:</p>
                
                <div style="text-align: center;">
                    <a href="${resetUrl}" class="button" style="color: white; text-decoration: none;">
                        Reset Your Password
                    </a>
                </div>

                <p>Or copy and paste this link in your browser:</p>
                <div class="code">${resetUrl}</div>

                <p><strong>This link will expire in 1 hour.</strong></p>
                
                <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                
                <div class="footer">
                    <p>Best regards,<br><strong>RunPro 9ja Team</strong></p>
                    <p>Need help? Contact us at ${env.smtp.user}</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `Hello ${name},\n\nYou requested to reset your password. Click this link to reset: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nRunPro 9ja Team`;

  try {
    const info = await sendEmail({ to, subject, html, text });
    console.log('✅ Password reset email sent to:', to);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

// OTP email template
export const sendOtpEmail = async ({ to, name, code }) => {
  const subject = 'Your Verification Code - RunPro 9ja';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2E7D32; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-code { background: #2E7D32; color: white; padding: 15px; font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 10px; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>RunPro 9ja</h1>
                <p>Email Verification</p>
            </div>
            <div class="content">
                <h2>Hello ${name},</h2>
                <p>Use the following code to verify your email address:</p>
                
                <div class="otp-code">${code}</div>
                
                <p>This code will expire in 10 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                
                <div class="footer">
                    <p>Best regards,<br><strong>RunPro 9ja Team</strong></p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `Hello ${name},\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nBest regards,\nRunPro 9ja Team`;

  try {
    const info = await sendEmail({ to, subject, html, text });
    console.log('✅ OTP email sent to:', to);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
};