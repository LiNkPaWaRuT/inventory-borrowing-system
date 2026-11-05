import React from 'react';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';

export const App: React.FC = () => {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading session...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>Equipment Inventory & Borrowing</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            Logged in as: <strong>{user.name}</strong> ({user.email}) | Role: <span style={{ padding: '2px 8px', borderRadius: '4px', background: user.role === 'CUSTODIAN' ? '#fef3c7' : '#e0e7ff', color: user.role === 'CUSTODIAN' ? '#92400e' : '#3730a3', fontWeight: 600, fontSize: '12px' }}>{user.role}</span>
          </p>
        </div>
        <button
          onClick={logout}
          style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
        >
          Logout
        </button>
      </header>

      <main style={{ padding: '24px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>
          {user.role === 'CUSTODIAN' ? '🛡️ Custodian Control Panel' : '📦 Borrower Portal'}
        </h3>
        <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.6 }}>
          Authentication & Role verification (<strong>Feature F01</strong>) successfully integrated!
          {user.role === 'CUSTODIAN'
            ? ' You have administrative privileges to inspect all borrower requests and approve equipment checkouts.'
            : ' You can browse available inventory and submit item borrow requests.'}
        </p>
      </main>
    </div>
  );
};

export default App;
