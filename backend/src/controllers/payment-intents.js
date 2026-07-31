const Stripe = require("stripe");
require("dotenv").config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const currency = process.env.CURRENCY;
const { calculateOrderTotals } = require("../utils/orderCalculator");

const payment_intents = async (req, res) => {
	try {
		const { items, shipping, tip, couponCode, idempotencyKey } = req.body;

		// 🛡️ SECURITY: Do not trust the client-submitted amount. Compute the total
		// server-side from the cart items, using authoritative product prices.
		let totals;
		try {
			totals = await calculateOrderTotals({ items, shipping, tip, couponCode });
		} catch (calcError) {
			return res.status(400).json({ success: false, message: calcError.message });
		}

		const { expectedAmountCents } = totals;

		if (!expectedAmountCents || expectedAmountCents <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid payment amount.' });
		}

		// Enforce Stripe's maximum charge ceiling
		if (expectedAmountCents > 99999900) {
			return res.status(400).json({ success: false, message: 'Amount out of allowed range.' });
		}

		const createOptions = {
			amount: expectedAmountCents,
			currency: currency.toLowerCase(),
		};

		// 🛡️ PREVENT DOUBLE-CHARGES: Stripe idempotency key ensures accidental
		// duplicate requests (e.g., double-click on Place Order) reuse the same
		// PaymentIntent instead of creating multiple charges.
		if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.length <= 255) {
			createOptions.idempotencyKey = idempotencyKey;
		}

		const paymentIntent = await stripe.paymentIntents.create(createOptions);

		return res.status(200).json({ client_secret: paymentIntent.client_secret });
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

module.exports = { payment_intents };
