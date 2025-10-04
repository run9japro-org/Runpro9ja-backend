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
