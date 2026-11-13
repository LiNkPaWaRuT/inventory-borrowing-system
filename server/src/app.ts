import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import loanRoutes from './routes/loans.js';
import custodianRoutes from './routes/custodian.js';
import { prisma } from './prisma.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Health & Readiness Endpoints (Required for Cloud Run & Smoke Tests)
app.get('/api/health', (_req, res) => {
  return res.status(200).json({ status: 'ok', service: 'inventory-system' });
});

app.get('/api/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: 'ready', db: 'connected' });
  } catch (error) {
    return res.status(503).json({ status: 'not_ready', db: 'disconnected' });
  }
});

// API route mounts
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/custodian', custodianRoutes);
