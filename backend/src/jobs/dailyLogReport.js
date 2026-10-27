'use strict';
// Operational collection belongs outside the web application. No raw logs are exported.
function startDailyLogReportJob() {}
async function runDailyReport() { return { disabled: true }; }
module.exports = { startDailyLogReportJob, runDailyReport };
