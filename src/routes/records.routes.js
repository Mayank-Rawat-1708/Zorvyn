const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { CreateRecordSchema, UpdateRecordSchema, RecordFilterSchema } = require('../utils/schemas');
const { success, created, noContent } = require('../utils/response');
const recordService = require('../services/recordService');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(RecordFilterSchema, 'query'), (req, res, next) => {
  try {
    const result = recordService.listRecords(req.query);
    return success(res, result.data, 200, result.meta);
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    return success(res, recordService.getRecordById(req.params.id));
  } catch (err) { next(err); }
});

router.post('/', authorize('admin'), validate(CreateRecordSchema), (req, res, next) => {
  try {
    return created(res, recordService.createRecord(req.body, req.user));
  } catch (err) { next(err); }
});

router.patch('/:id', authorize('admin'), validate(UpdateRecordSchema), (req, res, next) => {
  try {
    return success(res, recordService.updateRecord(req.params.id, req.body));
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('admin'), (req, res, next) => {
  try {
    recordService.deleteRecord(req.params.id);
    return noContent(res);
  } catch (err) { next(err); }
});

module.exports = router;
