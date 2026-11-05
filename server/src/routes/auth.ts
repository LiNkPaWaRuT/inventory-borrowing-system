import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cpe334-fallback-secret';

// POST /api/auth/login [AC-01, AC-02, AC-06]
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Email and password are required.' }
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password.' }
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password.' }
    });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.status(200).json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

// POST /api/auth/logout [AC-03]
router.post('/logout', (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// GET /api/auth/me [AC-01, AC-04]
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User record not found.' }
    });
  }

  return res.status(200).json({
    success: true,
    user
  });
});

export default router;
