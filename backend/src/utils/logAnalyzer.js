'use strict';
// Retired: the web application has no Docker authority or raw-log export path.
async function disabled() { throw new Error('Raw-log analysis is disabled'); }
module.exports = { fetchBackendLogs: disabled, analyzeLogsWithOllama: disabled };
