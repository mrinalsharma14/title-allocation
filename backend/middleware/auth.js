const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    //     if (!roles.includes(req.user.role)) {
    //       return res.status(403).json({ message: 'Access denied' });
    //     }
    //     next();
    //   };
    // };

    // Allow moduleAdmin to access admin routes
    const effectiveRoles = roles.includes('admin') 
      ? [...roles, 'moduleAdmin'] 
      : roles;

    if (!effectiveRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

// Add a special middleware for admin-only actions (like creating admins)
const requireAdmin = () => {
  return (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  };
};

module.exports = { auth, authorize, requireAdmin };