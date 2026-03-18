import React from 'react';
import { Sliders, Percent, LogOut, RefreshCw } from 'lucide-react';

const ConfigModal = ({ showConfig, setShowConfig, config, updateConfig }) => {
    if (!showConfig) return null;

    return (
        <div className="modal" style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowConfig(false)}>
            <div className="glass-panel modal-content" style={{ width: '90%', maxWidth: '500px', padding: '2.5rem', position: 'relative' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', fontWeight: 800, marginBottom: '2rem' }}>
                    <Sliders size={20} color="var(--primary)" /> Surcharge Rules
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>Profit Margin (%)</label>
                        <input
                            type="number"
                            value={config.profitMargin}
                            onChange={e => updateConfig('profitMargin', e.target.value)}
                            style={{ width: '100%', background: 'rgba(2,6,23,0.4)', border: '1px solid var(--glass-border)', padding: '0.8rem 1rem', borderRadius: '12px', color: 'white', fontWeight: 600 }}
                        />
                    </div>
                </div>

                <button
                    className="auth-submit"
                    onClick={() => setShowConfig(false)}
                    style={{ width: '100%', marginTop: '2.5rem', padding: '1rem' }}
                >
                    Save Configuration
                </button>
            </div>
        </div>
    );
};

const SettingsModal = ({
    showSettings,
    setShowSettings,
    makesData,
    discounts,
    updateDiscount,
    authEmail,
    userRole,
    logout,
    discountsFromSheet,
    discountRules
}) => {
    if (!showSettings) return null;

    return (
        <div className="modal" style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowSettings(false)}>
            <div className="glass-panel modal-content lrg" style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '3rem', position: 'relative' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                    <div>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem', fontWeight: 800 }}>
                            <Percent size={24} color="var(--primary)" /> Market Discounts
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                            {discountsFromSheet
                                ? "Discounts are synchronized across the cloud."
                                : "Manage regional baseline discounts manually here."
                            }
                        </p>
                    </div>
                    <button className="nav-btn" onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {Object.keys(makesData).flatMap(m => {
                        const motors = (makesData[m] || []);
                        const mocs = Array.from(new Set(motors.map(r => (r.MOC || 'CI').toUpperCase().trim())));
                        const upperM = String(m).toUpperCase().trim();
                        return mocs.map(moc => {
                            const k = `${upperM}-${moc}`;
                            return (
                                <div key={k} style={{ background: 'rgba(2, 6, 23, 0.3)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{m}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{moc} VARIANT</div>
                                    </div>
                                    <div style={{ position: 'relative', width: '80px' }}>
                                        <input
                                            type="number"
                                            value={discounts[k] || 0}
                                            onChange={e => updateDiscount(k, e.target.value)}
                                            style={{ width: '100%', background: 'rgba(2, 6, 23, 0.5)', border: '1px solid var(--glass-border)', padding: '0.4rem 1.8rem 0.4rem 0.6rem', borderRadius: '10px', color: 'white', textAlign: 'right', fontWeight: 700 }}
                                        />
                                        <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.8rem' }}>%</span>
                                    </div>
                                </div>
                            );
                        });
                    })}
                </div>

                <button
                    className="auth-submit"
                    onClick={() => setShowSettings(false)}
                    style={{ width: '100%', marginTop: '3rem', padding: '1.2rem' }}
                >
                    Close & Apply Scaling
                </button>
            </div>
        </div>
    );
};

export { ConfigModal, SettingsModal };
