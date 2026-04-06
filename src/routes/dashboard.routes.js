const express = require('express');
const { authenticate, authorizeLevel } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { DashboardQuerySchema } = require('../utils/schemas');
const { success } = require('../utils/response');
const dashboardService = require('../services/dashboardService');

const router = express.Router();

router.use(authenticate);
router.use(authorizeLevel('analyst'));

const withDateQuery = validate(DashboardQuerySchema, 'query');

router.get('/summary', withDateQuery, (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    return success(res, dashboardService.getSummary(date_from, date_to));
  } catch (err) { next(err); }
});

router.get('/categories', withDateQuery, (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    return success(res, dashboardService.getCategoryBreakdown(date_from, date_to));
  } catch (err) { next(err); }
});

router.get('/trends', withDateQuery, (req, res, next) => {
  try {
    const { date_from, date_to, period } = req.query;
    return success(res, dashboardService.getTrends(date_from, date_to, period));
  } catch (err) { next(err); }
});

router.get('/recent-activity', (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    return success(res, dashboardService.getRecentActivity(limit));
  } catch (err) { next(err); }
});

router.get('/top-categories', withDateQuery, (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    return success(res, dashboardService.getTopCategories(limit, date_from, date_to));
  } catch (err) { next(err); }
});

module.exports = router;
