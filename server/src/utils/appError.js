export const createAppError = (message, statusCode = 500, code = 'APP_ERROR', details = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;

  if (details) {
    error.details = details;
  }

  return error;
};
