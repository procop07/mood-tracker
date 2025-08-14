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
}

module.exports = GoogleSheetsService;
