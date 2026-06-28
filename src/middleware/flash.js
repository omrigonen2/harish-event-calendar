// Minimal flash-message support backed by the session.
export function flashMiddleware(req, res, next) {
  req.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = [];
    req.session.flash.push({ type, message });
  };
  res.locals.flash = req.session.flash || [];
  req.session.flash = [];
  next();
}
