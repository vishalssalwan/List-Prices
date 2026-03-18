import React from 'react';

const FilterSystem = ({
    activeCategory,
    selectedType,
    setSelectedType,
    masterOptions,
    filters,
    setFilters,
    setReferenceMake,
    setReferenceVariant
}) => {
    return (
        <section className="glass-panel" style={{ marginBottom: '2.5rem' }}>
            <div className="selection-stack" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {(activeCategory === 'Motors' || activeCategory === 'Drives' || (activeCategory === 'Gearboxes' && selectedType)) && (
                    <>
                        {activeCategory === 'Gearboxes' && masterOptions.types.length > 0 && (
                            <div className="field">
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8', marginBottom: '1rem' }}>
                                    Select Gearbox Type
                                </label>
                                <div className="scroll-container">
                                    {masterOptions.types.map(t => (
                                        <button
                                            key={t}
                                            className={`pill-item ${selectedType === t ? 'active' : ''}`}
                                            style={{
                                                padding: '0.6rem 1.2rem',
                                                borderRadius: '12px',
                                                background: selectedType === t ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                                                border: '1px solid',
                                                borderColor: selectedType === t ? 'transparent' : 'var(--glass-border)',
                                                color: selectedType === t ? 'white' : '#94a3b8',
                                                fontSize: '0.9rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            onClick={() => { setSelectedType(t); setFilters({}); setReferenceMake(null); setReferenceVariant(null); }}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {Object.keys(masterOptions.criteria)
                            .sort((a, b) => {
                                if (activeCategory !== 'Gearboxes') return 0;
                                const rank = (k) => {
                                    const u = k.toUpperCase();
                                    if (u.includes('TYPE')) return 0;
                                    if (u.includes('BRAND')) return 1;
                                    if (u === 'SIZE' || u.includes('INDIAN SIZE')) return 2;
                                    return 3;
                                };
                                return rank(a) - rank(b);
                            })
                            .map(criteriaKey => (
                                <div className="field" key={criteriaKey}>
                                    <label style={{ display: 'block', fontSize: 'min(0.9rem, 4vw)', fontWeight: 700, color: '#94a3b8', marginBottom: '1rem' }}>
                                        Select {criteriaKey}
                                    </label>
                                    <div className="scroll-container">
                                        {masterOptions.criteria[criteriaKey].map(val => {
                                            const isAvailable = masterOptions.available[criteriaKey]?.has(String(val));
                                            if (!isAvailable && filters[criteriaKey] !== val) return null;

                                            const isActive = Array.isArray(filters[criteriaKey])
                                                ? filters[criteriaKey].includes(val)
                                                : filters[criteriaKey] === val;

                                            return (
                                                <button
                                                    key={val}
                                                    className={`pill-item ${isActive ? 'active' : ''}`}
                                                    style={{
                                                        padding: '0.6rem 1.2rem',
                                                        borderRadius: '12px',
                                                        background: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                                                        border: '1px solid',
                                                        borderColor: isActive ? 'transparent' : 'var(--glass-border)',
                                                        color: isActive ? 'white' : '#94a3b8',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        opacity: isAvailable ? 1 : 0.4,
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onClick={() => {
                                                        const next = { ...filters };
                                                        const isMulti = criteriaKey === 'Indian Size' || criteriaKey === 'Size';
                                                        if (isMulti) {
                                                            const current = Array.isArray(next[criteriaKey]) ? next[criteriaKey] : (next[criteriaKey] ? [next[criteriaKey]] : []);
                                                            if (current.includes(val)) {
                                                                const filtered = current.filter(v => v !== val);
                                                                next[criteriaKey] = filtered.length > 0 ? filtered : null;
                                                            } else {
                                                                next[criteriaKey] = [...current, val];
                                                            }
                                                        } else {
                                                            if (next[criteriaKey] === val) delete next[criteriaKey];
                                                            else next[criteriaKey] = val;
                                                            if (criteriaKey === 'Size') delete next['Indian Size'];
                                                            if (criteriaKey === 'Indian Size') delete next['Size'];
                                                        }
                                                        setFilters(next);
                                                        setReferenceMake(null);
                                                        setReferenceVariant(null);
                                                    }}
                                                >
                                                    {val}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                    </>
                )}
            </div>
        </section>
    );
};

export default FilterSystem;
