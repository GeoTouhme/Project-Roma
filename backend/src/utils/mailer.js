const nodemailer = require('nodemailer');

/**
 * Radical OAuth2 Email Implementation for Balport
 * This replaces the fragile App Passwords with a permanent OAuth2 Token.
 */
const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      },
    });

    const mailOptions = {
      from: `Balport Liquors <${process.env.EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${options.to}. MessageID: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error("❌ sendEmail Error:", error.message);
    // Rethrow so callers can decide how to surface the failure and alert admins.
    throw error;
  }
};

module.exports = sendEmail;
