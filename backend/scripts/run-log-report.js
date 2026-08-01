// Manual trigger for the daily log analysis report.
// Usage (from backend/ directory):
//   LOG_REPORT_RECIPIENTS=you@example.com OLLAMA_BASE_URL=... OLLAMA_API_KEY=... node scripts/run-log-report.js

require('dotenv').config();
const { runDailyReport } = require('../src/jobs/dailyLogReport');

(async () => {
  try {
    console.log('🚀 Manually triggering daily log report...');
    await runDailyReport();
    console.log('✅ Manual report run complete.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Manual report run failed:', error.message);
    process.exit(1);
  }
})();
