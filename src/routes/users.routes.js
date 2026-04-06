const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { CreateUserSchema, UpdateUserSchema } = require('../utils/schemas');
const { ForbiddenError, success, created, noContent } = require('../utils/response');
const userService = require('../services/userService');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('admin'), (req, res, next) => {
  try {
    return success(res, userService.listUsers());
  } catch (err) { next(err); }
});

router.post('/', authorize('admin'), validate(CreateUserSchema), async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    return created(res, user);
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    const isSelf  = req.user.id === req.params.id;
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin) throw new ForbiddenError();
    return success(res, userService.getUserById(req.params.id));
  } catch (err) { next(err); }
});

router.patch('/:id', authorize('admin'), validate(UpdateUserSchema), (req, res, next) => {
  try {
    return success(res, userService.updateUser(req.params.id, req.body, req.user));
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('admin'), (req, res, next) => {
  try {
    userService.deleteUser(req.params.id, req.user);
    return noContent(res);
  } catch (err) { next(err); }
});

module.exports = router;
