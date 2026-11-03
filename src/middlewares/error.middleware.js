import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, res, next) {
  next(ApiError.notFound(`Not found: ${req.method} ${req.originalUrl}`));
}

// Express 5 forwards errors thrown in async handlers here automatically.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error(err);

  res.status(status).json({
    error: status >= 500 && env.nodeEnv === 'production' ? 'Internal server error' : err.message,
  });
}
