const User = require("../models/User");
const Categories = require("../models/Category");
const SubCategories = require("../models/SubCategory");
const CloudinaryService = require("../services/cloudinary.service");
const getBlurDataURL = require("../config/getBlurDataURL");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$\u0026');

const createCategory = async (req, res) => {
	try {
		const { cover, ...body } = req.body;

		if (!cover || !cover.url) {
			return res.status(400).json({ success: false, message: 'Cover image data is required.' });
		}

		// 🛡️ Whitelist allowed fields to prevent mass assignment of internal fields
		const ALLOWED_FIELDS = ['name', 'metaTitle', 'description', 'metaDescription', 'slug', 'status', 'taxable', 'crvRate', 'order'];
		const safeData = {};
		for (const field of ALLOWED_FIELDS) {
			if (body[field] !== undefined) safeData[field] = body[field];
		}

		const blurDataURL = await getBlurDataURL(cover.url);

		await Categories.create({
			...safeData,
			cover: {
				...cover,
				blurDataURL,
			},
		});

		res.status(201).json({ success: true, message: "Category Created" });
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};

const getAllCategories = async (req, res) => {
	try {
		const userCount = await User.countDocuments();
		await SubCategories.findOne();
		const categories = await Categories.find()
			.sort({
				order: 1,
				createdAt: -1,
			})
			.select(["name", "slug", "subCategories", "status", "taxable", "crvRate", "order", "productCount", "createdAt"])
			.populate({ path: "subCategories", select: ["name", "slug", "order", "productCount"], options: { sort: { order: 1 } } });

		res.status(201).json({
			success: true,
			data: categories,
			...(!userCount && {
				adminPopup: true,
			}),
		});
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};

const getCategoryByAdmin = async (req, res) => {
	try {
		const { slug } = req.params;
		const category = await Categories.findOne({ slug });

		if (!category) {
			return res.status(400).json({
				success: false,
				message: "Item Not Found",
			});
		}

		res.status(201).json({ success: true, data: category });
	} catch (error) {
		res.status(400).json({
			success: false,
			message: error.message,
		});
	}
};
const getCategoryBySlug = async (req, res) => {
	try {
		const { slug } = req.params;
		const category = await Categories.findOne({ slug }).select([
			"name",
			"description",
			"metaTitle",
			"metaDescription",
			"cover",
			"slug",
			"taxable",
			"crvRate",
		]);

		if (!category) {
			return res.status(400).json({
				success: false,
				message: "Item Not Found",
			});
		}

		res.status(201).json({ success: true, data: category });
	} catch (error) {
		res.status(400).json({
			success: false,
			message: error.message,
		});
	}
};
const updateCategoryBySlug = async (req, res) => {
	try {
		const { slug } = req.params;
		const { cover, ...body } = req.body;

		if (!cover || !cover.url) {
			return res.status(400).json({ success: false, message: 'Cover image data is required.' });
		}

		// 🛡️ Whitelist allowed fields to prevent mass assignment of internal fields
		const ALLOWED_FIELDS = ['name', 'metaTitle', 'description', 'metaDescription', 'slug', 'status', 'taxable', 'crvRate', 'order'];
		const safeData = {};
		for (const field of ALLOWED_FIELDS) {
			if (body[field] !== undefined) safeData[field] = body[field];
		}

		// Validate if the 'blurDataURL' property exists in the logo object
		if (!cover.blurDataURL) {
			// If blurDataURL is not provided, generate it using the 'getBlurDataURL' function
			cover.blurDataURL = await getBlurDataURL(cover.url);
		}
		await Categories.findOneAndUpdate(
			{ slug },
			{
				...safeData,
				cover: {
					...cover,
				},
			},
			{ new: true, runValidators: true }
		);

		res.status(201).json({ success: true, message: "Category Updated" });
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};

const deleteCategoryBySlug = async (req, res) => {
	try {
		const { slug } = req.params;

		const category = await Categories.findOneAndDelete({ slug });
		if (category.cover && category.cover.public_id) {
			await CloudinaryService.deleteImage(category.cover.public_id);
		}
		if (!category) {
			return res.status(400).json({
				success: false,
				message: "Item Not Found",
			});
		}

		res
			.status(201)
			.json({ success: true, message: "Category Deleted Successfully" });
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};
const getCategories = async (req, res) => {
	try {
		const { limit = 20, page = 1, search = "" } = req.query;

		const skip = parseInt(limit) || 20;
		const safeSearch = escapeRegex(search);
		const totalCategories = await Categories.find({
			name: { $regex: safeSearch, $options: "i" },
		});
		const categories = await Categories.find(
			{
				name: { $regex: safeSearch, $options: "i" },
			},
			null,
			{
				skip: skip * (parseInt(page) - 1 || 0),
				limit: skip,
			}
		).sort({
			order: 1,
			createdAt: -1,
		})
		.select("name slug status taxable crvRate order productCount cover createdAt");

		res.status(201).json({
			success: true,
			data: categories,
			count: Math.ceil(totalCategories.length / skip),
		});
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};
const getCategoriesSlugs = async (req, res) => {
	try {
		const categories = await Categories.find().select("slug");

		res.status(201).json({
			success: true,
			data: categories,
		});
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};
const getSubCategoriesSlugs = async (req, res) => {
	try {
		const categories = await SubCategories.find()
			.select("slug")
			.populate({ path: "parentCategory", select: ["slug"] });

		res.status(201).json({
			success: true,
			data: categories,
		});
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};
const getCategoryNameBySlug = async (req, res) => {
	try {
		const category = await Categories.findOne({
			slug: req.params.slug,
		}).select(["name", "slug"]);

		res.status(201).json({
			success: true,
			data: category,
		});
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};
module.exports = {
	createCategory,
	getCategories,
	getAllCategories,
	getCategoryBySlug,
	updateCategoryBySlug,
	deleteCategoryBySlug,
	getCategoriesSlugs,
	getSubCategoriesSlugs,
	getCategoryByAdmin,
	getCategoryNameBySlug,
};
