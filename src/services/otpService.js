import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Use your simple Gmail transporter setup
let transporter = null;

try {
  console.log('🔧 Initializing Gmail transporter...');
  
  // Check if credentials exist
  if (!env.smtp?.user || !env.smtp?.pass) {
    console.error('❌ Gmail credentials missing:');
    console.log('   GMAIL_USER:', env.smtp?.user ? '✓ Found' : '✗ Missing');
    console.log('   GMAIL_PASS:', env.smtp?.pass ? '✓ Found' : '✗ Missing');
  } else {
    console.log('✅ Gmail credentials found');
    console.log('   User:', env.smtp.user);
    console.log('   Pass:', `${env.smtp.pass.substring(0, 3)}...${env.smtp.pass.substring(env.smtp.pass.length - 3)}`);
    
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass
      }
    });

    // Test connection
    await transporter.verify();
    console.log('✅ Gmail transporter ready and connected');
  }
} catch (error) {
  console.error('❌ Gmail transporter failed:', error.message);
  
  if (error.code === 'EAUTH') {
    console.log('\n💡 GMAIL AUTH FIX REQUIRED:');
    console.log('   1. Go to: https://myaccount.google.com/');
    console.log('   2. Enable 2-Factor Authentication');
    console.log('   3. Go to "Security" → "App passwords"');
    console.log('   4. Generate app password for "Mail"');
    console.log('   5. Use the 16-character app password (NOT your regular password)');
    console.log('   6. Update your .env file with the app password');
  }
}

export const sendEmailOtp = async ({ to, name, code }) => {
  console.log(`📧 Attempting to send email to: ${to}`);

  if (!transporter) {
    console.error('❌ Email transporter not available - check Gmail configuration');
    return {
      success: false,
      service: 'email',
      error: 'Email service not configured properly'
    };
  }

  try {
    const message = `
Hi ${name},

Your RunPro9ja verification code is: ${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Best regards,
RunPro9ja Team
    `;

    const mailOptions = {
      from: `"RunPro9ja" <${env.smtp.user}>`,
      to: to,
      subject: 'Your RunPro9ja Verification Code',
      text: message
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.response);
    console.log('✅ Message ID:', info.messageId);

    return {
      success: true,
      service: 'email',
      messageId: info.messageId,
      response: info.response
    };

  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    
    let userMessage = error.message;
    
    if (error.code === 'EAUTH') {
      userMessage = 'Email authentication failed. Please use an App Password from Google.';
    } else if (error.code === 'EENVELOPE') {
      userMessage = 'Invalid email address.';
    }

    return {
      success: false,
      service: 'email',
      error: userMessage
    };
  }
};

// Simple SMS function (logs to console for now)
export const sendSmsOtp = async ({ to, code }) => {
  console.log(`📱 [SMS SIMULATION] OTP for ${to}: ${code}`);
  
  // For development, just log the SMS
  return {
    success: true,
    service: 'sms',
    message: `OTP ${code} would be sent to ${to}`,
    note: 'SMS service not configured - message logged to console'
  };
};

export const sendOtpBothChannels = async ({ to, name, code, phone }) => {
  console.log('🚀 Starting OTP delivery process...');
  console.log(`   📧 Email: ${to}`);
  console.log(`   📱 Phone: ${phone}`);
  console.log(`   🔑 Code: ${code}`);

  const results = {
    email: null,
    sms: null,
    allSuccessful: false,
    partialSuccess: false,
    message: ''
  };

  // Send email OTP
  if (to) {
    console.log('📧 Sending email OTP...');
    results.email = await sendEmailOtp({ to, name, code });
  } else {
    console.log('❌ No email address provided');
  }

  // Send SMS OTP
  if (phone) {
    console.log('📱 Sending SMS OTP...');
    results.sms = await sendSmsOtp({ to: phone, code });
  }

  // Determine results
  const emailSuccess = results.email?.success || false;
  const smsSuccess = results.sms?.success || false;

  results.allSuccessful = emailSuccess && smsSuccess;
  results.partialSuccess = emailSuccess || smsSuccess;

  if (results.allSuccessful) {
    results.message = 'OTP sent via email and SMS!';
    console.log('✅ OTP delivered via both channels');
  } else if (emailSuccess) {
    results.message = 'OTP sent via email! Check your inbox.';
    console.log('✅ OTP sent via email');
  } else if (smsSuccess) {
    results.message = 'OTP sent via SMS!';
    console.log('✅ OTP sent via SMS');
  } else {
    results.message = 'Failed to send OTP. Please try again.';
    console.log('❌ OTP delivery failed');
  }

  console.log('📊 OTP Delivery Summary:');
  console.log('   Email:', emailSuccess ? '✅ Success' : '❌ Failed');
  console.log('   SMS:', smsSuccess ? '✅ Success' : '❌ Failed');
  console.log('   Message:', results.message);

  return results;
};