const mongoose = require("mongoose");

const CouponCodeSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Name is required."],
		},
		code: {
			type: String,
			minlength: 4,
			unique: true,
			required: [true, "Code is required."],
		},
		discount: {
			type: Number,
			min: 0,
			required: [true, "Discount is required."],
		},
		expire: {
			type: Date,
			default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
		},
		description: {
			type: String,
		},
		type: {
			type: String,
			enum: ["percent", "fixed"], // This ensures that 'type' can only be 'percent' or 'fixed'
			required: [true, "Type is required."],
		},
		usedBy: [{ type: String }], // Array of user emails
		usageHistory: [
			{
				user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
				email: { type: String },
				name: { type: String },
				orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
				orderNo: { type: String },
				total: { type: Number },
				discount: { type: Number },
				date: { type: Date, default: Date.now },
			},
		],
		maxUses: {
			type: Number,
			min: 0,
			default: 0, // 0 = unlimited
		},
		minOrderAmount: {
			type: Number,
			min: 0,
			default: 0, // 0 = no minimum
		},
	},
	{
		timestamps: true,
	}
);
const CouponCode =
	mongoose.models.CouponCode || mongoose.model("CouponCode", CouponCodeSchema);
module.exports = CouponCode;
