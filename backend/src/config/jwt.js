const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
	// Get the token from the request headers
	const token = req.headers.authorization;

	if (!token) {
		return res
			.status(401)
			.json({ success: false, message: "No Token Provided" });
	}

	// Verify the token
	jwt.verify(
		token.replace("Bearer ", ""),
		process.env.JWT_SECRET,
		(err, decoded) => {
			if (err) {
				return res.status(401).json({
					success: false,
					message: "Failed To Authenticate Token",
					error: err,
				});
			}

			// Attach the decoded user information to the request object for later use
			req.user = decoded;
			next();
		}
	);
}

module.exports = verifyToken;
