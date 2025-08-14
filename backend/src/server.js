const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Joi = require('joi');
const AnalyticsService = require('./analytics');
const GoogleSheetsService = require('./googleSheets');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const analyticsService = new AnalyticsService();
const sheetsService = new GoogleSheetsService();

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

// POST /api/submit - Submit mood data with validation, Google Sheets write, and analytics recomputation
app.post('/api/submit', async (req, res) => {
  try {
    // Validation schema for submit endpoint
    const submitSchema = Joi.object({
      date: Joi.date().optional().default(() => new Date()),
      mood: Joi.number().min(1).max(10).required(),
      notes: Joi.string().optional().allow('').max(500),
      activities: Joi.array().items(Joi.string().max(100)).optional().default([]),
      sleep_hours: Joi.number().min(0).max(24).optional(),
      stress_level: Joi.number().min(1).max(10).optional(),
      sheet_name: Joi.string().optional().default('MoodData')
    });

    // Validate request data
    const { error, value } = submitSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: `Validation error: ${error.details[0].message}`,
        errors: error.details
      });
    }

    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const sheetName = value.sheet_name;
    
    // Ensure sheet headers exist
    try {
      const headerRange = `${sheetName}!1:1`;
      const existingHeaders = await sheetsService.readData(spreadsheetId, headerRange);
      
      if (!existingHeaders || existingHeaders.length === 0 || existingHeaders[0].length === 0) {
        // Create headers if sheet is empty
        const headers = ['Date', 'Mood', 'Notes', 'Activities', 'Sleep Hours', 'Stress Level'];
        await sheetsService.appendData(spreadsheetId, `${sheetName}!A1:F1`, headers);
      }
    } catch (headerError) {
      console.error('Error checking/creating headers:', headerError);
      // Continue with data insertion even if header creation fails
    }

    // Prepare data for specific sheet
    const sheetRowData = [
      value.date.toISOString().split('T')[0], // Date in YYYY-MM-DD format
      value.mood,
      value.notes || '',
      value.activities ? value.activities.join(', ') : '',
      value.sleep_hours || '',
      value.stress_level || ''
    ];

    // Write to specific sheet (per-sheet)
    const sheetResult = await sheetsService.appendData(
      spreadsheetId,
      `${sheetName}!A:F`,
      sheetRowData
    );

    // Write to raw data sheet for backup/analytics
    const rawSheetName = 'RawData';
    try {
      // Ensure raw data sheet headers exist
      const rawHeaderRange = `${rawSheetName}!1:1`;
      const existingRawHeaders = await sheetsService.readData(spreadsheetId, rawHeaderRange);
      
      if (!existingRawHeaders || existingRawHeaders.length === 0 || existingRawHeaders[0].length === 0) {
        const rawHeaders = ['Timestamp', 'Date', 'Mood', 'Notes', 'Activities', 'Sleep Hours', 'Stress Level', 'Source Sheet'];
        await sheetsService.appendData(spreadsheetId, `${rawSheetName}!A1:H1`, rawHeaders);
      }

      // Prepare raw data with additional metadata
      const rawRowData = [
        new Date().toISOString(), // Full timestamp
        value.date.toISOString().split('T')[0], // Date
        value.mood,
        value.notes || '',
        value.activities ? value.activities.join(', ') : '',
        value.sleep_hours || '',
        value.stress_level || '',
        sheetName // Source sheet name
      ];

      // Write to raw data sheet
      await sheetsService.appendData(
        spreadsheetId,
        `${rawSheetName}!A:H`,
        rawRowData
      );
    } catch (rawError) {
      console.error('Error writing to raw data sheet:', rawError);
      // Don't fail the entire request if raw data write fails
    }

    // Recompute summary using analytics.js
    let summaryStats = null;
    try {
      // Get updated mood history for analytics
      const moodHistory = await analyticsService.getMoodHistory();
      summaryStats = analyticsService.calculateMoodStats(moodHistory);
      
      // Write summary to a Summary sheet
      try {
        const summarySheetName = 'Summary';
        const summaryHeaderRange = `${summarySheetName}!1:1`;
        const existingSummaryHeaders = await sheetsService.readData(spreadsheetId, summaryHeaderRange);
        
        if (!existingSummaryHeaders || existingSummaryHeaders.length === 0 || existingSummaryHeaders[0].length === 0) {
          const summaryHeaders = ['Last Updated', 'Total Entries', 'Average Mood', 'Highest Mood', 'Lowest Mood'];
          await sheetsService.appendData(spreadsheetId, `${summarySheetName}!A1:E1`, summaryHeaders);
        }

        // Clear existing summary data and write new summary
        const summaryRowData = [
          new Date().toISOString(),
          summaryStats.totalEntries,
          summaryStats.average,
          summaryStats.highest,
          summaryStats.lowest
        ];
        
        // For summary, we want to replace rather than append
        // First clear row 2, then add new data
        await sheetsService.appendData(
          spreadsheetId,
          `${summarySheetName}!A2:E2`,
          summaryRowData
        );
      } catch (summaryError) {
        console.error('Error updating summary sheet:', summaryError);
      }
    } catch (analyticsError) {
      console.error('Error recomputing analytics:', analyticsError);
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Mood data submitted successfully',
      data: {
        submittedData: value,
        sheetResult: sheetResult,
        summaryStats: summaryStats
      }
    });

  } catch (error) {
    console.error('Error in /api/submit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit mood data',
      error: error.message
    });
  }
});

// POST /api/mood - Log a new mood entry (legacy endpoint)
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
