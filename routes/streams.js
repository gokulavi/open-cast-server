// ============================================================
// routes/streams.js - Stream management endpoints
// These sync with Firestore to track active streams
// ============================================================

const express = require('express');
const router = express.Router();
const { getFirestore } = require('../config/firebase');

// ── GET /api/streams ───────────────────────────────────────
// Returns all currently live streams
router.get('/', async (req, res) => {
  try {
    const db = getFirestore();
    if (!db) {
      return res.status(503).json({ error: 'Firebase not configured' });
    }

    const snapshot = await db
      .collection('streams')
      .where('isLive', '==', true)
      .orderBy('startedAt', 'desc')
      .limit(50)
      .get();

    const streams = [];
    snapshot.forEach(doc => {
      streams.push({ id: doc.id, ...doc.data() });
    });

    return res.json({ streams, count: streams.length });
  } catch (error) {
    console.error('Get streams error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

// ── POST /api/streams/create ───────────────────────────────
// Called when a user starts a live stream
// Body: { channelId, userId, title, category, thumbnailUrl }
router.post('/create', async (req, res) => {
  try {
    const { channelId, userId, title, category, thumbnailUrl } = req.body;

    if (!channelId || !userId || !title) {
      return res.status(400).json({
        error: 'channelId, userId, and title are required',
      });
    }

    const db = getFirestore();
    if (!db) {
      // If Firebase not set up, just return success (for testing)
      return res.json({
        success: true,
        streamId: channelId,
        message: 'Stream created (Firebase not configured - data not persisted)',
      });
    }

    const streamData = {
      channelId,
      userId,
      title: title.trim(),
      category: category || 'General',
      thumbnailUrl: thumbnailUrl || null,
      isLive: true,
      viewerCount: 0,
      startedAt: new Date().toISOString(),
      endedAt: null,
    };

    await db.collection('streams').doc(channelId).set(streamData);

    console.log(`Stream created: ${channelId} by user ${userId}`);

    return res.json({ success: true, streamId: channelId, stream: streamData });

  } catch (error) {
    console.error('Create stream error:', error.message);
    return res.status(500).json({ error: 'Failed to create stream' });
  }
});

// ── POST /api/streams/end ──────────────────────────────────
// Called when a streamer ends their stream
// Body: { channelId, userId }
router.post('/end', async (req, res) => {
  try {
    const { channelId, userId } = req.body;

    if (!channelId || !userId) {
      return res.status(400).json({ error: 'channelId and userId are required' });
    }

    const db = getFirestore();
    if (!db) {
      return res.json({ success: true, message: 'Stream ended (Firebase not configured)' });
    }

    const streamRef = db.collection('streams').doc(channelId);
    const streamDoc = await streamRef.get();

    if (!streamDoc.exists) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Verify the user ending the stream is the one who started it
    if (streamDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to end this stream' });
    }

    await streamRef.update({
      isLive: false,
      endedAt: new Date().toISOString(),
      viewerCount: 0,
    });

    console.log(`Stream ended: ${channelId}`);

    return res.json({ success: true, channelId });

  } catch (error) {
    console.error('End stream error:', error.message);
    return res.status(500).json({ error: 'Failed to end stream' });
  }
});

// ── POST /api/streams/viewer ───────────────────────────────
// Update viewer count when someone joins/leaves
// Body: { channelId, action: 'join' | 'leave' }
router.post('/viewer', async (req, res) => {
  try {
    const { channelId, action } = req.body;

    if (!channelId || !['join', 'leave'].includes(action)) {
      return res.status(400).json({ error: 'channelId and action (join|leave) are required' });
    }

    const db = getFirestore();
    if (!db) {
      return res.json({ success: true });
    }

    const { FieldValue } = require('firebase-admin/firestore');
    const increment = action === 'join' ? 1 : -1;

    await db.collection('streams').doc(channelId).update({
      viewerCount: FieldValue.increment(increment),
    });

    return res.json({ success: true });

  } catch (error) {
    console.error('Update viewer error:', error.message);
    return res.status(500).json({ error: 'Failed to update viewer count' });
  }
});

module.exports = router;
