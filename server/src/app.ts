import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import { requireAuth, requireRole, AuthenticatedRequest } from './middleware/auth.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Auth routes
app.use('/api/auth', authRoutes);

// Protected health / check route for RBAC testing
app.get('/api/custodian/check', requireAuth, requireRole('CUSTODIAN'), (req: AuthenticatedRequest, res) => {
  return res.status(200).json({ success: true, message: 'Custodian access confirmed.' });
});
