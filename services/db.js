const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  user: config.db.user,
  host: config.db.host,
  database: config.db.name,
  password: config.db.password,
  port: config.db.port,
});

function transformForDb(rawJson) {
  const name = `${rawJson.name.firstName} ${rawJson.name.lastName}`;
  const age = rawJson.age;

  const address = rawJson.address || null;

  const additional_info = { ...rawJson };
  delete additional_info.name;
  delete additional_info.age;
  delete additional_info.address;

  return {
    name: name,
    age: age,
    address: address,
    additional_info: additional_info,
  };
}

// 3. BATCH INSERT FUNCTION
/**
 * Inserts an array of parsed JSON objects into the database
 * in a single, high-performance transaction.
 * @param {Array<Object>} jsonBatch - An array of raw JSON objects from the parser.
 */
async function insertUsersBatch(jsonBatch) {
  if (!jsonBatch || jsonBatch.length === 0) {
    return;
  }

  const transformedBatch = jsonBatch.map(transformForDb);

  const placeholders = [];
  const flattenedValues = [];
  let paramIndex = 1;

  for (const user of transformedBatch) {
    placeholders.push(
      `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
    );

    flattenedValues.push(
      user.name,
      user.age,
      user.address,
      user.additional_info
    );
  }

  const queryText = `
    INSERT INTO public.users ("name", age, address, additional_info)
    VALUES ${placeholders.join(', ')}
  `;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(queryText, flattenedValues);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in batch insert, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function generateAgeReport() {
  console.log('\n--- Age Distribution Report ---');

  const queryText = `
    WITH UserAgeGroups AS (
      SELECT
        CASE
          WHEN age < 20 THEN '< 20'
          -- The ranges are [20-39] and [40-59] to be non-overlapping
          WHEN age >= 20 AND age <= 39 THEN '20 to 40'
          WHEN age >= 40 AND age <= 59 THEN '40 to 60'
          WHEN age >= 60 THEN '> 60'
          ELSE 'Unknown' -- Good practice to handle unexpected cases
        END AS age_group
      FROM public.users
    ),
    TotalUsers AS (
      SELECT COUNT(*) AS total_count FROM public.users
    )
    SELECT
      uag.age_group AS "Age-Group",
      -- Calculate percentage and cast to numeric for rounding
      ROUND((COUNT(uag.age_group) * 100.0) / tu.total_count, 2) AS "% Distribution"
    FROM UserAgeGroups uag, TotalUsers tu
    GROUP BY uag.age_group, tu.total_count
    ORDER BY MIN(
      CASE 
        WHEN uag.age_group = '< 20' THEN 1
        WHEN uag.age_group = '20 to 40' THEN 2
        WHEN uag.age_group = '40 to 60' THEN 3
        WHEN uag.age_group = '> 60' THEN 4
        ELSE 5
      END
    ); -- Order by the age group ranges correctly
  `;

  try {
    const { rows } = await pool.query(queryText);

    console.table(rows);

    const total = rows.reduce(
      (acc, row) => acc + parseFloat(row['% Distribution']),
      0
    );
    console.log(`Total: ${total.toFixed(2)}%`);
    console.log('--- End of Report ---\n');
  } catch (err) {
    console.error('Error generating age report:', err);
  }
}

module.exports = {
  pool,
  insertUsersBatch,
  generateAgeReport,
  transformForDb
};
