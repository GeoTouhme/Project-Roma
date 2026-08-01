const Docker = require('dockerode');
const util = require('util');
const axios = require('axios');
const moment = require('moment-timezone');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

/**
 * Fetch logs from the running backend container via the Docker socket.
 * Falls back to `docker compose logs` shell command if Docker socket is unavailable.
 */
async function fetchBackendLogs(hours = 24, maxBytes = 250000) {
  const sinceSeconds = hours * 60 * 60;
  const sinceIso = moment().tz(process.env.TZ || 'America/Los_Angeles').subtract(hours, 'hours').toISOString();

  try {
    // Try Docker socket first (works inside container if /var/run/docker.sock is mounted).
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const containers = await docker.listContainers({ filters: { name: ['balport-backend'] } });

    if (containers.length === 0) {
      throw new Error('balport-backend container not found via Docker socket');
    }

    const container = docker.getContainer(containers[0].Id);
    const logs = await container.logs({
      follow: false,
      stdout: true,
      stderr: true,
      timestamps: true,
      since: Math.floor(Date.now() / 1000) - sinceSeconds,
    });

    // Docker logs are returned as a Buffer with 8-byte headers; convert to string.
    const raw = logs.toString('utf8');
    const cleaned = raw
      .split('\n')
      .map((line) => line.replace(/^\x01\d{4}/, '').replace(/^\x02\d{4}/, ''))
      .join('\n');

    return cleaned.slice(-maxBytes) || '(No logs found for the requested period)';
  } catch (dockerError) {
    console.warn('⚠️ Docker socket fetch failed, falling back to shell command:', dockerError.message);

    // Fallback: run from host (development or host-cron scenarios).
    const { exec } = require('child_process');
    const execAsync = util.promisify(exec);
    const command = `docker compose logs --no-color --since=${sinceIso} backend 2>/dev/null | tail -c ${maxBytes}`;

    try {
      const { stdout } = await execAsync(command, {
        cwd: '/var/www/Project-Roma',
        timeout: 60000,
      });
      return stdout || '(No logs found for the requested period)';
    } catch (error) {
      console.error('❌ Failed to fetch backend logs:', error.message);
      return `(Log fetch failed: ${error.message})`;
    }
  }
}

/**
 * Send logs to an Ollama-compatible chat endpoint for analysis.
 */
async function analyzeLogsWithOllama(logs) {
  const base = OLLAMA_BASE_URL.replace(/\/$/, '');
  const endpoint = base.endsWith('/api') ? `${base}/chat` : `${base}/api/chat`;

  const systemPrompt = `You are a security/operations analyst for an e-commerce platform. Analyze the provided application logs and produce a concise markdown report with the following sections:

1. **Executive Summary** — 2-3 sentences on overall health.
2. **Security Events** — Failed logins, password reset attempts, requests without CF-Ray, webhook anomalies. Include counts and any IPs worth noting.
3. **Business Events** — Orders placed, accepted, denied, cancelled, refunds issued. Include counts.
4. **Errors & Warnings** — Notable errors, email failures, delivery issues, refunds that failed.
5. **Recommended Actions** — Specific, actionable next steps if any risks are detected.

Keep the report under 400 words. Use bullet points. Do not invent events; only report what is in the logs. If a section has nothing relevant, write "No notable events."`;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Here are the backend logs for the last 24 hours:\n\n\`\`\`\n${logs}\n\`\`\`\n\nPlease generate the markdown report.`,
    },
  ];

  const headers = {
    'Content-Type': 'application/json',
  };
  if (OLLAMA_API_KEY) {
    headers.Authorization = `Bearer ${OLLAMA_API_KEY}`;
  }

  try {
    const response = await axios.post(
      endpoint,
      {
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 2500,
        },
      },
      { headers, timeout: 120000 }
    );

    return response.data?.message?.content || response.data?.response || '(No analysis returned)';
  } catch (error) {
    const detail = error.response?.data?.error || error.message;
    console.error('❌ Ollama analysis failed:', detail);
    throw new Error(`Ollama analysis failed: ${detail}`);
  }
}

module.exports = {
  fetchBackendLogs,
  analyzeLogsWithOllama,
};
