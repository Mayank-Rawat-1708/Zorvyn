const { z } = require('zod');

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(72),
  role: z.enum(['admin', 'analyst', 'viewer']),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'analyst', 'viewer']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

const CreateRecordSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  notes: z.string().max(500).optional(),
});

const UpdateRecordSchema = z.object({
  amount: z.number().positive().optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().min(1).max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  notes: z.string().max(500).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

const RecordFilterSchema = z.object({
  type:      z.enum(['income', 'expense']).optional(),
  category:  z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  sort:      z.enum(['date', 'amount', 'created_at']).default('date'),
  order:     z.enum(['asc', 'desc']).default('desc'),
});

const DashboardQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period:    z.enum(['weekly', 'monthly']).default('monthly'),
});

module.exports = {
  LoginSchema,
  CreateUserSchema,
  UpdateUserSchema,
  CreateRecordSchema,
  UpdateRecordSchema,
  RecordFilterSchema,
  DashboardQuerySchema,
};
