import { z } from 'zod';
import { text } from './common.validator.js';

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

// bcrypt only considers the first 72 bytes, so longer passwords are rejected rather than silently truncated.
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const registerSchema = {
  body: z.object({ name: text(2, 80), email, password }).strict(),
};

export const loginSchema = {
  body: z.object({ email, password: z.string().min(1).max(72) }).strict(),
};

export const updateProfileSchema = {
  body: z.object({ name: text(2, 80) }).strict(),
};
