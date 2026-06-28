import User from '../models/User.js';
import { unreadCount } from '../services/notificationService.js';

// Load the logged-in user (if any) and expose common view locals.
export async function currentUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.unreadNotifications = 0;
  if (req.session?.userId) {
    const user = await User.findById(req.session.userId);
    if (user && user.active) {
      req.user = user;
      res.locals.currentUser = user;
      res.locals.unreadNotifications = await unreadCount(user._id);
    } else {
      req.session.destroy(() => {});
    }
  }
  next();
}
