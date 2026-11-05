import React from 'react';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { BorrowerDashboard } from './pages/BorrowerDashboard';
import { CustodianDashboard } from './pages/CustodianDashboard';

export const App: React.FC = () => {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'sans-serif', color: '#64748b' }}>
        Loading session...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div style={{ maxWidth: '960px', margin: '30px auto', padding: '0 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Navbar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 700 }}>
            Department Inventory & Equipment Borrowing
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Logged in: <strong>{user.name}</strong> ({user.email}) | Role:{' '}
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                background: user.role === 'CUSTODIAN' ? '#fef3c7' : '#e0e7ff',
                color: user.role === 'CUSTODIAN' ? '#92400e' : '#3730a3',
                fontWeight: 600,
                fontSize: '12px'
              }}
            >
              {user.role}
            </span>
          </p>
        </div>

        <button
          onClick={logout}
          style={{
            padding: '8px 16px',
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Logout
        </button>
      </header>

      {/* Role-Based Domain Views */}
      <main>
        {user.role === 'CUSTODIAN' ? (
          <CustodianDashboard />
        ) : (
          <BorrowerDashboard />
        )}
      </main>
    </div>
  );
};

export default App;
