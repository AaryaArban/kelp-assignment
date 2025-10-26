const app = require('./app');
const config = require('./config');

const PORT = config.app?.port || 3000;

app.listen(PORT, () => { 
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`To start, send a POST request to http://localhost:${PORT}/api/v1/process-csv`);
});