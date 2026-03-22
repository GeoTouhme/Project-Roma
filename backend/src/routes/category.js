const express = require("express");
const router = express.Router();
const categories = require("../controllers/category");

// Import verifyToken function
const verifyToken = require("../config/jwt");
const adminCheck = require("../middleware/adminCheck");

router.post("/admin/categories", verifyToken, adminCheck, categories.createCategory);

router.get("/admin/categories", verifyToken, adminCheck, categories.getCategories);

router.get(
	"/admin/categories/:slug",
	verifyToken,
	adminCheck,
	categories.getCategoryBySlug
);

router.put(
	"/admin/categories/:slug",
	verifyToken,
	adminCheck,
	categories.updateCategoryBySlug
);
router.delete(
	"/admin/categories/:slug",
	verifyToken,
	adminCheck,
	categories.deleteCategoryBySlug
);
router.get("/admin/categories/all", verifyToken, adminCheck, categories.getCategories);

// User routes

router.get("/categories", categories.getCategories);
router.get("/all-categories", categories.getAllCategories);
router.get("/categories-slugs", categories.getCategoriesSlugs);
router.get("/subcategories-slugs", categories.getSubCategoriesSlugs);
router.get("/categories/:slug", categories.getCategoryBySlug);
router.get("/category-title/:slug", categories.getCategoryNameBySlug);

module.exports = router;
