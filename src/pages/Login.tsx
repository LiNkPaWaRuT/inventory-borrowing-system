import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (role: 'borrower' | 'custodian') => {
    if (role === 'borrower') {
      setEmail('borrower1@example.com');
      setPassword('Password123!');
    } else {
      setEmail('custodian@example.com');
      setPassword('Password123!');
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '60px auto', padding: '28px', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontFamily: 'sans-serif' }}>
      <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', textAlign: 'center', color: '#1e293b' }}>
        Inventory & Borrowing
      </h2>
      <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b', textAlign: 'center' }}>
        CPE 334 Software Engineering — Sprint 1
      </p>

      {error && (
        <div style={{ padding: '12px', marginBottom: '16px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
            placeholder="e.g. borrower1@example.com"
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
            placeholder="••••••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>

      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>
          QUICK DEMO CREDENTIALS:
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleQuickFill('borrower')}
            style={{ flex: 1, padding: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
          >
            Fill Borrower
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('custodian')}
            style={{ flex: 1, padding: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
          >
            Fill Custodian
          </button>
        </div>
      </div>
    </div>
  );
};
