// src/controllers/callController.js
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import { Call } from '../models/Call.js';

// Generate Agora token for voice call
export const generateToken = async (req, res, next) => {
  try {
    const { channelName, uid } = req.body;
    
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    
    if (!appId || !appCertificate) {
      return res.status(500).json({
        success: false,
        error: 'Agora credentials not configured'
      });
    }

    // Set token expiration time (1 hour)
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Build token with uid
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    // Create call record
    const call = await Call.create({
      channelName,
      caller: req.user.id,
      participants: [req.user.id],
      status: 'initiated'
    });

    res.json({
      success: true,
      token,
      appId,
      channelName,
      uid,
      callId: call._id
    });

  } catch (err) {
    next(err);
  }
};

// End call and update status
export const endCall = async (req, res, next) => {
  try {
    const { callId, duration } = req.body;
    
    const call = await Call.findByIdAndUpdate(
      callId,
      {
        status: 'completed',
        endedAt: new Date(),
        duration
      },
      { new: true }
    );

    // Emit call ended event via socket
    const io = getIO();
    io.to(`call_${callId}`).emit('call_ended', { callId, duration });

    res.json({ success: true, call });
  } catch (err) {
    next(err);
  }
};

// Get call history
export const getCallHistory = async (req, res, next) => {
  try {
    const calls = await Call.find({
      participants: req.user.id
    })
    .populate('caller', 'name profileImage')
    .sort({ createdAt: -1 });

    res.json({ success: true, calls });
  } catch (err) {
    next(err);
  }
};