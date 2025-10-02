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
    
    // Specific error handling for common Gmail issues
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
    // FIXED: Better Nigerian number normalization
    let normalizedTo;
    if (to.startsWith('+234')) {
      normalizedTo = to;
    } else if (to.startsWith('234')) {
      normalizedTo = `+${to}`;
    } else if (to.startsWith('0')) {
      normalizedTo = `+234${to.substring(1)}`;
    } else {
      normalizedTo = `+234${to}`;
    }

    console.log(`Attempting to send SMS OTP to: ${normalizedTo}`);
    
    // FIXED: Use messaging service SID or alphanumeric sender ID for Nigeria
    const messagePayload = {
      body: `Your RunPro9ja verification code is: ${code}. Valid for 10 minutes.`,
      to: normalizedTo
    };

    // Try different sending methods for Nigeria
    if (env.twilio.messagingServiceSid) {
      // Method 1: Use Messaging Service SID (best for international)
      messagePayload.messagingServiceSid = env.twilio.messagingServiceSid;
    } else if (env.twilio.phoneNumber.startsWith('+1')) {
      // Method 2: Use US number with proper formatting
      messagePayload.from = env.twilio.phoneNumber;
    } else {
      // Method 3: Use alphanumeric sender ID (works in some countries)
      messagePayload.from = 'RunPro9ja';
    }

    const message = await twilioClient.messages.create(messagePayload);
    
    console.log('✓ SMS OTP sent successfully:', message.sid);
    return { 
      success: true, 
      service: 'sms', 
      messageId: message.sid 
    };
  } catch (err) {
    console.error('✗ SMS OTP sending failed:', err.message);
    console.error('Error details:', {
      code: err.code,
      moreInfo: err.moreInfo,
      status: err.status
    });

    // Specific solution for Nigerian numbers
    if (err.code === 21408) {
      console.log('💡 SOLUTION: Your Twilio number cannot send to Nigerian numbers.');
      console.log('💡 Register for Twilio\'s Nigeria Beta program or use a different provider.');
    }
    
    return { 
      success: false, 
      service: 'sms', 
      error: err.message 
    };
  }
};

// Alternative SMS provider using email-to-SMS gateways
export const sendSmsViaEmail = async ({ to, code }) => {
  if (!transporter) {
    return { success: false, error: 'Email service not available' };
  }

  try {
    // Nigerian carrier email-to-SMS gateways
    const carrierGateways = {
      'mtn': 'smail.mtnonline.com',
      'airtel': 'sms.airtel.com',
      'glo': 'sms.glo.com',
      '9mobile': 'sms.9mobile.com'
    };

    // Extract last 10 digits for carrier detection
    const last10Digits = to.replace(/\D/g, '').slice(-10);
    const carrier = 'mtn'; // Default to MTN, you can implement carrier detection
    
    const emailToSms = `${last10Digits}@${carrierGateways[carrier]}`;
    
    const mailOptions = {
      from: env.smtp.user,
      to: emailToSms,
      subject: '',
      text: `Your RunPro9ja code: ${code}. Valid 10 min.`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Email-to-SMS sent:', info.messageId);
    return { success: true, service: 'email-to-sms', messageId: info.messageId };
    
  } catch (error) {
    console.error('✗ Email-to-SMS failed:', error.message);
    return { success: false, service: 'email-to-sms', error: error.message };
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
