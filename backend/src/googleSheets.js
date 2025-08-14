const { google } = require('googleapis');
require('dotenv').config();

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.init();
  }

  async init() {
    try {
      this.auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      console.error('Error initializing Google Sheets service:', error);
    }
  }

  async appendData(spreadsheetId, range, values) {
    try {
      const request = {
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: {
          values: [values]
        }
      };
      
      const response = await this.sheets.spreadsheets.values.append(request);
      return response.data;
    } catch (error) {
      console.error('Error appending data to sheet:', error);
      throw error;
    }
  }

  async readData(spreadsheetId, range) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });
      
      return response.data.values || [];
    } catch (error) {
      console.error('Error reading data from sheet:', error);
      throw error;
    }
  }

  // Update data in a specific range (useful for summary updates)
  async updateData(spreadsheetId, range, values) {
    try {
      const request = {
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: {
          values: [values]
        }
      };
      
      const response = await this.sheets.spreadsheets.values.update(request);
      return response.data;
    } catch (error) {
      console.error('Error updating data in sheet:', error);
      throw error;
    }
  }

  // Clear data in a specific range
  async clearData(spreadsheetId, range) {
    try {
      const response = await this.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range
      });
      
      return response.data;
    } catch (error) {
      console.error('Error clearing data from sheet:', error);
      throw error;
    }
  }

  // Ensure a sheet exists, create it if it doesn't
  async ensureSheetExists(spreadsheetId, sheetName) {
    try {
      // First, check if sheet exists by trying to read from it
      try {
        await this.readData(spreadsheetId, `${sheetName}!A1`);
        return true; // Sheet exists
      } catch (error) {
        // Sheet might not exist, try to create it
        if (error.code === 400 || error.message?.includes('Unable to parse range')) {
          // Create the sheet
          await this.createSheet(spreadsheetId, sheetName);
          return true;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error ensuring sheet exists:', error);
      throw error;
    }
  }

  // Create a new sheet in the spreadsheet
  async createSheet(spreadsheetId, sheetName) {
    try {
      const request = {
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      };
      
      const response = await this.sheets.spreadsheets.batchUpdate(request);
      return response.data;
    } catch (error) {
      console.error('Error creating sheet:', error);
      throw error;
    }
  }

  // Batch operations for better performance
  async batchUpdate(spreadsheetId, requests) {
    try {
      const request = {
        spreadsheetId,
        resource: {
          requests
        }
      };
      
      const response = await this.sheets.spreadsheets.batchUpdate(request);
      return response.data;
    } catch (error) {
      console.error('Error in batch update:', error);
      throw error;
    }
  }

  // Get spreadsheet metadata (useful for checking existing sheets)
  async getSpreadsheetInfo(spreadsheetId) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting spreadsheet info:', error);
      throw error;
    }
  }

  // Enhanced method to ensure headers exist with better error handling
  async ensureHeaders(spreadsheetId, sheetName, headers) {
    try {
      // First ensure the sheet exists
      await this.ensureSheetExists(spreadsheetId, sheetName);
      
      // Check if headers exist
      const headerRange = `${sheetName}!1:1`;
      const existingHeaders = await this.readData(spreadsheetId, headerRange);
      
      if (!existingHeaders || existingHeaders.length === 0 || existingHeaders[0].length === 0) {
        // Headers don't exist, create them
        await this.updateData(spreadsheetId, `${sheetName}!A1`, headers);
        return { created: true, headers };
      }
      
      return { created: false, headers: existingHeaders[0] };
    } catch (error) {
      console.error('Error ensuring headers:', error);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
