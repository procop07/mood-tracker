const Joi = require('joi');
const GoogleSheetsService = require('./googleSheets');

class AnalyticsService {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  }

  validateMoodData(data) {
    const schema = Joi.object({
      date: Joi.date().required(),
      mood: Joi.number().min(1).max(10).required(),
      notes: Joi.string().optional().allow(''),
      activities: Joi.array().items(Joi.string()).optional(),
      sleep_hours: Joi.number().min(0).max(24).optional(),
      stress_level: Joi.number().min(1).max(10).optional()
    });

    return schema.validate(data);
  }

  async logMoodEntry(moodData) {
    try {
      // Validate the mood data
      const { error, value } = this.validateMoodData(moodData);
      if (error) {
        throw new Error(`Validation error: ${error.details[0].message}`);
      }

      // Prepare data for Google Sheets
      const rowData = [
        value.date.toISOString().split('T')[0], // Date in YYYY-MM-DD format
        value.mood,
        value.notes || '',
        value.activities ? value.activities.join(', ') : '',
        value.sleep_hours || '',
        value.stress_level || ''
      ];

      // Append to Google Sheets
      const result = await this.sheetsService.appendData(
        this.spreadsheetId,
        'MoodData!A:F', // Assuming sheet named 'MoodData' with columns A-F
        rowData
      );

      return {
        success: true,
        message: 'Mood entry logged successfully',
        data: result
      };
    } catch (error) {
      console.error('Error logging mood entry:', error);
      throw error;
    }
  }

  async getMoodHistory(startDate, endDate) {
    try {
      const data = await this.sheetsService.readData(
        this.spreadsheetId,
        'MoodData!A:F'
      );

      // Filter data by date range if provided
      if (startDate || endDate) {
        const filteredData = data.filter((row, index) => {
          if (index === 0) return true; // Keep header row
          const rowDate = new Date(row[0]);
          if (startDate && rowDate < new Date(startDate)) return false;
          if (endDate && rowDate > new Date(endDate)) return false;
          return true;
        });
        return filteredData;
      }

      return data;
    } catch (error) {
      console.error('Error retrieving mood history:', error);
      throw error;
    }
  }

  calculateMoodStats(moodData) {
    if (!moodData || moodData.length <= 1) {
      return {
        average: 0,
        highest: 0,
        lowest: 0,
        totalEntries: 0
      };
    }

    // Skip header row
    const dataRows = moodData.slice(1);
    const moods = dataRows.map(row => parseFloat(row[1])).filter(mood => !isNaN(mood));

    if (moods.length === 0) {
      return {
        average: 0,
        highest: 0,
        lowest: 0,
        totalEntries: 0
      };
    }

    const average = moods.reduce((sum, mood) => sum + mood, 0) / moods.length;
    const highest = Math.max(...moods);
    const lowest = Math.min(...moods);

    return {
      average: Math.round(average * 100) / 100, // Round to 2 decimal places
      highest,
      lowest,
      totalEntries: moods.length
    };
  }
}

module.exports = AnalyticsService;
