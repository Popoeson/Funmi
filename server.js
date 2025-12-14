// server.js
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

// Import routes
import routes from './routes.js';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
  db = mongoClient.db('funmi');
  app.locals.db = db; // pass db to routes
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection failed:', err.message);
});

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
app.locals.supabase = supabase;

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
app.locals.cloudinary = cloudinary;

// Mount routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => res.send('Funmi Backend Running'));

// Start server
app.listen(port, () => console.log(`Funmi backend running on port ${port}`));
