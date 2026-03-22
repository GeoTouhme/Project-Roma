const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
  {
    cover: {
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
      maxlength: [100, 'Name cannot exceed 100 characters.'],
    },
    metaTitle: {
      type: String,
      required: [true, 'Meta title is required.'],
      maxlength: [100, 'Meta title cannot exceed 100 characters.'],
    },
    description: {
      type: String,
      required: [true, 'Description is required.'],
      maxlength: [500, 'Description cannot exceed 500 characters.'],
    },
    metaDescription: {
      type: String,
      required: [true, 'Meta description is required.'],
      maxlength: [200, 'Meta description cannot exceed 200 characters.'],
    },
    slug: {
      type: String,
      unique: true,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    subCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory',
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Category =
  mongoose.models.Category || mongoose.model('Category', CategorySchema);
module.exports = Category;
