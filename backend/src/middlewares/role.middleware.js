/**
 * Role-Based Access Control middleware.
 * Verifies that the authenticated user possesses one of the allowed roles.
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access denied for role '${req.user.role}'`,
      });
    }

    next();
  };
};

module.exports = authorize;
