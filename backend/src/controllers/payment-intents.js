const Stripe = require("stripe");
require("dotenv").config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const currency = (process.env.CURRENCY || 'usd').toLowerCase();
const crypto = require('crypto');
const Checkout = require('../models/Checkout');
const { checkoutHash } = require('../utils/checkoutBinding');
const { calculateOrderTotals } = require("../utils/orderCalculator");

const payment_intents = async (req, res) => {
	try {
		const { items, user, tip, couponCode, idempotencyKey, fulfillmentType } = req.body;

		// 🛡️ SECURITY: Do not trust the client-submitted amount. Compute the total
		// server-side from the cart items, using authoritative product prices.
		// Delivery fee also comes from store settings via the delivery zip.
		let totals;
		try {
			totals = await calculateOrderTotals({ items, deliveryZip: fulfillmentType === 'pickup' ? undefined : (user?.zip || ''), tip, couponCode, userEmail: req.user?.email, fulfillmentType });
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

        const cartHash = checkoutHash(totals, currency);
        const clientKey = typeof idempotencyKey === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey) ? idempotencyKey : crypto.randomUUID();
        const checkoutId = crypto.createHash('sha256').update(`${req.user._id}:${cartHash}:${clientKey}`).digest('hex');
        await Checkout.updateOne({ _id: checkoutId }, { $setOnInsert: { owner: req.user._id, cartHash, amount: expectedAmountCents, currency } }, { upsert: true });
        const createOptions = {
            metadata: { ownerId: req.user._id.toString(), cartHash, checkoutId },
			amount: expectedAmountCents,
			currency: currency.toLowerCase(),
			automatic_payment_methods: {
				enabled: true,
			},
		};

		// 🛡️ PREVENT DOUBLE-CHARGES: Stripe idempotency key must be passed as a
		// separate request options object, not inside the create params. Otherwise
		// Stripe ignores amount/currency and throws "missing required param: amount".
        const requestOptions = { idempotencyKey: `roma-checkout-${checkoutId}` };

		const paymentIntent = await stripe.paymentIntents.create(createOptions, requestOptions);

        await Checkout.updateOne({ _id: checkoutId, owner: req.user._id }, { $set: { paymentId: paymentIntent.id } });
		return res.status(200).json({ client_secret: paymentIntent.client_secret });
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

module.exports = { payment_intents };
