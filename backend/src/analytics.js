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

  calculateRiskScores(dataPoint, series) {
    try {
      // Get last 7 days of data including current data point
      const last7Days = series.slice(-7);
      
      // Calculate 7-day means
      const moodMean = last7Days.reduce((sum, entry) => sum + entry.mood, 0) / last7Days.length;
      const energyMean = last7Days.reduce((sum, entry) => sum + (entry.energy || 0), 0) / last7Days.length;
      const anxietyMean = last7Days.reduce((sum, entry) => sum + (entry.anxiety || 0), 0) / last7Days.length;
      const irritabilityMean = last7Days.reduce((sum, entry) => sum + (entry.irritability || 0), 0) / last7Days.length;
      
      // Calculate z-score of mood across entire history
      const allMoods = series.map(entry => entry.mood);
      const moodHistoryMean = allMoods.reduce((sum, mood) => sum + mood, 0) / allMoods.length;
      const moodVariance = allMoods.reduce((sum, mood) => sum + Math.pow(mood - moodHistoryMean, 2), 0) / allMoods.length;
      const moodStdDev = Math.sqrt(moodVariance);
      const moodZScore = moodStdDev > 0 ? (dataPoint.mood - moodHistoryMean) / moodStdDev : 0;
      
      // Calculate 7-day linear regression trend of mood
      const x = last7Days.map((_, index) => index);
      const y = last7Days.map(entry => entry.mood);
      const n = last7Days.length;
      
      const sumX = x.reduce((sum, val) => sum + val, 0);
      const sumY = y.reduce((sum, val) => sum + val, 0);
      const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
      const sumXX = x.reduce((sum, val) => sum + val * val, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      
      // Risk heuristics
      const hypomaniaRisk = (
        dataPoint.mood >= 4 && 
        slope > 0.1 && 
        (dataPoint.energy || 0) >= 4 && 
        (dataPoint.anxiety || 0) <= 3
      );
      
      const depressionRisk = (
        dataPoint.mood <= -3 && 
        slope < -0.1 && 
        (dataPoint.energy || 0) <= 2 && 
        ((dataPoint.anxiety || 0) >= 5 || (dataPoint.irritability || 0) >= 5)
      );
      
      return {
        sevenDayMeans: {
          mood: Math.round(moodMean * 100) / 100,
          energy: Math.round(energyMean * 100) / 100,
          anxiety: Math.round(anxietyMean * 100) / 100,
          irritability: Math.round(irritabilityMean * 100) / 100
        },
        moodZScore: Math.round(moodZScore * 100) / 100,
        moodTrend: Math.round(slope * 100) / 100,
        riskFlags: {
          hypomania: hypomaniaRisk,
          depression: depressionRisk
        }
      };
    } catch (error) {
      console.error('Error calculating risk scores:', error);
      throw error;
    }
  }

  async updateSummary(spreadsheetId, range, row) {
    try {
      // Update the specified range with the row data
      const result = await this.sheetsService.updateData(
        spreadsheetId,
        range,
        [row]
      );
      
      return {
        success: true,
        message: 'Summary updated successfully',
        data: result
      };
    } catch (error) {
      console.error('Error updating summary:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
