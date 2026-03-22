const mongoose = require('mongoose');

/* Define the interface for the SubCategory document */
const SubCategorySchema = new mongoose.Schema(
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
      required: [true, 'Meta Title is required.'],
      maxlength: [100, 'Meta Title cannot exceed 100 characters.'],
    },
    description: {
      type: String,
      required: [true, 'Description is required.'],
      maxlength: [500, 'Description cannot exceed 500 characters.'],
    },
    metaDescription: {
      type: String,
      required: [true, 'Meta Description is required.'],
      maxlength: [200, 'Meta Description cannot exceed 200 characters.'],
    },
    slug: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SubCategory ||
  mongoose.model('SubCategory', SubCategorySchema);
