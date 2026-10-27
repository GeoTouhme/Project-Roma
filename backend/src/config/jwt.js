const { verifyAccessToken } = require('../utils/authTokens');

const { authenticateSession } = require('../utils/authSession');

async function verifyToken(req, res, next) {
	// 🛡️ SECURITY: Read token from HttpOnly cookie, not the Authorization header.
	const token = req.cookies?.token;

	if (!token) {
		return res
			.status(401)
			.json({ success: false, message: "No Token Provided" });
	}

	try {
		req.user = await authenticateSession(verifyAccessToken(token));
	} catch {
		return res.status(401).json({ success: false, message: 'Failed To Authenticate Token' });
	}
	return next();
}

module.exports = verifyToken;
