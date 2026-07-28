// controllers/userController.js
const User = require('../models/User');
const Products = require('../models/Product');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sendEmail = require('../utils/mailer');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const TOKEN_COOKIE_NAME = 'token';

/**
 * 🛡️ SECURITY: Issue auth token as an HttpOnly, Secure, SameSite=Strict cookie.
 * Tokens are no longer returned in the response body or stored in localStorage.
 *
 * In production we set the cookie domain to the root domain (e.g. .balportliquors.com)
 * so the same cookie is sent to both the storefront and the admin subdomain.
 */
function getCookieDomain() {
  if (process.env.NODE_ENV !== 'production') return undefined;
  const frontendUrl = process.env.FRONTEND_URL || '';
  try {
    const hostname = new URL(frontendUrl).hostname;
    // Only set a shared domain if the hostname has at least two labels (e.g. example.com).
    // Do not set domain for localhost / IP addresses.
    if (hostname && !hostname.includes('localhost') && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return `.${parts.slice(-2).join('.')}`;
      }
    }
  } catch {
    // Ignore malformed FRONTEND_URL and fall back to no explicit domain.
  }
  return undefined;
}

function setAuthCookie(res, token, maxAgeMs) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: maxAgeMs,
    path: '/',
  };
  const domain = getCookieDomain();
  if (domain) {
    cookieOptions.domain = domain;
  }
  res.cookie(TOKEN_COOKIE_NAME, token, cookieOptions);
}

function clearAuthCookie(res) {
  const cookieOptions = { path: '/' };
  const domain = getCookieDomain();
  if (domain) {
    cookieOptions.domain = domain;
  }
  res.clearCookie(TOKEN_COOKIE_NAME, cookieOptions);
}

// 🛡️ MFA: deterministic 32-byte AES key derived from a dedicated env secret.
// Using a dedicated MFA_SECRET_KEY lets JWT rotation happen without invalidating MFA enrollments.
const MFA_KEY = crypto.scryptSync(
  process.env.MFA_SECRET_KEY || process.env.JWT_SECRET || 'project-roma-mfa-fallback-key',
  'project-roma-mfa',
  32
);
const MFA_ALGORITHM = 'aes-256-gcm';

function encryptMfaSecret(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(MFA_ALGORITHM, MFA_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptMfaSecret(encryptedBase64) {
  if (!encryptedBase64) return null;
  const buffer = Buffer.from(encryptedBase64, 'base64');
  const iv = buffer.subarray(0, 16);
  const authTag = buffer.subarray(16, 32);
  const encrypted = buffer.subarray(32);
  const decipher = crypto.createDecipheriv(MFA_ALGORITHM, MFA_KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

function signMfaTempToken(userId) {
  return jwt.sign(
    { _id: userId.toString(), mfa: true },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
}

function verifyMfaTempToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || decoded.mfa !== true) return null;
    return decoded;
  } catch {
    return null;
  }
}

const registerUser = async (req, res) => {
  try {
    // Create user in the database
    const request = req.body; // No need to use await here

    if (!request.email || typeof request.email !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    const safeEmail = request.email.toLowerCase().trim();

    const UserCount = await User.countDocuments();
    const existingUser = await User.findOne({ email: safeEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User With This Email Already Exists',
      });
    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false,
      digits: true,
    });
    // Create user with the generated OTP
    // SECURITY: Whitelist only allowed fields — prevents role escalation and field injection
    const user = await User.create({
      firstName: request.firstName,
      lastName: request.lastName,
      email: safeEmail,
      password: request.password,
      phone: request.phone,
      otp,
      role: UserCount > 0 ? 'user' : 'super admin',
      isVerified: false,
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        _id: user._id,
        // email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '47d',
      }
    );

    try {
      // Path to the HTML file
      const htmlFilePath = path.join(
        process.cwd(),
        'src/email-templates',
        'otp.html'
      );

      // Read HTML file content
      let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

      // Replace the placeholder with the OTP and user email
      htmlContent = htmlContent.replace(/<h1>[\s\d]*<\/h1>/g, `<h1 style="color: #B5223B; font-size: 32px; letter-spacing: 5px;">${otp}</h1>`);
      htmlContent = htmlContent.replace(/usingyourmail@gmail\.com/g, user.email);
      
      // Add verification link
      const verificationLink = `${process.env.FRONTEND_URL || 'https://balportliquors.com'}/verify-otp?email=${encodeURIComponent(user.email)}&otp=${otp}`;
      htmlContent = htmlContent.replace(/<\/tbody>/, `
        <tr>
          <td align="center" style="padding-top: 20px;">
            <a href="${verificationLink}" style="background-color: #B5223B; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Confirm My Account</a>
            <p style="font-size: 11px; color: #999; margin-top: 10px;">Or click the link: <br> ${verificationLink}</p>
          </td>
        </tr>
        </tbody>
      `);

      // Send email via OAuth2 utility
      await sendEmail({
        to: user.email,
        subject: 'Welcome to Balport! Verify your email',
        html: htmlContent
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
    }

    setAuthCookie(res, token, 47 * 24 * 60 * 60 * 1000);

    res.status(201).json({
      success: true,
      message: 'Created User Successfully. Please check your email to verify your account.',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
      status: 500,
    });
  }
};
const loginUser = async (req, res) => {
  try {
    const { email, password } = await req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    const safeEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: safeEmail }).select(
      '+password'
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User Not Found' });
    }

    if (!user.password) {
      return res
        .status(404)
        .json({ success: false, message: 'User Password Not Found' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res
        .status(400)
        .json({ success: false, message: 'Incorrect Password' });
    }

    // 🛡️ MFA: if TOTP is enabled, require a second factor before issuing the auth cookie.
    if (user.mfaEnabled) {
      const tempToken = signMfaTempToken(user._id);
      return res.status(200).json({
        success: true,
        message: 'MFA code required',
        mfaRequired: true,
        tempToken,
      });
    }

    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
      }
    );

    const products = await Products.aggregate([
      {
        $match: {
          _id: { $in: user.wishlist },
          status: { $nin: ['disabled', 'inactive'] },
          available: { $gt: 0 },
        },
      },
      {
        $lookup: {
          from: 'reviews',
          localField: 'reviews',
          foreignField: '_id',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          averageRating: { $avg: '$reviews.rating' },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          slug: 1,
          colors: 1,
          discount: 1,
          available: 1,
          likes: 1,
          priceSale: 1,
          price: 1,
          averageRating: 1,
          createdAt: 1,
        },
      },
    ]);

    setAuthCookie(res, token, 7 * 24 * 60 * 60 * 1000);

    return res.status(201).json({
      success: true,
      message: 'Login Successfully',
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        cover: user.cover,
        phone: user.phone,
        role: user.role,
        wishlist: products,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

const forgetPassword = async (req, res) => {
  try {
    const request = await req.body;

    // Validate email is a plain string — prevents NoSQL injection via {$gt: ''}
    if (!request.email || typeof request.email !== 'string') {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }

    const user = await User.findOne({ email: request.email.toLowerCase().trim() });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User Not Found ' });
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    // Constructing the link with the token
    const resetPasswordLink = `${request.origin}/auth/reset-password/${token}`;

    // Path to the HTML file
    const htmlFilePath = path.join(
      process.cwd(),
      'src/email-templates',
      'forget.html'
    );

    // Read HTML file content
    let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

    // Replace the href attribute of the <a> tag with the reset password link
    // htmlContent = htmlContent.replace(
    //   /href="javascript:void\(0\);"/g,
    //   `href="${resetPasswordLink}"`
    // )
    htmlContent = htmlContent.replace(
      /href="javascript:void\(0\);"/g,
      `href="${resetPasswordLink}"`
    );

    // Send email via OAuth2 utility
    await sendEmail({
      to: user.email,
      subject: 'Reset your Balport Password',
      html: htmlContent
    });

    return res.status(200).json({
      success: true,
      message: 'A password reset link has been sent to your email address.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = await req.body;

    // Verify the token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Or Expired Token. Please Request A New One.',
      });
    }

    // Find the user by ID from the token
    const user = await User.findById(decoded._id).select('password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found ',
      });
    }
    if (!newPassword || !user.password) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid Data. Both NewPassword And User Password Are Required.',
      });
    }

    // Check if the new password is the same as the old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New Password Must Be Different From The Old Password.',
      });
    }
    // Update the user's password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
    });

    return res.status(200).json({
      success: true,
      message: 'Password Updated Successfully.',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = await req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    const safeEmail = email.toLowerCase().trim();

    // Find the user with the provided email
    const user = await User.findOne({ email: safeEmail }).maxTimeMS(30000).exec();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User Not Found' });
    }

    // Check if the OTP is already verified
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'OTP Has Already Been Verified',
      });
    }

    // Verify the OTP using an if-else statement
    let message = '';
    if (otp === user.otp) {
      // Update the user's status to verified
      user.isVerified = true;
      await user.save();
      message = 'OTP Verified Successfully';
      return res.status(201).json({ success: true, message });
    } else {
      message = 'Invalid OTP';
      return res.status(404).json({ success: false, message });
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = await req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    const safeEmail = email.toLowerCase().trim();

    // Find the user with the provided email
    const user = await User.findOne({ email: safeEmail }).maxTimeMS(30000).exec();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User Not Found' });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'OTP Has Already Been Verified',
      });
    }
    // Generate new OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false,
      digits: true,
    });
    // Update the user's OTP
    await User.findByIdAndUpdate(user._id, {
      otp: otp.toString(),
    });

    // Path to the HTML file
    const htmlFilePath = path.join(
      process.cwd(),
      'src/email-templates',
      'otp.html'
    );

    // Read HTML file content
    let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

    // Replace the placeholder with the OTP and user email
    htmlContent = htmlContent.replace(/<h1>[\s\d]*<\/h1>/g, `<h1>${otp}</h1>`);
    htmlContent = htmlContent.replace(/usingyourmail@gmail\.com/g, user.email);

    // Send email via OAuth2 utility
    await sendEmail({
      to: user.email,
      subject: 'Verify your email - New Code',
      html: htmlContent
    });

    // Return the response
    return res.status(200).json({
      success: true,
      message: 'OTP Resent Successfully',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const logoutUser = async (req, res) => {
  try {
    clearAuthCookie(res);
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 🛡️ MFA — generate a TOTP secret and QR code for enrollment.
const setupMfa = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User Not Found' });
    }

    const secret = speakeasy.generateSecret({
      name: `Balport Liquors (${user.email})`,
      length: 32,
    });

    const encryptedTemp = encryptMfaSecret(secret.base32);
    user.mfaTempSecret = encryptedTemp;
    await user.save();

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return res.status(200).json({
      success: true,
      qrCode,
      manualEntryKey: secret.base32,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 🛡️ MFA — confirm enrollment by verifying the first TOTP code.
const confirmMfaSetup = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'MFA code is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User Not Found' });
    }
    if (!user.mfaTempSecret) {
      return res.status(400).json({ success: false, message: 'MFA setup has not been started' });
    }

    const tempSecret = decryptMfaSecret(user.mfaTempSecret);
    if (!tempSecret) {
      return res.status(500).json({ success: false, message: 'Failed to decrypt MFA secret' });
    }

    const verified = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid MFA code' });
    }

    user.mfaSecret = user.mfaTempSecret;
    user.mfaTempSecret = null;
    user.mfaEnabled = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'MFA enabled successfully',
      mfaEnabled: true,
    });
  } catch (error) {
    console.error('MFA confirm error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 🛡️ MFA — verify TOTP code after password login and issue the final auth cookie.
const verifyMfa = async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || typeof tempToken !== 'string') {
      return res.status(400).json({ success: false, message: 'MFA token is required' });
    }
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'MFA code is required' });
    }

    const decoded = verifyMfaTempToken(tempToken);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid or expired MFA session' });
    }

    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User Not Found' });
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({ success: false, message: 'MFA is not enabled for this account' });
    }

    const mfaSecret = decryptMfaSecret(user.mfaSecret);
    if (!mfaSecret) {
      return res.status(500).json({ success: false, message: 'Failed to decrypt MFA secret' });
    }

    const verified = speakeasy.totp.verify({
      secret: mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid MFA code' });
    }

    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const products = await Products.aggregate([
      {
        $match: {
          _id: { $in: user.wishlist },
          status: { $nin: ['disabled', 'inactive'] },
          available: { $gt: 0 },
        },
      },
      {
        $lookup: {
          from: 'reviews',
          localField: 'reviews',
          foreignField: '_id',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          averageRating: { $avg: '$reviews.rating' },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          slug: 1,
          colors: 1,
          discount: 1,
          available: 1,
          likes: 1,
          priceSale: 1,
          price: 1,
          averageRating: 1,
          createdAt: 1,
        },
      },
    ]);

    setAuthCookie(res, token, 7 * 24 * 60 * 60 * 1000);

    return res.status(200).json({
      success: true,
      message: 'Login Successfully',
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        cover: user.cover,
        phone: user.phone,
        role: user.role,
        wishlist: products,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    console.error('MFA verify error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 🛡️ MFA — disable MFA for the authenticated user after verifying a current code.
const disableMfa = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'MFA code is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User Not Found' });
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({ success: false, message: 'MFA is not enabled for this account' });
    }

    const mfaSecret = decryptMfaSecret(user.mfaSecret);
    if (!mfaSecret) {
      return res.status(500).json({ success: false, message: 'Failed to decrypt MFA secret' });
    }

    const verified = speakeasy.totp.verify({
      secret: mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid MFA code' });
    }

    user.mfaEnabled = false;
    user.mfaSecret = null;
    user.mfaTempSecret = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'MFA disabled successfully',
      mfaEnabled: false,
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  forgetPassword,
  resetPassword,
  verifyOtp,
  resendOtp,
  setupMfa,
  confirmMfaSetup,
  verifyMfa,
  disableMfa,
};
