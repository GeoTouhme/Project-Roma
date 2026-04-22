// controllers/userController.js
const User = require('../models/User');
const Products = require('../models/Product');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const sendEmail = require('../utils/mailer');

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
        UserCount,
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
    const user = await User.create({
      ...request,
      otp,
      role: Boolean(UserCount) ? request.role || 'user' : 'super admin',
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
      const verificationLink = `${request.origin || 'http://151.145.90.89'}/verify-otp?email=${encodeURIComponent(user.email)}&otp=${otp}`;
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

    res.status(201).json({
      success: true,
      message: 'Created User Successfully. Please check your email to verify your account.',
      token,
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
module.exports = {
  registerUser,
  loginUser,
  forgetPassword,
  resetPassword,
  verifyOtp,
  resendOtp,
};
