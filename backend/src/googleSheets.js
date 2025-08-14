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

  // Setup all required sheets with proper headers for mood tracking
  async setupMoodTrackingSheets(spreadsheetId) {
    try {
      const results = {
        sheetsCreated: [],
        headersCreated: [],
        errors: []
      };

      // Define sheet schemas
      const sheetSchemas = {
        'raw': ['timestamp', 'date', 'mood', 'energy', 'anxiety', 'irritability', 'notes'],
        'mood': ['timestamp', 'date', 'value'],
        'energy': ['timestamp', 'date', 'value'],
        'anxiety': ['timestamp', 'date', 'value'],
        'irritability': ['timestamp', 'date', 'value'],
        'notes': ['timestamp', 'date', 'value'],
        'summary': [
          'date', 'mood_mean7', 'energy_mean7', 'anxiety_mean7', 'irritability_mean7',
          'z_mood', 'trend_mood', 'risk_hypomania', 'risk_depression', 'reason'
        ]
      };

      // Setup each sheet with its headers
      for (const [sheetName, headers] of Object.entries(sheetSchemas)) {
        try {
          console.log(`Setting up sheet: ${sheetName}`);
          
          // Ensure sheet exists and headers are set
          const headerResult = await this.ensureHeaders(spreadsheetId, sheetName, headers);
          
          results.sheetsCreated.push(sheetName);
          if (headerResult.created) {
            results.headersCreated.push(sheetName);
          }
          
          console.log(`✓ Sheet '${sheetName}' setup complete`);
        } catch (error) {
          console.error(`Error setting up sheet '${sheetName}':`, error);
          results.errors.push({ sheet: sheetName, error: error.message });
        }
      }

      console.log('Mood tracking sheets setup completed:', results);
      return results;
    } catch (error) {
      console.error('Error in setupMoodTrackingSheets:', error);
      throw error;
    }
  }

  // Verify all required sheets exist with proper headers
  async verifyMoodTrackingSetup(spreadsheetId) {
    try {
      const requiredSheets = ['raw', 'mood', 'energy', 'anxiety', 'irritability', 'notes', 'summary'];
      const verification = {
        allSheetsExist: true,
        sheetsStatus: {},
        missingSheets: []
      };

      for (const sheetName of requiredSheets) {
        try {
          const headers = await this.readData(spreadsheetId, `${sheetName}!1:1`);
          verification.sheetsStatus[sheetName] = {
            exists: true,
            hasHeaders: headers && headers.length > 0 && headers[0].length > 0,
            headers: headers?.[0] || []
          };
        } catch (error) {
          verification.allSheetsExist = false;
          verification.missingSheets.push(sheetName);
          verification.sheetsStatus[sheetName] = {
            exists: false,
            hasHeaders: false,
            headers: [],
            error: error.message
          };
        }
      }

      return verification;
    } catch (error) {
      console.error('Error verifying mood tracking setup:', error);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
