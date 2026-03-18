import React from 'react';
import { Lock, Mail, AlertCircle, ChevronRight, ShieldCheck } from 'lucide-react';

const AuthWall = ({
    authEmail,
    setAuthEmail,
    authError,
    setAuthError,
    isAuthChecking,
    verifyAccess
}) => {
    return (
        <main className="auth-wall-container">
            <div className="auth-card">
                <div className="auth-icon">
                    <Lock size={40} />
                </div>
                <h2>Restricted Access</h2>
                <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
                    Please enter your authorized work email to access the List Pricing system.
                </p>

                <div className="auth-form">
                    <div className="auth-field">
                        <Mail className="field-icon" size={18} />
                        <input
                            type="email"
                            placeholder="name@company.com"
                            value={authEmail}
                            onChange={e => { setAuthEmail(e.target.value); setAuthError(null); }}
                            onKeyDown={e => e.key === 'Enter' && verifyAccess(authEmail)}
                        />
                    </div>

                    {authError && (
                        <div className="auth-error-mini" style={{ color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                            <AlertCircle size={14} /> {authError}
                        </div>
                    )}

                    <button
                        className={`auth-submit ${isAuthChecking ? 'loading' : ''}`}
                        onClick={() => verifyAccess(authEmail)}
                        disabled={isAuthChecking}
                    >
                        {isAuthChecking ? "Verifying..." : "Validate Access"}
                        {!isAuthChecking && <ChevronRight size={18} />}
                    </button>
                </div>

                <div className="auth-footer" style={{ marginTop: '2.5rem', fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={14} /> Secure sync with Google Sheets authorized list
                </div>
            </div>
        </main>
    );
};

export default AuthWall;
