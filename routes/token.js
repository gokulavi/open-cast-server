// ============================================================
// routes/token.js - Agora RTC token generation
// ============================================================

const express = require('express');
const router = express.Router();
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

// Helper to validate environment
function checkAgoraConfig() {
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
    throw new Error('Agora App ID and Certificate must be set in environment variables');
  }
}

// ── GET /api/token/rtc ─────────────────────────────────────
// Query params: channel, uid, role (publisher|subscriber)
// Example: /api/token/rtc?channel=mystream&uid=12345&role=publisher
router.get('/rtc', (req, res) => {
  try {
    checkAgoraConfig();

    const { channel, uid, role } = req.query;

    // Validate required params
    if (!channel) {
      return res.status(400).json({ error: 'channel is required' });
    }

    const channelName = String(channel).trim();
    if (channelName.length === 0 || channelName.length > 64) {
      return res.status(400).json({ error: 'channel name must be 1-64 characters' });
    }

    // uid: 0 means Agora assigns one automatically
    const userId = uid ? parseInt(uid, 10) : 0;
    if (isNaN(userId) || userId < 0) {
      return res.status(400).json({ error: 'uid must be a non-negative integer' });
    }

    // Role: publisher (for streamers) or subscriber (for viewers)
    const agoraRole = role === 'subscriber'
      ? RtcRole.SUBSCRIBER
      : RtcRole.PUBLISHER; // default to publisher

    // Token expiry
    const expirySeconds = parseInt(process.env.AGORA_TOKEN_EXPIRY || '3600', 10);
    const expiryTimestamp = Math.floor(Date.now() / 1000) + expirySeconds;

    // Generate token
    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.AGORA_APP_ID,
      process.env.AGORA_APP_CERTIFICATE,
      channelName,
      userId,
      agoraRole,
      expiryTimestamp,
    );

    console.log(`Token generated for channel: ${channelName}, uid: ${userId}, role: ${role || 'publisher'}`);

    return res.json({
      token,
      channel: channelName,
      uid: userId,
      role: role || 'publisher',
      expiresIn: expirySeconds,
      appId: process.env.AGORA_APP_ID,
    });

  } catch (error) {
    console.error('Token generation error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ── POST /api/token/generate ───────────────────────────────
// Body: { channel, uid, role }
// Same as GET but accepts JSON body (better for production)
router.post('/generate', (req, res) => {
  try {
    checkAgoraConfig();

    const { channel, uid, role } = req.body;

    if (!channel) {
      return res.status(400).json({ error: 'channel is required' });
    }

    const channelName = String(channel).trim();
    if (channelName.length === 0 || channelName.length > 64) {
      return res.status(400).json({ error: 'channel name must be 1-64 characters' });
    }

    const userId = uid ? parseInt(uid, 10) : 0;
    if (isNaN(userId) || userId < 0) {
      return res.status(400).json({ error: 'uid must be a non-negative integer' });
    }

    const agoraRole = role === 'subscriber'
      ? RtcRole.SUBSCRIBER
      : RtcRole.PUBLISHER;

    const expirySeconds = parseInt(process.env.AGORA_TOKEN_EXPIRY || '3600', 10);
    const expiryTimestamp = Math.floor(Date.now() / 1000) + expirySeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.AGORA_APP_ID,
      process.env.AGORA_APP_CERTIFICATE,
      channelName,
      userId,
      agoraRole,
      expiryTimestamp,
    );

    console.log(`Token generated for channel: ${channelName}, uid: ${userId}, role: ${role || 'publisher'}`);

    return res.json({
      token,
      channel: channelName,
      uid: userId,
      role: role || 'publisher',
      expiresIn: expirySeconds,
      appId: process.env.AGORA_APP_ID,
    });

  } catch (error) {
    console.error('Token generation error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
