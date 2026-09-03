const User = require('../models/User');
const Orders = require('../models/Order');
const bcrypt = require('bcryptjs');
const otpGenerator = require('otp-generator');
const path = require('path');
const fs = require('fs');
const sendEmail = require('../utils/mailer');
const { emitToAdmins } = require('../utils/socketManager');
const { assertAcceptableEmail } = require('../utils/emailGuard');
const { getUser } = require('../config/getUser');

const getOneUser = async (req, res) => {
  try {
    const user = await getUser(req, res);
    if (!user) return;

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        cover: user.cover,
        role: user.role,
        isVerified: user.isVerified,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getUserByAdmin = async (req, res) => {
  try {
    const id = req.params.uid;

    const pageQuery = req.params.page;
    const limitQuery = req.params.limit;

    const limit = parseInt(limitQuery) || 10;
    const page = parseInt(pageQuery) || 1;

    // Calculate skip correctly
    const skip = limit * (page - 1);

    const currentUser = await User.findOne({ _id: id });

    const totalOrders = await Orders.countDocuments({ 'user._id': id });

    const orders = await Orders.find({ 'user._id': id }, null, {
      skip: skip * (page - 1),
      limit: skip,
    }).sort({ createdAt: -1 });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found',
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        user: currentUser,
        orders,
        count: Math.ceil(totalOrders / limit),
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const updateUser = async (req, res) => {
  const user = await getUser(req, res);
  if (!user) return;

  const uid = user._id.toString();

  try {
    const data = await req.body;
    // Check if email is being updated
    if (data.email) {
      const existingUser = await User.findOne({ email: data.email });

      // If another user has this email and it's not the current user
      if (existingUser && existingUser._id.toString() !== uid) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use by another account.',
        });
      }
    }

    // Whitelist only fields a user is allowed to update — prevents role escalation via mass assignment
    const ALLOWED_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'cover'];
    const safeData = {};
    for (const field of ALLOWED_FIELDS) {
      if (data[field] !== undefined) {
        safeData[field] = data[field];
      }
    }

    // 🛡️ SECURITY: email changes require re-verification. Without this,
    // a verified account could swap to a disposable address and keep
    // isVerified=true forever — a permanent bypass of the OTP gate and a
    // ban-evasion primitive. New address must pass the disposable guard,
    // then the account is marked unverified until the new OTP is confirmed.
    const normalizedOldEmail = (user.email || '').toLowerCase().trim();
    const normalizedNewEmail =
      typeof safeData.email === 'string' ? safeData.email.toLowerCase().trim() : safeData.email;

    if (normalizedNewEmail && normalizedNewEmail !== normalizedOldEmail) {
      try {
        await assertAcceptableEmail(normalizedNewEmail);
      } catch (guardError) {
        return res.status(400).json({ success: false, message: guardError.message });
      }

      const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        specialChars: false,
        lowerCaseAlphabets: false,
        digits: true,
      });

      safeData.isVerified = false;
      safeData.otp = otp;
      safeData.otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      safeData.otpAttempts = 0;
      safeData.lastOtpSentAt = new Date();
    }

    const profile = await User.findByIdAndUpdate(
      uid,
      safeData,
      {
        new: true,
        runValidators: true,
      }
    ).select('-password');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found',
      });
    }

    // If the email was changed, send a fresh verification email to the new
    // address so the re-verification flow mirrors registration.
    if (normalizedNewEmail && normalizedNewEmail !== normalizedOldEmail) {
      try {
        const jwt = require('jsonwebtoken');
        const verificationToken = jwt.sign(
          { email: normalizedNewEmail, purpose: 'email-verify' },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );
        const htmlFilePath = path.join(process.cwd(), 'src/email-templates', 'otp.html');
        let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
        const verificationLink = `${process.env.FRONTEND_URL || 'https://balportliquors.com'}/verify-email?token=${encodeURIComponent(verificationToken)}`;
        htmlContent = htmlContent.replace(/\{\{VERIFICATION_LINK\}\}/g, verificationLink);
        await sendEmail({
          to: normalizedNewEmail,
          subject: 'Verify your new Balport email address',
          html: htmlContent,
        });
      } catch (emailError) {
        console.error('❌ Email-change verification send failed:', emailError.message);
        emitToAdmins('system:email_failed', {
          email: normalizedNewEmail,
          flow: 'email-change',
          error: emailError.message,
          time: new Date().toISOString(),
        });
        // Don't fail the whole update — the user can use Resend OTP on the
        // login screen (resend-otp works for any unverified account).
      }
    }

    return res.status(200).json({
      success: true,
      data: profile,
      emailChanged: Boolean(normalizedNewEmail && normalizedNewEmail !== normalizedOldEmail),
      message: normalizedNewEmail && normalizedNewEmail !== normalizedOldEmail
        ? 'Email updated. Please check your new inbox to re-verify your account.'
        : 'Details updated successfully.',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const user = await getUser(req, res);
    if (!user) return;

    const { limit = 10, page = 1 } = req.query;

    const skip = parseInt(limit) * (parseInt(page) - 1) || 0;
    const totalOrderCount = await Orders.countDocuments();

    const orders = await Orders.find({ 'user.email': user.email }, null, {
      skip: skip,
      limit: parseInt(limit),
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: orders,
      count: Math.ceil(totalOrderCount / parseInt(limit)),
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const user = await getUser(req, res);
    if (!user) return;
    const uid = user._id.toString();
    const { password, newPassword, confirmPassword } = await req.body;

    // Find the user by ID
    const userWithPassword = await User.findById(uid).select('password');

    if (!userWithPassword) {
      return res
        .status(404)
        .json({ success: false, message: 'User Not Found' });
    }

    // Check if the old password matches the stored hashed password
    const passwordMatch = await bcrypt.compare(
      password,
      userWithPassword.password
    );

    if (passwordMatch) {
      // Check if the new password and confirm password match
      if (newPassword !== confirmPassword) {
        return res
          .status(400)
          .json({ success: false, message: 'New Password Mismatch' });
      }
      if (password === newPassword) {
        return res
          .status(400)
          .json({ success: false, message: 'Please enter a new password' });
      }
      // Hash the new password before updating
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update the password with the hashed version
      const updatedUser = await User.findByIdAndUpdate(
        uid,
        { password: hashedNewPassword },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, message: 'User Not Found' });
      }

      return res
        .status(201)
        .json({ success: true, message: 'Password changed Successfully' });
    } else {
      return res
        .status(400)
        .json({ success: false, message: 'Old password is incorrect' });
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getOneUser,
  updateUser,
  getInvoice,
  changePassword,
  getUserByAdmin,
};
