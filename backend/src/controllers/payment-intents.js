const Stripe = require("stripe");
require("dotenv").config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const currency = process.env.CURRENCY;

const payment_intents = async (req, res) => {
	try {
		const { amount } = req.body;

		// Validate amount server-side — prevent client-side price tampering
		const parsedAmount = Number(amount);
		if (!parsedAmount || parsedAmount <= 0 || !Number.isFinite(parsedAmount)) {
			return res.status(400).json({ success: false, message: 'Invalid payment amount.' });
		}

		// Enforce a minimum of $0.50 (Stripe minimum) and maximum of $999,999
		if (parsedAmount < 0.5 || parsedAmount > 999999) {
			return res.status(400).json({ success: false, message: 'Amount out of allowed range.' });
		}

		const paymentIntent = await stripe.paymentIntents.create({
			amount: Math.round(parsedAmount * 100), // Convert to cents, integer only
			currency: currency.toLowerCase(),
		});

		return res.status(200).json({ client_secret: paymentIntent.client_secret });
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

module.exports = { payment_intents };
