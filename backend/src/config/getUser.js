const Users = require('../models/User');

// Helpers return null after sending a response so callers can short-circuit with `if (!user) return;`

exports.getUser = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'You Must Be Logged In.' });
    return null;
  }

  try {
    const user = await Users.findById(req.user._id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User Not Found.' });
      return null;
    }

    return user;
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error.' });
    return null;
  }
};

exports.getAdmin = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'You Must Be Logged In.' });
    return null;
  }

  try {
    const user = await Users.findById(req.user._id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User Not Found.' });
      return null;
    }
    if (!user.role.includes('admin')) {
      res.status(403).json({ success: false, message: 'Access Denied: Admins Only.' });
      return null;
    }

    return user;
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
    return null;
  }
};
