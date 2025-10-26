const { pool, insertUsersBatch } = require('./db');
const { processCSV } = require('./csvProcessor');

const BATCH_SIZE = 1000;

async function importCsvData() {
  console.log('Starting CSV import process...');

  let batch = [];

  const onDataCallback = async (jsonObject) => {
    batch.push(jsonObject);

    if (batch.length >= BATCH_SIZE) {
      console.log(`Inserting batch of ${batch.length} records...`);
      await insertUsersBatch(batch);
      batch = [];
    }
  };

  try {
    console.log('Clearing existing data (TRUNCATE)...');
    await pool.query('TRUNCATE TABLE public.users');

    await processCSV(onDataCallback);

    if (batch.length > 0) {
      console.log(`Inserting final batch of ${batch.length} records...`);
      await insertUsersBatch(batch);
      batch = [];
    }

    console.log('All data has been successfully imported.');
    return { success: true, message: 'Import complete.' };

  } catch (err) {
    console.error('A fatal error occurred during the import:', err);
    return { success: false, message: 'Import failed.', error: err.message };
  }
}

module.exports = { importCsvData };