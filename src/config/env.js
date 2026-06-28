import dotenv from 'dotenv';

dotenv.config();

function required(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: required('MONGODB_URI', process.env.MONGODB_URI),
  sessionSecret: required('SESSION_SECRET', process.env.SESSION_SECRET),
  encryptionKey: required('ENCRYPTION_KEY', process.env.ENCRYPTION_KEY),
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || '3000'}`,
  seed: {
    email: process.env.SEED_SUPERADMIN_EMAIL || 'omri@educenter.co.il',
    password: process.env.SEED_SUPERADMIN_PASSWORD || 'ChangeMe123!',
  },
};

env.isProd = env.nodeEnv === 'production';

export default env;
