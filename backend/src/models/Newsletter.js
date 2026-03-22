const mongoose = require('mongoose');

// Define the interface for the Newsletter document
const NewsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      required: [true, 'email-required'],
    },
  },
  { timestamps: true }
);

// Define the Newsletter model
const Newsletter =
  mongoose.models.Newsletter || mongoose.model('Newsletter', NewsletterSchema);
module.exports = Newsletter;
