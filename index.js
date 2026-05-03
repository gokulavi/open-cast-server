// ============================================================
// OpenCast Server - Main Entry Point
// Express server for Agora token generation + Firebase admin
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const tokenRoutes = require('./routes/token');
const streamRoutes = require('./routes/streams');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security middleware ────────────────────────────────────
app.use(helmet());
app.use(express.json());

// CORS — allow your Flutter app to call this server
const allowedOrigins = process.env.ALLOWED_ORIGINS === '*'
  ? '*'
  : process.env.ALLOWED_ORIGINS?.split(',') || '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // max 100 requests per window per IP
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter limit for token generation
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // max 20 token requests per minute per IP
  message: { error: 'Too many token requests.' },
});
app.use('/api/token', tokenLimiter);

// ── Routes ────────────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/streams', streamRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'OpenCast Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      generateToken: 'POST /api/token/generate',
      rtcToken: 'GET /api/token/rtc?channel=CHANNEL&uid=UID&role=publisher|subscriber',
      streams: 'GET /api/streams',
      createStream: 'POST /api/streams/create',
      endStream: 'POST /api/streams/end',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ OpenCast server running on port ${PORT}`);
  console.log(`   Agora App ID: ${process.env.AGORA_APP_ID ? '✓ set' : '✗ MISSING'}`);
  console.log(`   Agora Certificate: ${process.env.AGORA_APP_CERTIFICATE ? '✓ set' : '✗ MISSING'}`);
  console.log(`   Firebase Project: ${process.env.FIREBASE_PROJECT_ID ? '✓ set' : '⚠ not set (optional)'}`);
});
