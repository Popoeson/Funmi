// routes.js
import express from 'express';
import multer from 'multer';
import { ObjectId } from 'mongodb';
import { handleChat, handleImage, handleSearch, handleFile } from './mode.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * TEMP DEV USER
 * Replace later with real auth (Supabase)
 */
function devUser(req, res, next) {
  req.user = {
    id: 'dev-user-001',
    email: 'dev@funmi.ai'
  };
  next();
}

/**
 * Create / fetch session
 */
router.post('/session', devUser, async (req, res) => {
  try {
    const { sessionName = 'New Chat' } = req.body;
    const sessions = req.app.locals.db.collection('sessions');

    let session = await sessions.findOne({
      userId: req.user.id,
      name: sessionName
    });

    if (!session) {
      const insert = await sessions.insertOne({
        userId: req.user.id,
        name: sessionName,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      session = await sessions.findOne({ _id: insert.insertedId });
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Send message
 */
router.post('/message', devUser, upload.single('file'), async (req, res) => {
  try {
    let { sessionId, message, mode } = req.body;
    const sessions = req.app.locals.db.collection('sessions');

    const session = await sessions.findOne({
      _id: new ObjectId(sessionId),
      userId: req.user.id
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    // Store user message
    await sessions.updateOne(
      { _id: session._id },
      { $push: { messages: userMessage }, $set: { updatedAt: new Date() } }
    );

    // ===== Minimal Intent Detection =====
    if (!mode || mode === 'Default') {
      const input = message.toLowerCase();

      if (/generate|draw|create|image|picture|illustration/.test(input)) {
        mode = 'Generate Image';
      } else if (/analyze|summarize|check tone|extract/.test(input)) {
        mode = 'Analyze Files';
      } else if (/search|find|look up|what is|who is|how to/.test(input)) {
        mode = 'Web Search';
      } else {
        mode = 'Default';
      }
    }
    // ====================================

    let funmiResponse;

    // Call the correct handler based on mode
    switch (mode) {
      case 'Generate Image':
        funmiResponse = await handleImage(message);
        break;

      case 'Web Search':
        funmiResponse = await handleSearch(message);
        break;

      case 'Analyze Files':
        funmiResponse = await handleFile(req.file);
        break;

      default:
        funmiResponse = await handleChat(message); // Groq → HF → Dummy
    }

    const aiMessage = {
      role: 'funmi',
      content: funmiResponse,
      timestamp: new Date()
    };

    // Store AI response
    await sessions.updateOne(
      { _id: session._id },
      { $push: { messages: aiMessage }, $set: { updatedAt: new Date() } }
    );

    res.json({ userMessage, aiMessage });
  } catch (err) {
    console.error('Error in /message route:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Upload file (no auth for now)
 */
router.post('/upload', devUser, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const stream = req.app.locals.cloudinary.uploader.upload_stream(
      { resource_type: 'auto' },
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ url: result.secure_url });
      }
    );

    stream.end(req.file.buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get sessions
 */
router.get('/sessions', devUser, async (req, res) => {
  try {
    const sessions = await req.app.locals.db
      .collection('sessions')
      .find({ userId: req.user.id })
      .toArray();

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;