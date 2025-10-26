const express = require('express');
const { importCsvData } = require('./services/dataImporter');
const { generateAgeReport } = require('./services/db');

const app = express();
app.use(express.json());

app.post('/api/v1/process-csv', async (req, res) => {
  console.log('Received request to process CSV...');
  
  try {
    const importResult = await importCsvData();

    // This is the improved code
    if (!importResult.success) {
    console.error('CSV import failed:', importResult.message);
    return res.status(500).json({ 
        success: false, 
        message: importResult.message,
        error: importResult.error 
    });
    }

    console.log('Import successful. Generating age distribution report...');
    await generateAgeReport();

    return res.status(200).json({
      success: true,
      message: 'CSV processed and age report generated in console.'
    });

  } catch (error) {
    console.error('Fatal error in /process-csv endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected server error occurred.',
      error: error.message
    });
  }
});

module.exports = app;