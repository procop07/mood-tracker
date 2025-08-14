const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Joi = require('joi');
const AnalyticsService = require('./analytics');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const analyticsService = new AnalyticsService();

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check endpoint for testing
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Mood Tracker API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes

// POST /api/mood - Log a new mood entry
app.post('/api/mood', async (req, res) => {
  try {
    const moodData = {
      date: new Date(req.body.date || Date.now()),
      mood: req.body.mood,
      notes: req.body.notes || '',
      activities: req.body.activities || [],
      sleep_hours: req.body.sleep_hours,
      stress_level: req.body.stress_level
    };

    const result = await analyticsService.logMoodEntry(moodData);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error logging mood entry:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to log mood entry'
    });
  }
});

// GET /api/mood - Get mood history
app.get('/api/mood', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const moodHistory = await analyticsService.getMoodHistory(start_date, end_date);
    
    res.status(200).json({
      success: true,
      data: moodHistory
    });
  } catch (error) {
    console.error('Error retrieving mood history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve mood history'
    });
  }
});

// GET /api/mood/stats - Get mood statistics
app.get('/api/mood/stats', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const moodHistory = await analyticsService.getMoodHistory(start_date, end_date);
    const stats = analyticsService.calculateMoodStats(moodHistory);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error calculating mood stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate mood statistics'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Mood Tracker API server is running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});

module.exports = app;
