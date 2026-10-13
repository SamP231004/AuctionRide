import multer from 'multer';
import { UPLOADS } from '../config/constants.js';
import { env } from '../config/env.js';
import { ValidationError } from '../utils/errors.js';

/**
 * In-memory multipart parsing for bike images. Files are size/count limited here; the real type is
 * verified from magic bytes in the service, since the client-declared mime type can be forged.
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: UPLOADS.MAX_FILES_PER_REQUEST,
    fields: 0,
  },
  fileFilter(_req, file, callback) {
    if ((UPLOADS.ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new ValidationError('Only JPEG, PNG and WebP images are allowed', undefined, 'UNSUPPORTED_FILE_TYPE'));
    }
  },
}).array('images', UPLOADS.MAX_FILES_PER_REQUEST);
