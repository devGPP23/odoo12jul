const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');

class AuthController {
  signup = asyncHandler(async (req, res) => {
    const result = await authService.signup(req.body);
    res.status(201).json({
      success: true,
      message: 'Signup successful',
      data: result,
    });
  });

  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  });

  forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.status(200).json({
      success: true,
      ...result
    });
  });

  resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword);
    res.status(200).json({
      success: true,
      ...result
    });
  });

  refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: result,
    });
  });

  getMe = asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  });
}

module.exports = new AuthController();
