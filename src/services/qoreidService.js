import axios from "axios";

const qoreid = axios.create({
  baseURL: "https://api.qoreid.com/v1",
  headers: {
    "Content-Type": "application/json",
    "x-client-id": process.env.QOREID_CLIENT_ID,
    "x-secret-key": process.env.QOREID_SECRET_KEY
  }
});

// Nigerian Passport
export const verifyPassport = async (passportNumber, lastName) => {
  const res = await qoreid.post("/verifications/identities/passport", {
    number: passportNumber,
    last_name: lastName
  });
  return res.data;
};

// Virtual NIN (vNIN)
export const verifyVNIN = async (vnin, phone) => {
  const res = await qoreid.post("/verifications/identities/vnin", {
    number: vnin,
    phone: phone
  });
  return res.data;
};

// Driver’s License
export const verifyDriversLicense = async (licenseNumber, dob) => {
  const res = await qoreid.post("/verifications/identities/drivers-license", {
    number: licenseNumber,
    date_of_birth: dob
  });
  return res.data;
};

// Voter’s Card
export const verifyVotersCard = async (vin, state) => {
  const res = await qoreid.post("/verifications/identities/voters-card", {
    number: vin,
    state: state
  });
  return res.data;
};
