const Review = require("../models/Review");
const Products = require("../models/Product");
const Users = require("../models/User");
const { getUser } = require("../config/getUser");
const Orders = require("../models/Order");
const blurDataUrl = require("../config/getBlurDataURL");
const getReviewsbyPid = async (req, res) => {
	try {
		// Populate the product
		const pid = req.params.pid;
		// Get reviews for the populated product
		const reviews = await Review.find({
			product: pid,
		}).populate({
			path: "user",
			select: ["firstName", "lastName", "cover", "orders"],
		});
		const product = await Products.findById(pid).select('slug status available');
		if (!product || product.status === 'disabled' || product.status === 'inactive' || product.available <= 0) {
			return res.status(404).json({ success: false, message: 'Product not found or unavailable.' });
		}
		const reviewsSummery = await Products.aggregate([
			{
				$match: { slug: product.slug },
			},
			{
				$lookup: {
					from: "reviews",
					localField: "_id",
					foreignField: "product",
					as: "reviews",
				},
			},
			{
				$unwind: "$reviews",
			},
			{
				$group: {
					_id: "$reviews.rating",
					count: { $sum: 1 },
				},
			},
		]);

		return res.status(201).json({ success: true, reviewsSummery, reviews });
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};
const createReview = async (req, res) => {
	try {
		const user = await getUser(req, res);
		if (!user) return;
		const uid = user._id.toString();
		const { pid, rating, review: reviewText, images = [] } = req.body;

		if (!pid || !rating || !reviewText) {
			return res.status(400).json({
				success: false,
				message: "Please provide required details. (pid, rating, review)"
			})
		}

		// 🛡️ Validate rating is an integer between 1 and 5
		const safeRating = Number(rating);
		if (!Number.isInteger(safeRating) || safeRating < 1 || safeRating > 5) {
			return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5.' });
		}

		// 🛡️ Validate image URLs are strings and look like HTTP(S) links
		if (!Array.isArray(images)) {
			return res.status(400).json({ success: false, message: 'Images must be an array of URLs.' });
		}
		for (const image of images) {
			if (typeof image !== 'string' || (!image.startsWith('http://') && !image.startsWith('https://'))) {
				return res.status(400).json({ success: false, message: 'Each image must be a valid http(s) URL.' });
			}
		}

		const orders = await Orders.find({
			"user.email": user.email,
			"items.pid": pid,
		});

		const updatedImages = await Promise.all(
			images.map(async image => {
				const blurDataURL = await blurDataUrl(image);
				return { url: image, blurDataURL };
			})
		);
		const review = await Review.create({
			product: pid,
			review: reviewText,
			rating: safeRating,
			images: updatedImages,
			user: uid,
			isPurchased: Boolean(orders.length),
		});

		await Products.findByIdAndUpdate(pid, {
			$addToSet: {
				reviews: review._id,
			},
		});

		return res.status(201).json({ success: true, data: review, user });
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};

const getReviewsByAdmin = async (req, res) => {
	try {
		const reviews = await Review.find(
			{}
		); /* find all the data in our database */
		return res.status(200).json({ success: true, data: reviews });
	} catch (error) {
		return res.status(400).json({ success: false, message: error.message });
	}
};

const createReviewByAdmin = async (req, res) => {
	try {
		const { _id, review } = await req.body;
		const isReview = await Review.findOne({ _id: _id });
		const product = await Products.findOne({ _id: _id });

		if (!product) {
			return res.status(404).json({ success: false, message: "Product not found." });
		}

		await Products.findByIdAndUpdate(
			_id,
			{
				totalReview: (product.totalReview || 0) + 1,
				totalRating: (product.totalRating || 0) + review.rating,
			},
			{
				new: true,
				runValidators: true,
			}
		);

		if (isReview) {
			const filtered = isReview.ratings.filter(
				v => v.name === `${review.rating} Star`
			)[0];
			const notFiltered = isReview.ratings.filter(
				v => v.name !== `${review.rating} Star`
			);

			const alreadyReview = await Review.findByIdAndUpdate(
				_id,
				{
					ratings: [
						...notFiltered,
						{
							name: `${review.rating} Star`,
							reviewCount: filtered.reviewCount + 1,
							starCount: filtered.starCount + 1,
						},
					],
					reviews: [...isReview.reviews, { ...review }],
				},
				{
					new: true,
					runValidators: true,
				}
			);

			return res.status(400).json({ success: true, data: alreadyReview });
		} else {
			const ratingData = [
				{
					name: "1 Star",
					starCount: 0,
					reviewCount: 0,
				},
				{
					name: "2 Star",
					starCount: 0,
					reviewCount: 0,
				},
				{
					name: "3 Star",
					starCount: 0,
					reviewCount: 0,
				},
				{
					name: "4 Star",
					starCount: 0,
					reviewCount: 0,
				},
				{
					name: "5 Star",
					starCount: 0,
					reviewCount: 0,
				},
			];

			const filtered = ratingData.filter(
				v => v.name === `${review.rating} Star`
			)[0];
			const notFiltered = ratingData.filter(
				v => v.name !== `${review.rating} Star`
			);

			const newReview = await Review.create([
				{
					_id: _id,
					ratings: [
						...notFiltered,
						{
							name: `${review.rating} Star`,
							reviewCount: filtered.reviewCount + 1,
							starCount: filtered.starCount + 1,
						},
					],
					reviews: [{ ...review }],
				},
			]);

			return res.status(201).json({ success: true, data: newReview });
		}
	} catch (error) {
		return res.status(400).json({ success: false, error: message.error });
	}
};

module.exports = {
	getReviewsbyPid,
	createReview,
	getReviewsByAdmin,
	createReviewByAdmin,
};
