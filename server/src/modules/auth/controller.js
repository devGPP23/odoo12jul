/**
 * Auth Module — Controller (thin layer over service).
 */

const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./service');

const signup = asyncHandler(async (req, res) => {
  const { name, email, password, departmentId } = req.body;
  const result = await authService.signup({ name, email, password, departmentId });
  res.status(201).json({ success: true, data: result });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  res.json({ success: true, data: result });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.json({ success: true, data: user });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.token);
  res.json({ success: true, message: 'Logged out successfully.' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  res.json({ success: true, data: result });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  res.json({ success: true, data: result });
});

module.exports = { signup, login, getMe, logout, forgotPassword, resetPassword };
