import express from 'express';
import mongoose from '../../lib/db.js';

const router = express.Router();

router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? 'ok' : 'degraded',
    db: dbState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

export default router;
