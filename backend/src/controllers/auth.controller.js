const authService = require('../services/auth.service');

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const result = await authService.changePassword(req.user.id, req.body, req);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        isTemporaryPassword: req.user.isTemporaryPassword,
        employee: req.user.employee,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function createHrUser(req, res, next) {
  try {
    const user = await authService.createHrUser(req.user, req.body, req);
    res.status(201).json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

async function listHrUsers(req, res, next) {
  try {
    const users = await authService.listHrUsers();
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
}

async function toggleUserActive(req, res, next) {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const user = await authService.toggleUserActive(req.user, userId, Boolean(isActive), req);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

async function resetUserPassword(req, res, next) {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    const result = await authService.resetUserPassword(req.user, userId, newPassword, req);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  changePassword,
  getMe,
  createHrUser,
  listHrUsers,
  toggleUserActive,
  resetUserPassword,
};
