import express from "express";
import {
  verifyPassport,
  verifyVNIN,
  verifyDriversLicense,
  verifyVotersCard
} from "../services/qoreidService.js";

const router = express.Router();

/**
 * Nigerian Passport Verification
 */
router.post("/passport", async (req, res) => {
  try {
    const { passportNumber, lastName } = req.body;

    const result = await verifyPassport(passportNumber, lastName);

    res.json({ success: true, data: result });

  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.response?.data || err.message
    });
  }
});

/**
 * virtual NIN (vNIN) Verification
 */
router.post("/vnin", async (req, res) => {
  try {
    const { vnin, phone } = req.body;

    const result = await verifyVNIN(vnin, phone);

    res.json({ success: true, data: result });

  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.response?.data || err.message
    });
  }
});

/**
 * Driver's License Verification
 */
router.post("/drivers-license", async (req, res) => {
  try {
    const { licenseNumber, dob } = req.body; // dob: yyyy-mm-dd

    const result = await verifyDriversLicense(licenseNumber, dob);

    res.json({ success: true, data: result });

  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.response?.data || err.message
    });
  }
});

/**
 * Voter's Card Verification
 */
router.post("/voters-card", async (req, res) => {
  try {
    const { vin, state } = req.body;

    const result = await verifyVotersCard(vin, state);

    res.json({ success: true, data: result });

  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.response?.data || err.message
    });
  }
});

export default router;

