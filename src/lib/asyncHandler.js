// Wrap an async route handler so rejected promises reach Express error handling.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
