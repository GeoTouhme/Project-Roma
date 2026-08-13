const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

/**
 * Gmail API-based email sender using OAuth2.
 * Nodemailer's OAuth2 SMTP path was unreliable with playground-generated tokens;
 * the Gmail API works cleanly and keeps the same { to, subject, html } interface.
 */

const OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  'https://developers.google.com/oauthplayground';

async function getAuthorizedGmailClient() {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    OAUTH_REDIRECT_URI
  );

  const { tokens } = await oauth2Client.refreshToken(process.env.GOOGLE_REFRESH_TOKEN);
  if (!tokens || !tokens.access_token) {
    throw new Error('Google OAuth refresh did not return an access token');
  }
  oauth2Client.setCredentials(tokens);

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function buildRawEmail({ to, subject, html }) {
  const from = process.env.EMAIL;
  const message = [
    `From: "Balport Liquors" <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    html,
  ].join('\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const sendEmail = async (options) => {
  try {
    if (!process.env.EMAIL || !process.env.GOOGLE_CLIENT_ID ||
        !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      throw new Error('Missing required email/OAuth2 environment variables');
    }

    const gmail = await getAuthorizedGmailClient();
    const raw = buildRawEmail(options);

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    console.log(`✅ Email sent successfully to ${options.to}. MessageID: ${result.data.id}`);
    return { messageId: result.data.id };
  } catch (error) {
    console.error("❌ sendEmail Error:", error.message);
    if (error.response?.data) {
      console.error("❌ Gmail API error details:", JSON.stringify(error.response.data));
    }
    // Rethrow so callers can decide how to surface the failure and alert admins.
    throw error;
  }
};

module.exports = sendEmail;

