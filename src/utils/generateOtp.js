export const generateNumericOtp = (digits = 6) => {
const min = 10 ** (digits - 1);
const max = 10 ** digits - 1;
return String(Math.floor(Math.random() * (max - min + 1)) + min);
};