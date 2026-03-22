const mongoose = require('mongoose');

const BrandSchema = new mongoose.Schema(
  {
    logo: {
      _id: {
        type: String,
        required: [true, 'image-id-required-error'],
      },
      url: {
        type: String,
        required: [true, 'image-url-required-error'],
      },
      blurDataURL: {
        type: String,
        required: [true, 'image-blur-data-url-required-error'],
      },
    },
    name: {
      type: String,
      required: [true, 'Name is required.'],
    },
    metaTitle: {
      type: String,
      required: [true, 'Meta title is required.'],
    },
    description: {
      type: String,
      required: [true, 'Description is required.'],
    },
    metaDescription: {
      type: String,
      required: [true, 'Meta description is required.'],
    },
    slug: {
      type: String,
      unique: true,
      required: [true, 'Slug is required.'],
    },
    status: {
      type: String,
      required: [true, 'Status is required.'],
    },
  },
  {
    timestamps: true,
  }
);

const Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);
module.exports = Brand;
