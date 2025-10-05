import { sendEmailOtp } from "./src/services/otpService.js";

await sendEmailOtp({
  to: "shoyinkaoluwaseyi531@gmail.com",
  name: "Zane",
  code: 123456,
});
