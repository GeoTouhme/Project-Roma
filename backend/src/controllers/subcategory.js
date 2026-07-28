const SubCategories = require("../models/SubCategory");
const Category = require("../models/Category");
const getBlurDataURL = require("../config/getBlurDataURL");
const CloudinaryService = require("../services/cloudinary.service");
const { safeObjectId } = require("../utils/validators");

// Escapes special regex characters to prevent ReDoS and NoSQL injection
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$u0026');

const createSubCategory = async (req, res) => {
	try {
		const { cover, ...others } = req.body;
		// Validate if the 'blurDataURL' property exists in the logo object

		// If blurDataURL is not provided, generate it using the 'getBlurDataURL' function
		const blurDataURL = await getBlurDataURL(cover.url);

		const category = await SubCategories.create({
			...others,
			cover: {
				...cover,
				blurDataURL,
			},
		});
		await Category.findByIdAndUpdate(others.parentCategory, {
			$addToSet: {
				subCategories: category._id,
			},
		});

		res.status(201).json({ success: true, message: "SubCategory Created" });
	} catch (error) {
		res.status(400).json({ message: error.message });
	}
};

const getAllSubCategories = async (req, res) => {
	try {
		const { limit = 10, page = 1, search = "", parentCategory } = req.query;

		const skip = parseInt(limit) || 10;
		const safeSearch = escapeRegex(search);
		const query = {
			name: { $regex: safeSearch, $options: "i" },
		};
		if (parentCategory) {
			query.parentCategory = parentCategory;
		}

		const totalSubCategories = await SubCategories.countDocuments(query);
		const subcategories = await SubCategories.find(
			query,
			null,
			{
				skip: skip * (parseInt(page) - 1 || 0),
				limit: skip,
			}
		).sort({
			createdAt: -1,
		}).populate("parentCategory", "name");

		res.status(201).json({
			success: true,
			data: subcategories,
			count: Math.ceil(totalSubCategories.length / skip),
		});
	} catch (error) {
		res.status(400).json({ message: error.message });
	}
};

const getSubCategoriesBySlug = async (req, res) => {
	try {
		const { slug } = req.params;
		const subcategories = await SubCategories.findOne({ slug });
		const categories = await Category.find().select(["name"]);

		if (!subcategories) {
			return res.status(400).json({
				message: "Item Not Found",
			});
		}

		res.status(201).json({ success: true, data: subcategories, categories });
	} catch (error) {
		res.status(400).json({
			message: error.message,
		});
	}
};
const updateSubCategoriesBySlug = async (req, res) => {
	try {
		const { slug } = req.params;
		const { cover, ...others } = req.body;
		// Validate if the 'blurDataURL' property exists in the logo object
		if (!cover.blurDataURL) {
			// If blurDataURL is not provided, generate it using the 'getBlurDataURL' function
			cover.blurDataURL = await getBlurDataURL(cover.url);
		}
		const currentCategory = await SubCategories.findOneAndUpdate(
			{ slug },
			{
				...others,
				cover: {
					...cover,
				},
			},
			{ new: true, runValidators: true }
		);
		// Check if parent category is updated
		if (
			String(currentCategory.parentCategory) !== String(others.parentCategory)
		) {
			// Remove subcategory from old parent category
			await Category.findByIdAndUpdate(currentCategory.parentCategory, {
				$pull: { subCategories: currentCategory._id },
			});

			// Add subcategory to new parent category
			await Category.findByIdAndUpdate(others.parentCategory, {
				$addToSet: { subCategories: currentCategory._id },
			});
		}

		res.status(201).json({
			success: true,
			message: "SubCategory Updated",
			currentCategory,
		});
	} catch (error) {
		res.status(400).json({ message: error.message });
	}
};

const deleteSubCategoriesBySlug = async (req, res) => {
	try {
		const { slug } = req.params;

		const subCategory = await SubCategories.findOneAndDelete({ slug });
		if (subCategory.cover && subCategory.cover.public_id) {
			await CloudinaryService.deleteImage(subCategory.cover.public_id);
		}
		await Category.findByIdAndUpdate(subCategory.parentCategory, {
			$pull: { subCategories: subCategory._id },
		});

		if (!subCategory) {
			return res.status(400).json({
				success: false,
				message: "Item Not Found",
			});
		}

		res
			.status(201)
			.json({ success: true, message: "SubCategory Deleted Successfully" });
	} catch (error) {
		res.status(400).json({ message: error.message });
	}
};
const getSubCategories = async (req, res) => {
	try {
		const subcategories = await SubCategories.find().sort({
			createdAt: -1,
		});

		res.status(201).json({
			success: true,
			data: subcategories,
		});
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

const getSubCategoryNameBySlug = async (req, res) => {
	try {
		const subcategory = await SubCategories.findOne({ slug: req.params.slug })
			.select(["name", "slug"])
			.populate({ path: "parentCategory", select: ["name", "slug"] });

		res.status(201).json({
			success: true,
			data: subcategory,
		});
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};
module.exports = {
	createSubCategory,
	getSubCategories,
	getAllSubCategories,
	getSubCategoriesBySlug,
	updateSubCategoriesBySlug,
	deleteSubCategoriesBySlug,
	getSubCategoryNameBySlug,
};
