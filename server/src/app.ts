import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import loanRoutes from './routes/loans.js';
import custodianRoutes from './routes/custodian.js';

export const app = express();

app.use(cors());
app.use(express.json());

// API route mounts
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/custodian', custodianRoutes);
