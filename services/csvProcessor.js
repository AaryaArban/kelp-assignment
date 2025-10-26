const fs = require('node:fs');
const readline = require('node:readline');
const path = require('node:path');

const config = require('../config');

// --- Helper 1: setNestedProperty ---
function setNestedProperty(obj, pathArray, value) {
  let current = obj;
  for (let i = 0; i < pathArray.length - 1; i++) {
    const key = pathArray[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }
  current[pathArray[pathArray.length - 1]] = value;
}

// --- Helper 2: buildNestedObject ---
function buildNestedObject(headers, values) {
  const jsonObject = {};
  for (let i = 0; i < headers.length; i++) {
    const pathArray = headers[i].split('.');

    const rawValue = values[i];
    const isNumeric = rawValue !== '' && !isNaN(Number(rawValue));

    const value = isNumeric ? Number(rawValue) : rawValue;

    setNestedProperty(jsonObject, pathArray, value);
  }
  return jsonObject;
}

// --- Main Service Function ---
async function processCSV(onData) {
  return new Promise(async (resolve, reject) => {
    const csvPath = path.resolve(config.csv.filePath);
    let headers = [];
    let isFirstLine = true;
    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    fileStream.on('error', (err) => {
      console.error('Error reading CSV file:', err);
      reject(err);
    });
    
    rl.on('error', (err) => {
      console.error('Error during readline processing:', err);
      reject(err);
    });

    try {
      for await (const line of rl) {
        if (isFirstLine) {
          headers = line.split(',');
          isFirstLine = false;
          continue; 
        }

        const data = line.split(',');

        if (data.length !== headers.length) {
          console.warn(`Skipping malformed line: ${line}`);
          continue;
        }

        const jsonObject = buildNestedObject(headers, data);
        
        // Await the onData callback to handle backpressure
        await onData(jsonObject); 
      }
      
      console.log('CSV file processing complete.');
      resolve(); // Resolve the promise when the loop is done
    } catch (err) {
      console.error('Error during CSV processing:', err);
      reject(err);
    }
  });
}

module.exports = { 
  processCSV, 
  setNestedProperty, 
  buildNestedObject
};