const express = require("express");
const router = express.Router();
const reviewRoutes = require("../controllers/review");
// Import verifyToken function
const verifyToken = require("../config/jwt");
const adminCheck = require("../middleware/adminCheck");
//user routes
router.get("/reviews/:pid", reviewRoutes.getReviewsbyPid);
router.post("/reviews", verifyToken, reviewRoutes.createReview);

//admin routes
router.get("/admin/reviews", verifyToken, adminCheck, reviewRoutes.getReviewsByAdmin);
router.post("/admin/review", verifyToken, adminCheck, reviewRoutes.createReviewByAdmin);

module.exports = router;
