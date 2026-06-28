import mongoose from 'mongoose';
import env from '../config/env.js';

mongoose.set('strictQuery', true);

export async function connectDb() {
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export default mongoose;
