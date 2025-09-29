import nodemailer from 'nodemailer';
import { env } from '../config/env.js';


const transporter = nodemailer.createTransport({
service:'gmail',
auth: { user: env.smtp.user, pass: env.smtp.pass }
});


export const sendEmailOtp = async ({ to, name, code }) => {
const info = await transporter.sendMail({
from: env.smtp.user,
to,
subject: 'Your Verification Code',
html: `
<div style="font-family:Arial,sans-serif;">
<h2>Verification Code</h2>
<p>Hi ${name || 'there'},</p>
<p>Your verification code is:</p>
<div style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</div>
<p>This code expires in 10 minutes.</p>
</div>`
});
return info.messageId;
};


// Placeholder: SMS via Twilio (to be added later)
export const sendSmsOtp = async ({ to, code }) => {
// integrate Twilio/other SMS provider later
console.log(`(DEV) SMS to ${to}: ${code}`);
return true;
};