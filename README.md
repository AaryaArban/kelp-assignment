# Kelp Coding Challenge: CSV to JSON Importer

This is a Node.js (Express) application built for the Kelp coding challenge. Its purpose is to provide a high-performance API that parses a large CSV file, transforms the data (handling complex nested JSON), and imports it into a PostgreSQL database. Finally, it generates an age distribution report based on the imported data.

This solution is built to be production-quality, performant, and readable, focusing on streaming and batch processing to handle large datasets efficiently.

-----

## Features

  * **High-Performance Stream Processing**: Handles large CSVs (50,000+ records) by streaming the file line-by-line using Node.js streams. It does **not** load the entire file into memory, keeping memory usage minimal.
  * **Custom CSV-to-JSON Parser**: Uses **100% custom parsing logic** (no external CSV libraries) to convert dot-notation headers (e.g., `address.line1`) into deeply nested JSON objects.
  * **Efficient Batch Inserts**: Data is inserted into PostgreSQL in configurable batches (default size: 1000) using a single, parameterized `INSERT` query within a transaction for maximum performance.
  * **Dynamic Data Transformation**: Dynamically maps parsed JSON data to the `users` table:
      * `name.firstName` and `name.lastName` are combined into the `name` column.
      * `age` and `address` are mapped to their designated `int4` and `jsonb` columns.
      * All **other** fields (e.g., `gender`, `occupation`) are automatically collected and stored in the `jsonb` `additional_info` column.
  * **Age Distribution Report**: Automatically generates and prints a formatted age distribution report to the console after a successful import.
  * **Dockerized Environment**: Includes a `docker-compose.yml` for simple, one-command setup of the required development and test PostgreSQL databases.
  * **Fully Tested**: Includes unit tests for the complex parsing logic and E2E API tests to validate the entire import process.

-----

## How to Run the Application

Follow these steps to set up and run the project locally.

### Prerequisites

  * [Node.js](https://nodejs.org/) (v18 or later recommended)
  * [Docker](https://www.docker.com/products/docker-desktop/) and `docker-compose`
  * [Git](https://git-scm.com/)

### Step 1: Clone and Install

Clone the repository and install all required `npm` dependencies.

```bash
# Clone the repo
git clone https://github.com/AaryaArban/kelp-assignment
cd kelp-assignment

# Install dependencies
npm install
```

### Step 2: Configure Environment (`.env`)

Create a file named `.env` in the root of the project. This file will hold your local configuration.

Copy and paste the following content into your new `.env` file:

```.env
# Application Port
APP_PORT=3000

# Postgres DB (matches docker-compose.yml)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=mysecretpassword
DB_NAME=kelp_db

# Path to the CSV file to be processed
CSV_FILE_PATH=./data/source.csv
```

### Step 3: Start the Database

Run the following command to start the PostgreSQL database (`postgres-db` service) in a Docker container.

```bash
docker-compose up -d postgres-db
```

The database will be available at `localhost:5432`. The `db-init/init.sql` script will automatically run to create the `public.users` table.

### Step 4: Start the Application

Start the Node.js server in development mode (with auto-reloading via `nodemon`).

```bash
npm run start:dev
```

The console will show:

```
Server running on http://localhost:3000
To start, send a POST request to http://localhost:3000/api/v1/process-csv
```

### Step 5: Run the Import

The server is now running, but no data has been imported. To trigger the import, send a **POST** request to the API endpoint.

You can use a tool like Postman, Insomnia, or `curl` from your terminal:

```bash
curl -X POST http://localhost:3000/api/v1/process-csv
```

You will see logs in your application terminal as the server processes the file in batches. Upon completion, a JSON success message will be returned, and the **Age Distribution Report** will be printed to your console.

-----

## How to Run Tests

The project uses **Jest** for testing and a separate, dedicated test database.

### Step 1: Configure Test Environment (`.env.test`)

Create a file named `.env.test` in the root. This file is **only** used when running `npm test`.

Copy and paste the following content (note the different port and credentials):

```.env.test
# Test Postgres DB (matches docker-compose.yml)
DB_HOST=localhost
DB_PORT=5433
DB_USER=test_user
DB_PASSWORD=test_password
DB_NAME=test_db

# Path to the test CSV file
CSV_FILE_PATH=./data/test-source.csv
```

### Step 2: Start the Test Database

In your terminal, run the following command to start the *test database* container.

```bash
docker-compose up -d postgres-test-db
```

This starts a *second* database instance on `localhost:5433`, leaving your development DB untouched.

### Step 3: Run the Test Suite

Run the `test` script from `package.json`:

```bash
npm test
```

Jest will automatically use the `.env.test` file, connect to the test database, run all unit and E2E tests, and show you a pass/fail summary.

-----

## Implementation Details

### Project Structure

```
.
├── data/
│   ├── source.csv         # Main CSV file for import
│   └── test-source.csv    # Small CSV for testing
├── db-init/
│   └── init.sql           # SQL script to create the 'users' table
├── services/
│   ├── csvProcessor.js    # The custom CSV-to-JSON streaming parser
│   ├── dataImporter.js    # Orchestrates the import (truncate, parse, batch)
│   ├── db.js              # Handles all DB logic (connection, batch insert, report)
│   └── csvProcessor.test.js # Unit tests for the parser's nesting logic
├── tests/
│   ├── api.e2e.test.js    # E2E test for the /process-csv endpoint
├── .env.example           # Example environment file
├── .gitignore             # Ignores node_modules, .env files, etc.
├── app.js                 # Express server definition and API routes
├── config.js              # Loads environment variables from .env or .env.test
├── docker-compose.yml     # Defines the dev and test Postgres services
├── index.js               # Entry point, starts the server
└── package.json           # Project scripts and dependencies
└── package-lock.json      # Project scripts and dependencies

```

### Core Logic: The Import Process

The entire import process is designed for memory efficiency and speed.

1.  **API Trigger**: A `POST` request hits the `/api/v1/process-csv` endpoint in `app.js`.
2.  **Orchestration**: The handler calls `importCsvData()` from `services/dataImporter.js`.
3.  **Truncate**: `importCsvData` first runs a `TRUNCATE TABLE public.users` query to ensure a clean import every time.
4.  **Callback Setup**: It then calls `processCSV()` (from `services/csvProcessor.js`), passing an `async onDataCallback` function. This callback's job is to collect data into a `batch` array.
5.  **Streaming Parser**: `processCSV` opens a `fs.createReadStream` to the `CSV_FILE_PATH`. It uses `readline` to read the file line by line, one at a time.
      * The first line is read and stored as an array of `headers`.
      * For every subsequent data line, it calls `buildNestedObject`.
6.  **Custom JSON Nesting**: `buildNestedObject` iterates through the `headers` (e.g., `['name.firstName', 'age']`) and `values` (e.g., `['Rohit', '35']`) arrays.
      * It splits each header by the `.` separator.
      * It uses a helper, `setNestedProperty`, to recursively create the nested JSON object (e.g., `{ name: { firstName: "Rohit" }, age: 35 }`).
      * It also auto-detects and converts numeric values from strings to numbers.
7.  **Batching**: The fully formed JSON object is passed back to the `onDataCallback`.
      * The callback pushes the object into the `batch` array.
      * If `batch.length` reaches the `BATCH_SIZE` (1000), it `await`s a call to `insertUsersBatch()`, then clears the batch array.
8.  **Batch Insert**: `insertUsersBatch()` from `services/db.js` receives the array of 1000 JSON objects.
      * It first maps them using `transformForDb` to match the table schema (combining names, isolating `additional_info`, etc.).
      * It then constructs a **single** parameterized `INSERT` query with 1000 value sets (e.g., `VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ...`).
      * This entire query is run within a `BEGIN/COMMIT/ROLLBACK` transaction to ensure data integrity.
9.  **Final Batch**: After the file stream ends, `importCsvData` checks if any records are left in the `batch` array (e.g., the last 123 records) and inserts them in one final call.
10. **Report**: Once the import is successful, the `app.js` handler calls `generateAgeReport()`. This runs the final SQL `GROUP BY` query and prints the result using `console.table()`.

-----

## Assumptions Made
 
 Here is a list of assumptions made during the development of this solution:

  * **CSV Format**: The parser assumes a simple CSV format where values are separated by a single comma and do not contain escaped commas (e.g., `"a, b"`) or newlines within a field.
  * **Data Types**: The parser infers data types, specifically checking if a value is purely numeric (e.g., `age`) and storing it as a `Number`, otherwise storing it as a `String`.
  * **Age Ranges**: The age report groups `20 to 40` and `40 to 60` are interpreted as non-overlapping, inclusive ranges: **[20-39]** and **[40-59]**. This is explicitly defined in the SQL query comments in `services/db.js`.
  * **API Behavior**: The API endpoint `POST /api/v1/process-csv` is a trigger that processes a file from a pre-configured server path (defined in `.env`), not an endpoint that accepts a file upload.
  * **Import Process**: The data import is **destructive**. It is designed to `TRUNCATE` (clear) the `users` table before every import. This ensures a clean, idempotent process and an accurate report based only on the `source.csv` content.
