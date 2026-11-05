import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Borrower {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Item {
  id: string;
  title: string;
  serialNumber: string;
  category: string;
  isAvailable: boolean;
}

interface Loan {
  id: string;
  itemId: string;
  borrowerId: string;
  status: 'REQUESTED' | 'ACTIVE' | 'RETURNED';
  requestedAt: string;
  checkedOutAt?: string;
  item: Item;
  borrower: Borrower;
}

export const CustodianDashboard: React.FC = () => {
  const { token } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingLoanId, setProcessingLoanId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [loansRes, itemsRes] = await Promise.all([
        fetch('/api/custodian/loans', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/items', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const loansData = await loansRes.json();
      const itemsData = await itemsRes.json();

      if (loansData.success) setLoans(loansData.loans);
      if (itemsData.success) setItems(itemsData.items);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch custodian operations data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleCheckout = async (loanId: string, itemTitle: string, borrowerName: string) => {
    setFeedback(null);
    setProcessingLoanId(loanId);

    try {
      const res = await fetch(`/api/loans/${loanId}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to complete checkout.');
      }

      setFeedback({
        type: 'success',
        message: `Checkout confirmed! "${itemTitle}" has been checked out to ${borrowerName}. Item is now marked unavailable.`
      });
      await fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Checkout failed.'
      });
    } finally {
      setProcessingLoanId(null);
    }
  };

  const pendingRequests = loans.filter((l) => l.status === 'REQUESTED');
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            background: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: feedback.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${feedback.type === 'success' ? '#86efac' : '#fca5a5'}`
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Pending Borrow Requests Section */}
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
              ⏳ Pending Equipment Requests ({pendingRequests.length})
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Borrow requests requiring custodian review and physical checkout confirmation.
            </p>
          </div>
          <button
            onClick={fetchData}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#64748b', fontSize: '14px' }}>Loading requests...</p>
        ) : pendingRequests.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>
            No pending borrow requests right now. All requests have been processed.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>Borrower</th>
                  <th style={{ padding: '10px 12px' }}>Requested Item</th>
                  <th style={{ padding: '10px 12px' }}>Requested Time</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Custodian Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((loan) => (
                  <tr key={loan.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>
                      <strong style={{ color: '#0f172a' }}>{loan.borrower?.name}</strong>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{loan.borrower?.email}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{loan.item?.title}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                        SN: {loan.item?.serialNumber}
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#475569', fontSize: '13px' }}>
                      {new Date(loan.requestedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleCheckout(loan.id, loan.item.title, loan.borrower.name)}
                        disabled={processingLoanId === loan.id}
                        style={{
                          padding: '8px 16px',
                          fontSize: '13px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: 'none',
                          cursor: processingLoanId === loan.id ? 'not-allowed' : 'pointer',
                          background: '#059669',
                          color: '#fff'
                        }}
                      >
                        {processingLoanId === loan.id ? 'Processing...' : 'Approve Checkout'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Active Loans Section */}
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#1e293b' }}>
          📦 Active Checked-Out Equipment ({activeLoans.length})
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
          Items currently in possession of department borrowers.
        </p>

        {activeLoans.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>
            No items are currently checked out.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>Item Title</th>
                  <th style={{ padding: '10px 12px' }}>Current Holder</th>
                  <th style={{ padding: '10px 12px' }}>Checked Out At</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeLoans.map((loan) => (
                  <tr key={loan.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>
                      <strong style={{ color: '#0f172a' }}>{loan.item?.title}</strong>
                      <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                        SN: {loan.item?.serialNumber}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ color: '#1e293b', fontWeight: 500 }}>{loan.borrower?.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{loan.borrower?.email}</div>
                    </td>
                    <td style={{ padding: '12px', color: '#475569', fontSize: '13px' }}>
                      {loan.checkedOutAt ? new Date(loan.checkedOutAt).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: '#dbeafe',
                          color: '#1d4ed8'
                        }}
                      >
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Live Inventory Overview Section */}
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#1e293b' }}>
          📊 Department Inventory Status
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
          Real-time exclusivity and availability status across all department assets.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 12px' }}>Item</th>
                <th style={{ padding: '10px 12px' }}>Serial Number</th>
                <th style={{ padding: '10px 12px' }}>Category</th>
                <th style={{ padding: '10px 12px' }}>Availability</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a' }}>{item.title}</td>
                  <td style={{ padding: '12px', color: '#64748b', fontFamily: 'monospace' }}>{item.serialNumber}</td>
                  <td style={{ padding: '12px', color: '#475569' }}>{item.category}</td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: item.isAvailable ? '#dcfce7' : '#fee2e2',
                        color: item.isAvailable ? '#15803d' : '#b91c1c'
                      }}
                    >
                      {item.isAvailable ? '● Available' : '○ Checked Out'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
