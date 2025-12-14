// server.js
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Import routes
const routes = require('./routes');

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

app.listen(port, () => console.log(`Funmi backend running on port ${port}`));