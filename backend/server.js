const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory for vanilla version
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ message: 'Mood Tracker API is running!', status: 'healthy' });
});

app.get('/api/moods', (req, res) => {
  // This would typically fetch from database
  res.json({ 
    message: 'Get all moods endpoint',
    moods: []
  });
});

app.post('/api/moods', (req, res) => {
  const { mood, notes, date, time } = req.body;
  
  // Validate input
  if (!mood) {
    return res.status(400).json({ error: 'Mood is required' });
  }

  // This would typically save to database
  const moodEntry = {
    id: Date.now(),
    mood,
    notes,
    date: date || new Date().toLocaleDateString(),
    time: time || new Date().toLocaleTimeString(),
    timestamp: new Date().toISOString()
  };

  res.status(201).json({ 
    message: 'Mood entry created successfully',
    mood: moodEntry
  });
});

// Serve the main HTML page for vanilla version
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mood Tracker Server running on port ${PORT}`);
  console.log(`📱 Vanilla version: http://localhost:${PORT}`);
  console.log(`🔗 API health check: http://localhost:${PORT}/api/health`);
});
