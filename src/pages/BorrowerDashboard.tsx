import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

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
  status: 'REQUESTED' | 'ACTIVE' | 'RETURNED';
  requestedAt: string;
  checkedOutAt?: string;
  item: Item;
}

export const BorrowerDashboard: React.FC = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, loansRes] = await Promise.all([
        fetch('/api/items', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/loans/my-loans', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const itemsData = await itemsRes.json();
      const loansData = await loansRes.json();

      if (itemsData.success) setItems(itemsData.items);
      if (loansData.success) setMyLoans(loansData.loans);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch inventory data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleRequestBorrow = async (itemId: string, title: string) => {
    setFeedback(null);
    setSubmittingItemId(itemId);

    try {
      const res = await fetch('/api/loans/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ itemId })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to request borrow.');
      }

      setFeedback({
        type: 'success',
        message: `Successfully requested "${title}"! Status is REQUESTED, awaiting Custodian checkout approval.`
      });
      await fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'An error occurred while submitting borrow request.'
      });
    } finally {
      setSubmittingItemId(null);
    }
  };

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

      {/* Item Catalog Section */}
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>📦 Equipment Catalog</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Browse department lab hardware and request items for checkout.
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
            Refresh Catalog
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#64748b', fontSize: '14px' }}>Loading catalog...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>Item Title</th>
                  <th style={{ padding: '10px 12px' }}>Serial Number</th>
                  <th style={{ padding: '10px 12px' }}>Category</th>
                  <th style={{ padding: '10px 12px' }}>Availability</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
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
                          display: 'inline-block',
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
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleRequestBorrow(item.id, item.title)}
                        disabled={!item.isAvailable || submittingItemId === item.id}
                        style={{
                          padding: '6px 14px',
                          fontSize: '13px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: 'none',
                          cursor: !item.isAvailable || submittingItemId === item.id ? 'not-allowed' : 'pointer',
                          background: item.isAvailable ? '#2563eb' : '#cbd5e1',
                          color: item.isAvailable ? '#fff' : '#64748b'
                        }}
                      >
                        {submittingItemId === item.id
                          ? 'Requesting...'
                          : item.isAvailable
                          ? 'Request Borrow'
                          : 'Unavailable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* My Loans Section */}
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#1e293b' }}>📋 My Loan Requests & History</h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
          Personal borrowing transactions and real-time approval status.
        </p>

        {myLoans.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>
            No loan requests submitted yet. Select an available item from the catalog above to request equipment.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>Loan ID</th>
                  <th style={{ padding: '10px 12px' }}>Item</th>
                  <th style={{ padding: '10px 12px' }}>Requested At</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {myLoans.map((loan) => (
                  <tr key={loan.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#64748b', fontSize: '12px' }}>
                      {loan.id.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#1e293b' }}>
                      {loan.item?.title || 'Unknown Item'}
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                        {loan.item?.serialNumber}
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#475569' }}>
                      {new Date(loan.requestedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background:
                            loan.status === 'REQUESTED'
                              ? '#fef3c7'
                              : loan.status === 'ACTIVE'
                              ? '#dbeafe'
                              : '#dcfce7',
                          color:
                            loan.status === 'REQUESTED'
                              ? '#b45309'
                              : loan.status === 'ACTIVE'
                              ? '#1d4ed8'
                              : '#15803d'
                        }}
                      >
                        {loan.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
