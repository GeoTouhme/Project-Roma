const User = require('../models/User');

module.exports = async (req, res, next) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const user = await User.findById(req.user._id);

        if (!user || (user.role !== 'admin' && user.role !== 'super admin')) {
            return res.status(403).json({ success: false, message: 'Access Denied: Admins Only' });
        }

        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
