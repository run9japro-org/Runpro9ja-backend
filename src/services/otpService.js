import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import twilio from 'twilio';

// Email Transporter
let transporter;

try {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { 
      user: env.smtp.user, 
      pass: env.smtp.pass 
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error('✗ SMTP connection failed:', error.message);
    } else {
      console.log('✓ SMTP server is ready to send emails');
    }
  });
} catch (error) {
  console.error('✗ Failed to create email transporter:', error.message);
  transporter = null;
}

// Twilio Client for SMS
let twilioClient;
try {
  if (env.twilio.accountSid && env.twilio.authToken) {
    twilioClient = twilio(env.twilio.accountSid, env.twilio.authToken);
    console.log('✓ Twilio client initialized');
  } else {
    console.warn('⚠ Twilio credentials not found - SMS will be disabled');
    twilioClient = null;
  }
} catch (error) {
  console.error('✗ Twilio client initialization failed:', error.message);
  twilioClient = null;
}

export const sendEmailOtp = async ({ to, name, code }) => {
  if (!transporter) {
    console.error('✗ Email transporter not available');
    throw new Error('Email service temporarily unavailable');
  }

  try {
    console.log(`Attempting to send email OTP to: ${to}`);
    
    const mailOptions = {
      from: `"RunPro9ja" <${env.smtp.user}>`,
      to: to,
      subject: 'Your RunPro9ja Verification Code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#333;">Verification Code</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Your RunPro9ja verification code is:</p>
          <div style="background:#f4f4f4;padding:20px;text-align:center;border-radius:8px;margin:20px 0;">
            <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#333;">${code}</div>
          </div>
          <p style="color:#666;">This code expires in 10 minutes.</p>
          <p style="color:#999;font-size:12px;margin-top:30px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Email OTP sent successfully:', info.messageId);
    return { success: true, service: 'email', messageId: info.messageId };
    
  } catch (error) {
    console.error('✗ Email OTP sending failed:', error.message);
    return { 
      success: false, 
      service: 'email', 
      error: error.message 
    };
  }
};

export const sendSmsOtp = async ({ to, code }) => {
  if (!twilioClient) {
    console.error('✗ SMS service not available');
    return { 
      success: false, 
      service: 'sms', 
      error: 'SMS service not configured' 
    };
  }

  try {
    const normalizedTo = to.startsWith('+') ? to : `+234${to.replace(/^0/, '')}`;
    console.log(`Attempting to send SMS OTP to: ${normalizedTo}`);
    
    const message = await twilioClient.messages.create({
      body: `Your RunPro9ja verification code is: ${code}. Valid for 10 minutes.`,
      from: env.twilio.phoneNumber,
      to: normalizedTo
    });
    
    console.log('✓ SMS OTP sent successfully:', message.sid);
    return { 
      success: true, 
      service: 'sms', 
      messageId: message.sid 
    };
  } catch (err) {
    console.error('✗ SMS OTP sending failed:', err.message);
    return { 
      success: false, 
      service: 'sms', 
      error: err.message 
    };
  }
};

// New function to send OTP through both channels
export const sendOtpBothChannels = async ({ to, name, code, phone }) => {
  const results = {
    email: null,
    sms: null,
    allSuccessful: false,
    partialSuccess: false
  };

  // Send email OTP if email is provided
  if (to) {
    results.email = await sendEmailOtp({ to, name, code });
  } else {
    results.email = { success: false, service: 'email', error: 'No email provided' };
  }

  // Send SMS OTP if phone is provided
  if (phone) {
    results.sms = await sendSmsOtp({ to: phone, code });
  } else {
    results.sms = { success: false, service: 'sms', error: 'No phone provided' };
  }

  // Determine overall success
  const emailSuccess = results.email.success;
  const smsSuccess = results.sms.success;
  
  results.allSuccessful = emailSuccess && smsSuccess;
  results.partialSuccess = emailSuccess || smsSuccess;

  console.log('OTP Delivery Summary:', {
    email: emailSuccess ? '✓' : '✗',
    sms: smsSuccess ? '✓' : '✗',
    overall: results.allSuccessful ? 'Both' : (results.partialSuccess ? 'Partial' : 'Failed')
  });

  return results;
};