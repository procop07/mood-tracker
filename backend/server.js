const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Mood Tracker API is running!' });
});

app.get('/api/moods', (req, res) => {
  res.json({ message: 'Get all moods endpoint' });
});

app.post('/api/moods', (req, res) => {
  res.json({ message: 'Create new mood entry endpoint' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
