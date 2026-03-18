import React from 'react';
import { RefreshCw, LogOut } from 'lucide-react';

const Navbar = ({
    isAuthenticated,
    loading,
    lastRefreshed,
    fetchData,
    logout
}) => {
    return (
        <header className="navbar">
            <div className="logo">Antigravity <span>PRO</span></div>
            <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {isAuthenticated ? (
                    <>
                        <div className={`resync-timer ${loading ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                            <span className={`sync-dot ${loading ? 'busy' : ''}`} style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: loading ? '#6366f1' : '#10b981',
                                boxShadow: loading ? '0 0 10px #6366f1' : 'none'
                            }} />
                            <span className="sync-text" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                {loading ? 'Crunching Sheets...' : `Last Sync: ${lastRefreshed ? new Date(lastRefreshed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Refreshing...'}`}
                            </span>
                        </div>

                        <button
                            className={`nav-btn ${loading ? 'spinning' : ''}`}
                            onClick={async () => {
                                if (loading) return;
                                localStorage.clear();
                                await fetchData();
                            }}
                            title="Force Hard Synchronize"
                            disabled={loading}
                            style={{ padding: '0.5rem', borderRadius: '10px' }}
                        >
                            <RefreshCw size={20} color={loading ? '#94a3b8' : '#6366f1'} strokeWidth={2.5} />
                        </button>

                        <button
                            className="nav-btn"
                            onClick={logout}
                            title="Logout"
                            style={{ padding: '0.5rem', borderRadius: '10px' }}
                        >
                            <LogOut size={18} color="#94a3b8" />
                        </button>
                    </>
                ) : (
                    <div className="guest-badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        Secure Access Portal
                    </div>
                )}
            </div>
        </header>
    );
};

export default Navbar;
