import React, { useState, useEffect, useRef } from 'react';
import { Download, ChevronRight, ChevronDown } from 'lucide-react';

const ComparisonResults = ({
    activeCategory,
    comparisonData,
    userRole,
    highlights,
    exportToExcel,
    fieldConfig,
    activePillField,
    setActivePillField,
    filters,
    masterOptions,
    setFilters,
    setReferenceMake,
    setReferenceVariant,
    referenceMake
}) => {
    const [openDropdown, setOpenDropdown] = useState(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!comparisonData) return null;

    return (
        <div className="results-container fadeInUp" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
            <div className="results-wrapper glass-panel" style={{ padding: '0' }}>
                {/* Comparison Header / Baseline */}
                <div className="results-header" style={{ padding: '2.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                    <div className="header-main-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="ref-side">
                            <div className="ref-label" style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
                                Baseline Reference
                            </div>
                            <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white' }}>
                                {referenceMake} {(activeCategory === 'Motors' || activeCategory === 'Drives') ? 'Base' : ''}
                                {userRole === 'admin' && (
                                    <span className="ref-disc-badge" style={{ marginLeft: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.2rem 0.8rem', borderRadius: '10px', fontSize: '0.8rem' }}>
                                        {Math.round(comparisonData.refDiscount * 100) / 100}% OFF
                                    </span>
                                )}
                                {comparisonData.debug?.deviation > 0 && (
                                    <span className="personalized-badge" style={{ marginLeft: '1rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '0.2rem 0.8rem', borderRadius: '10px', fontSize: '0.8rem', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                                        +{comparisonData.debug.deviation}% PERSONALIZED
                                    </span>
                                )}
                            </h3>
                        </div>

                        <div className="price-tag-massive" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            {userRole === 'admin' && (
                                <button className="nav-btn" onClick={exportToExcel} style={{ padding: '0.8rem' }}>
                                    <Download size={22} />
                                </button>
                            )}
                            <div className="price-current" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 600, color: '#94a3b8', transform: 'translateY(14px)' }}>₹</span>
                                <div className="price-stack" style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                                        {Math.round(comparisonData.refNet).toLocaleString('en-IN')}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        NET TOTAL {userRole === 'admin' && <span> (B:{Math.round(comparisonData.debug.base * 100) / 100}% D:{comparisonData.debug.matchedIdx})</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ref-grid" style={{
                        marginTop: '2.5rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '0.75rem',
                        width: '100%'
                    }} ref={dropdownRef}>
                        {Object.keys(filters).map(fk => (
                            <div
                                className="header-badge"
                                key={fk}
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--glass-border)',
                                    padding: '0.6rem 1rem',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    position: 'relative'
                                }}
                            >
                                <div
                                    className="ref-dropdown-container"
                                    onClick={() => setOpenDropdown(openDropdown === fk ? null : fk)}
                                >
                                    <span style={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>{fk}</span>
                                    <span className="ref-dropdown-value">
                                        {filters[fk] || 'Select'}
                                        <ChevronDown size={14} style={{ transform: openDropdown === fk ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                    </span>

                                    {openDropdown === fk && (
                                        <div className="ref-dropdown-menu">
                                            {(masterOptions.criteria[fk] || [])
                                                .filter(opt => masterOptions.available[fk]?.has(String(opt)))
                                                .map(opt => (
                                                    <div
                                                        key={opt}
                                                        className={`ref-dropdown-item ${filters[fk] === opt ? 'active' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const next = { ...filters, [fk]: opt };
                                                            setFilters(next);
                                                            if (fk === 'Size') delete next['Indian Size'];
                                                            if (fk === 'Indian Size') delete next['Size'];
                                                            setReferenceMake(null);
                                                            setReferenceVariant(null);
                                                            setOpenDropdown(null);
                                                        }}
                                                    >
                                                        {opt}
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Brand Comparison Grid */}
                <div className="table-responsive" style={{ padding: 'min(1rem, 2vw)' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.75rem' }}>
                        <thead className="comparison-table-header">
                            <tr style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem' }}>Manufacturer / Specifications</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>Net Price (INR)</th>
                                {userRole === 'admin' && <th style={{ textAlign: 'center', padding: '1rem' }}>To Match Gap</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Reference Brand Row */}
                            <tr style={{ background: 'rgba(99, 102, 241, 0.05)', borderRadius: '16px' }}>
                                <td data-label="Manufacturer / Specifications" style={{ padding: '1.5rem', borderTopLeftRadius: '16px', borderBottomLeftRadius: '16px' }}>
                                    <div className="brand-cell">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{referenceMake}</span>
                                            <span style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 800 }}>REFERENCE</span>
                                        </div>
                                        <div className="brand-specs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {Object.keys(fieldConfig).map(k => {
                                                if ((fieldConfig[k] === 'display' || (k === 'Model' && activeCategory === 'Gearboxes')) && comparisonData.refMotor[k]) {
                                                    return (
                                                        <span key={k} style={{ background: 'rgba(2, 6, 23, 0.4)', color: '#94a3b8', fontSize: '0.75rem', padding: '0.3rem 0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                                            {k}: {comparisonData.refMotor[k]}
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </div>
                                    </div>
                                </td>
                                <td data-label="Net Price (INR)" style={{ textAlign: 'center', padding: '1.5rem' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{Math.round(comparisonData.refNet).toLocaleString('en-IN')}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>BASELINE</div>
                                </td>
                                {userRole === 'admin' && (
                                    <td data-label="To Match Gap" style={{ textAlign: 'center', borderTopRightRadius: '16px', borderBottomRightRadius: '16px' }}>
                                        <span style={{ color: '#64748b', fontWeight: 700 }}>-</span>
                                    </td>
                                )}
                            </tr>

                            {/* Other Brands */}
                            {comparisonData.brands.filter(b => !b.isRef).map((b, i) => {
                                const isBest = highlights?.best?.id === b.id;
                                return (
                                    <tr key={i} style={{ background: isBest ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.01)', borderRadius: '16px' }}>
                                        <td data-label="Manufacturer / Specifications" style={{ padding: '1.5rem', borderTopLeftRadius: '16px', borderBottomLeftRadius: '16px' }}>
                                            <div className="brand-cell">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{b.make}</span>
                                                    {isBest && <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 800 }}>BEST VALUE</span>}
                                                </div>
                                                <div className="brand-specs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    {Object.keys(fieldConfig).map(k => {
                                                        if ((fieldConfig[k] === 'display' || (k === 'Model' && activeCategory === 'Gearboxes')) && b.rowRaw[k]) {
                                                            return (
                                                                <span key={k} style={{ background: 'rgba(2, 6, 23, 0.4)', color: '#94a3b8', fontSize: '0.75rem', padding: '0.3rem 0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                                                    {k}: {b.rowRaw[k]}
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Net Price (INR)" style={{ textAlign: 'center', padding: '1.5rem' }}>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{Math.round(b.net).toLocaleString('en-IN')}</div>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                color: b.diffINR > 0 ? '#ef4444' : '#10b981'
                                            }}>
                                                {b.diffINR > 0 ? '+' : ''}{Math.round(b.diffINR).toLocaleString('en-IN')} vs REF
                                            </div>
                                        </td>
                                        {userRole === 'admin' && (
                                            <td data-label="To Match Gap" style={{ textAlign: 'center', borderTopRightRadius: '16px', borderBottomRightRadius: '16px' }}>
                                                <div style={{ background: 'rgba(2, 6, 23, 0.5)', display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white' }}>{b.equivDiscount.toFixed(1)}%</div>
                                                    <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>TO MATCH</div>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ComparisonResults;
