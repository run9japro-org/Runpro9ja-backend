import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import twilio from 'twilio';

// Email Transporter - FIXED CONFIGURATION
let transporter;

try {
  transporter = nodemailer.createTransport({
    service: 'gmail', // Use service name instead of host/port
    auth: { 
      user: env.smtp.user, 
      pass: env.smtp.pass 
    },
    connectionTimeout: 60000, // Increased timeout
    socketTimeout: 60000,
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error('✗ SMTP connection failed:', error.message);
      console.log('💡 TIP: Make sure you are using an "App Password" from Gmail, not your regular password');
    } else {
      console.log('✓ SMTP server is ready to send emails');
    }
  });
} catch (error) {
  console.error('✗ Failed to create email transporter:', error.message);
  transporter = null;
}

// Twilio Client for SMS - FIXED FOR NIGERIAN NUMBERS
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
    return {
      success: false,
      service: 'email',
      error: 'Email service temporarily unavailable'
    };
  }

  try {
    console.log(`Attempting to send email OTP to: ${to}`);

    const message = `
Hi ${name || 'there'},

Your RunPro9ja verification code is: ${code}

This code expires in 10 minutes.

If you didn't request this code, please ignore this email.

— RunPro9ja Team
    `;

    const mailOptions = {
      from: `"RunPro9ja" <${env.smtp.user}>`,
      to,
      subject: 'Your RunPro9ja Verification Code',
      text: message   // 👈 use text instead of html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Email OTP sent successfully:', info.messageId);
    return { success: true, service: 'email', messageId: info.messageId };

  } catch (error) {
    console.error('✗ Email OTP sending failed:', error.message);

    if (error.code === 'EAUTH') {
      console.log('💡 SOLUTION: Use an "App Password" from Google Account settings');
    } else if (error.code === 'ECONNECTION') {
      console.log('💡 SOLUTION: Check internet connection and firewall settings');
    }

    return {
      success: false,
      service: 'email',
      error: error.message
    };
  }
};


// UPDATED: Send OTP through both channels with fallbacks
export const sendOtpBothChannels = async ({ to, name, code, phone }) => {
  const results = {
    email: null,
    sms: null,
    fallback: null,
    allSuccessful: false,
    partialSuccess: false
  };

  // Send email OTP
  if (to) {
    results.email = await sendEmailOtp({ to, name, code });
  }

  // Send SMS OTP with fallback
  if (phone) {
    results.sms = await sendSmsOtp({ to: phone, code });
    
    // If regular SMS fails, try email-to-SMS
    if (!results.sms.success) {
      console.log('Trying email-to-SMS fallback...');
      results.fallback = await sendSmsViaEmail({ to: phone, code });
    }
  }

  // Determine overall success
  const emailSuccess = results.email?.success || false;
  const smsSuccess = results.sms?.success || false;
  const fallbackSuccess = results.fallback?.success || false;
  
  results.allSuccessful = emailSuccess && (smsSuccess || fallbackSuccess);
  results.partialSuccess = emailSuccess || smsSuccess || fallbackSuccess;

  console.log('OTP Delivery Summary:', {
    email: emailSuccess ? '✓' : '✗',
    sms: smsSuccess ? '✓' : '✗',
    fallback: fallbackSuccess ? '✓' : '✗',
    overall: results.allSuccessful ? 'Both' : (results.partialSuccess ? 'Partial' : 'Failed')
  });

  return results;
};
