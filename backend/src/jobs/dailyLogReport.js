const cron = require('node-cron');
const moment = require('moment-timezone');
const { fetchBackendLogs, analyzeLogsWithOllama } = require('../utils/logAnalyzer');
const sendEmail = require('../utils/mailer');

const TIMEZONE = process.env.TZ || 'America/Los_Angeles';
const REPORT_RECIPIENTS = (process.env.LOG_REPORT_RECIPIENTS || '')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);

function buildEmailHtml(reportMarkdown, reportDate) {
  const escapedReport = reportMarkdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2>Balport Liquors — Daily Operations Report</h2>
        <p><strong>Date:</strong> ${reportDate}</p>
        <hr/>
        <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${escapedReport}</pre>
        <hr/>
        <p style="font-size: 12px; color: #666;">
          This report was generated automatically by the Project Roma backend.
        </p>
      </body>
    </html>
  `;
}

async function runDailyReport() {
  if (!REPORT_RECIPIENTS.length) {
    console.warn('⚠️ Daily log report skipped: no LOG_REPORT_RECIPIENTS configured.');
    return;
  }

  const yesterday = moment().tz(TIMEZONE).subtract(1, 'day').format('YYYY-MM-DD');
  console.log(`📊 Starting daily log analysis for ${yesterday}...`);

  try {
    const logs = await fetchBackendLogs(24);
    const analysis = await analyzeLogsWithOllama(logs);
    const html = buildEmailHtml(analysis, yesterday);

    await sendEmail({
      to: REPORT_RECIPIENTS,
      subject: `Balport Daily Report — ${yesterday}`,
      html,
    });

    console.log(`✅ Daily log report sent to ${REPORT_RECIPIENTS.join(', ')}`);
  } catch (error) {
    console.error('❌ Daily log report failed:', error.message);
  }
}

function startDailyLogReportJob() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('ℹ️ Daily log report job disabled outside production.');
    return;
  }

  if (!REPORT_RECIPIENTS.length) {
    console.warn('⚠️ Daily log report job started but no recipients configured.');
  }

  // Run every day at 00:00 in the configured timezone.
  cron.schedule(
    '0 0 * * *',
    () => {
      runDailyReport();
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  console.log(`📅 Daily log report scheduled for 00:00 ${TIMEZONE}`);
}

module.exports = { startDailyLogReportJob, runDailyReport };
