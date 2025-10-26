// tests/api.e2e.test.js

const request = require('supertest');
const app = require('../app'); // Your Express app
const { pool } = require('../services/db'); // Import the real pool for shutdown
const fs = require('fs-extra');

// --- 1. MOCK THE DB SERVICE ---
// Tell Jest to find this module and replace it with a fake
jest.mock('../services/db', () => ({
  // Must mock all functions that are called by your app
  insertUsersBatch: jest.fn(),
  generateAgeReport: jest.fn(),
  // Mock the pool.end function so the 'afterAll' hook doesn't fail
  pool: {
    end: jest.fn(),
    query: jest.fn(), // Mock query as well for the afterAll truncate
  },
}));

// --- 2. IMPORT THE MOCKED FUNCTIONS ---
// This 'db' is now the FAKE one from above
const db = require('../services/db');

// (Your beforeAll logic for creating the test CSV remains the same)
// ...

describe('CSV Import E2E Test', () => {

  // --- 3. CONTROL THE MOCK BEHAVIOR ---
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Tell the fake insertUsersBatch to "work"
    // It will return a promise that resolves, just like the real one
    db.insertUsersBatch.mockResolvedValue();

    // Tell the fake pool.query (for TRUNCATE) to also "work"
    db.pool.query.mockResolvedValue();
  });

  afterAll(async () => {
    // This will now call the MOCKED pool.end() and pool.query()
    // so it won't try to connect to a real database.
    await db.pool.query('TRUNCATE TABLE public.users');
    await db.pool.end();
    // ... (rest of cleanup)
  });

  it('should process the CSV, insert data, and return 200 OK', async () => {
    // WHEN: The API is called
    const response = await request(app)
      .post('/api/v1/process-csv')
      .expect(200); // <-- This should now pass

    // THEN: Check that the MOCKED function was called
    expect(response.body.success).toBe(true);
    expect(db.insertUsersBatch).toHaveBeenCalled(); // Verify the DB layer was TOLD to insert
  });

  it('should return 500 if database insert fails', async () => {
    // --- 4. TEST THE FAILURE CASE ---
    // GIVEN: The database insert will fail
    const dbError = new Error('Fake DB Error');
    db.insertUsersBatch.mockRejectedValue(dbError);

    // WHEN: The API is called
    const response = await request(app)
      .post('/api/v1/process-csv')
      .expect(500); // <-- We expect a 500

    // THEN: Check for the correct error message
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Import failed');
  });
});