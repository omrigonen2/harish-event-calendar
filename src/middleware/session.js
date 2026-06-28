import session from 'express-session';
import MongoStore from 'connect-mongo';
import env from '../config/env.js';

export function sessionMiddleware() {
  return session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: env.mongoUri, collectionName: 'sessions' }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  });
}
