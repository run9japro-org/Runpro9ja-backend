import dotenv from 'dotenv';
dotenv.config();


export const env = {
port: process.env.PORT || 5050,
nodeEnv: process.env.NODE_ENV || 'development',
clientOrigin: process.env.CLIENT_ORIGIN || '*',
mongoUri: process.env.MONGO_URI,
jwtSecret: process.env.JWT_SECRET,
jwtExpires: process.env.JWT_EXPIRES || '7d',
smtp: {
host: process.env.SMTP_HOST,
port: Number(process.env.SMTP_PORT || 587),
secure: String(process.env.SMTP_SECURE || 'true') === 'true',
user: process.env.SMTP_USER,
pass: process.env.SMTP_PASS,
from: process.env.FROM_EMAIL || 'no-reply@example.com'
}
};