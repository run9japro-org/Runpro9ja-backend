import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Simple console logger for debugging
const logger = {
  info: (message, data = null) => {
    console.log(`ℹ️ ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message, error = null) => {
    console.error(`❌ ${message}`, error ? error.message : '');
  },
  success: (message, data = null) => {
    console.log(`✅ ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
};

// SIMPLE Email Transporter - Debug Version
let transporter = null;

try {
  logger.info('Initializing email transporter...');
  
  // Test if SMTP credentials exist
  if (!env.smtp?.user || !env.smtp?.pass) {
    logger.error('SMTP credentials missing in environment variables');
    logger.info('Required: SMTP_USER and SMTP_PASS');
  } else {
    logger.info('SMTP credentials found', {
      user: `${env.smtp.user.substring(0, 3)}...`,
      hasPass: !!env.smtp.pass
    });

    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass
      }
    });

    // Test connection
    await transporter.verify();
    logger.success('Email transporter initialized successfully');
  }
} catch (error) {
  logger.error('Failed to initialize email transporter', error);
  transporter = null;
}

// SIMPLIFIED Email OTP Function
export const sendEmailOtp = async ({ to, name, code }) => {
  logger.info('Attempting to send email OTP', { to, name, codeLength: code.length });

  if (!transporter) {
    logger.error('Email transporter not available');
    return {
      success: false,
      service: 'email',
      error: 'Email service not configured'
    };
  }

  try {
    const mailOptions = {
      from: `"RunPro9ja" <${env.smtp.user}>`,
      to: to,
      subject: 'Your RunPro9ja Verification Code',
      text: `
Hi ${name || 'there'},

Your RunPro9ja verification code is: ${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Best regards,
RunPro9ja Team
      `,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2E7D32;">RunPro9ja Verification</h2>
  <p>Hi ${name || 'there'},</p>
  <p>Your verification code is:</p>
  <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
    ${code}
  </div>
  <p>This code will expire in 10 minutes.</p>
  <p>If you didn't request this code, please ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px;">Best regards,<br>RunPro9ja Team</p>
</div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    logger.success('Email OTP sent successfully', { 
      messageId: result.messageId,
      to: to
    });

    return {
      success: true,
      service: 'email',
      messageId: result.messageId
    };

  } catch (error) {
    logger.error('Failed to send email OTP', error);
    
    // Provide specific error messages
    let userMessage = error.message;
    
    if (error.code === 'EAUTH') {
      userMessage = 'Email authentication failed. Please check your SMTP credentials.';
      logger.info('💡 TIP: Use an App Password from Google Account settings, not your regular password');
    } else if (error.code === 'EENVELOPE') {
      userMessage = 'Invalid email address.';
    } else if (error.code === 'ECONNECTION') {
      userMessage = 'Cannot connect to email server. Check your internet connection.';
    }

    return {
      success: false,
      service: 'email',
      error: userMessage,
      debug: error.message
    };
  }
};

// SIMPLIFIED SMS OTP Function (Placeholder for now)
export const sendSmsOtp = async ({ to, code }) => {
  logger.info('SMS OTP requested but not configured', { to, code });
  
  return {
    success: false,
    service: 'sms',
    error: 'SMS service not configured. Please check Twilio credentials.',
    suggestion: 'Configure Twilio or use email-only for now'
  };
};

// SIMPLIFIED Combined OTP Function
export const sendOtpBothChannels = async ({ to, name, code, phone }) => {
  logger.info('Starting OTP delivery process', { 
    hasEmail: !!to, 
    hasPhone: !!phone,
    code: code
  });

  const results = {
    email: null,
    sms: null,
    allSuccessful: false,
    partialSuccess: false,
    message: ''
  };

  // Try email first
  if (to) {
    results.email = await sendEmailOtp({ to, name, code });
  } else {
    logger.error('No email address provided for OTP');
  }

  // Try SMS if phone provided
  if (phone) {
    results.sms = await sendSmsOtp({ to: phone, code });
  }

  // Determine results
  const emailSuccess = results.email?.success || false;
  const smsSuccess = results.sms?.success || false;

  results.allSuccessful = emailSuccess && smsSuccess;
  results.partialSuccess = emailSuccess || smsSuccess;

  if (results.allSuccessful) {
    results.message = 'OTP sent via both email and SMS';
    logger.success('OTP delivered via both channels');
  } else if (results.partialSuccess) {
    results.message = `OTP sent via ${emailSuccess ? 'email' : 'SMS'} only`;
    logger.info('OTP partially delivered', { email: emailSuccess, sms: smsSuccess });
  } else {
    results.message = 'Failed to send OTP via any channel';
    logger.error('OTP delivery failed completely');
  }

  return results;
};

// Test function to verify configuration
export const testEmailConfiguration = async () => {
  logger.info('Testing email configuration...');
  
  if (!transporter) {
    return {
      success: false,
      message: 'Email transporter not initialized. Check SMTP credentials.'
    };
  }

  try {
    await transporter.verify();
    
    // Try sending a test email
    const testResult = await sendEmailOtp({
      to: env.smtp.user, // Send to yourself
      name: 'Test User',
      code: '123456'
    });

    return testResult;

  } catch (error) {
    logger.error('Email configuration test failed', error);
    return {
      success: false,
      message: error.message
    };
  }
};