// routes.js
import express from 'express';
import multer from 'multer';
import { ObjectId } from 'mongodb';
import { handleChat, handleImage, handleSearch, handleFile } from './mode.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to verify Supabase token
async function verifySupabaseToken(req, res, next) {
  try {
    const token = req.body.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const { data, error } = await req.app.locals.supabase.auth.getUser(token);
    if (error) throw new Error(error.message);
    req.user = data.user;
    next();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

// Create / fetch session
router.post('/session', verifySupabaseToken, async (req, res) => {
  try {
    const { sessionName = 'New Chat' } = req.body;
    const sessions = req.app.locals.db.collection('sessions');
    let session = await sessions.findOne({ userId: req.user.id, name: sessionName });
    if (!session) {
      const resInsert = await sessions.insertOne({
        userId: req.user.id,
        name: sessionName,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      session = await sessions.findOne({ _id: resInsert.insertedId });
    }
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Send message
router.post('/message', verifySupabaseToken, async (req, res) => {
  try {
    const { sessionId, message, mode } = req.body;
    const sessions = req.app.locals.db.collection('sessions');
    const session = await sessions.findOne({ _id: new ObjectId(sessionId), userId: req.user.id });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const userMessage = { role: 'user', content: message, timestamp: new Date() };
    await sessions.updateOne(
      { _id: session._id },
      { $push: { messages: userMessage }, $set: { updatedAt: new Date() } }
    );

    let funmiResponse;
    switch(mode) {
      case 'Chat': funmiResponse = await handleChat(message); break;
      case 'Generate Image': funmiResponse = await handleImage(message); break;
      case 'Research':
      case 'Web Search': funmiResponse = await handleSearch(message, mode); break;
      case 'Analyze Files': funmiResponse = await handleFile(req.file); break;
      default: funmiResponse = `Funmi default response for: ${message}`;
    }

    const aiMessage = { role: 'funmi', content: funmiResponse, timestamp: new Date() };
    await sessions.updateOne(
      { _id: session._id },
      { $push: { messages: aiMessage }, $set: { updatedAt: new Date() } }
    );

    res.json({ userMessage, aiMessage });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload image/file
router.post('/upload', verifySupabaseToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const stream = req.app.locals.cloudinary.uploader.upload_stream(
      { resource_type: 'auto' },
      (err, result) => {
        if (err) throw err;
        res.json({ url: result.secure_url });
      }
    );
    stream.end(req.file.buffer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all sessions for user
router.get('/sessions', verifySupabaseToken, async (req, res) => {
  try {
    const sessions = await req.app.locals.db.collection('sessions').find({ userId: req.user.id }).toArray();
    res.json(sessions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
