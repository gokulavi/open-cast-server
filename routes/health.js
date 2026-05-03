// ============================================================
// routes/health.js - Server health check endpoint
// ============================================================

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    services: {
      agora: !!(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE),
      firebase: !!(process.env.FIREBASE_PROJECT_ID),
    },
  });
});

module.exports = router;
