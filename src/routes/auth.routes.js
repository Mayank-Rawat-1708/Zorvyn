const express = require('express');
const { login } = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { LoginSchema } = require('../utils/schemas');
const { success } = require('../utils/response');

const router = express.Router();

router.post('/login', validate(LoginSchema), async (req, res, next) => {
  try {
    const result = await login(req.body.email, req.body.password);
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, (req, res) => {
  return success(res, req.user);
});

module.exports = router;
