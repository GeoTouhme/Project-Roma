const express = require("express");
const router = express.Router();
const subcategories = require("../controllers/subcategory");

// Import verifyToken function
const verifyToken = require("../config/jwt");
const adminCheck = require("../middleware/adminCheck");

router.post(
	"/admin/subcategories",
	verifyToken,
	adminCheck,
	subcategories.createSubCategory
);

router.get(
	"/admin/subcategories",
	verifyToken,
	adminCheck,
	subcategories.getAllSubCategories
);

router.get(
	"/admin/subcategories/:slug",
	verifyToken,
	adminCheck,
	subcategories.getSubCategoriesBySlug
);

router.put(
	"/admin/subcategories/:slug",
	verifyToken,
	adminCheck,
	subcategories.updateSubCategoriesBySlug
);

router.delete(
	"/admin/subcategories/:slug",
	verifyToken,
	adminCheck,
	subcategories.deleteSubCategoriesBySlug
);
router.get(
	"/admin/subcategories/all",
	verifyToken,
	adminCheck,
	subcategories.getSubCategories
);

// User routes

router.get("/subcategories", subcategories.getSubCategories);
router.get("/subcategories/all", subcategories.getAllSubCategories);

router.get("/subcategories/:slug", subcategories.getSubCategoriesBySlug);
router.get("/subcategory-title/:slug", subcategories.getSubCategoryNameBySlug);

module.exports = router;
