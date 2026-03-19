
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import './FilterSystemV2.css';

const FilterSystemV2 = ({
    activeCategory,
    selectedType,
    setSelectedType,
    masterOptions,
    filters,
    setFilters,
    setReferenceMake,
    setReferenceVariant
}) => {
    const [openFilter, setOpenFilter] = useState(null);
    const popoverRef = useRef(null);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setOpenFilter(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleFilter = (key) => {
        if (openFilter === key) setOpenFilter(null);
        else setOpenFilter(key);
    };

    const handleSelect = (key, val, isAvailable) => {
        if (!isAvailable && filters[key] !== val) return;

        const next = { ...filters };
        const isMulti = key === 'Indian Size' || key === 'Size';
        
        if (isMulti) {
            const current = Array.isArray(next[key]) ? next[key] : (next[key] ? [next[key]] : []);
            if (current.includes(val)) {
                const filtered = current.filter(v => v !== val);
                next[key] = filtered.length > 0 ? filtered : null;
            } else {
                next[key] = [...current, val];
            }
        } else {
            if (next[key] === val) delete next[key];
            else next[key] = val;
            
            // Special rules for Size/Indian Size
            if (key === 'Size') delete next['Indian Size'];
            if (key === 'Indian Size') delete next['Size'];
        }

        setFilters(next);
        setReferenceMake(null);
        setReferenceVariant(null);
        
        // Auto-close on single select, stay open on multi-select
        if (!isMulti) setOpenFilter(null);
    };

    const criteriaKeys = Object.keys(masterOptions.criteria).sort((a, b) => {
        if (activeCategory !== 'Gearboxes') return 0;
        const rank = (k) => {
            const u = k.toUpperCase();
            if (u.includes('TYPE')) return 0;
            if (u.includes('BRAND')) return 1;
            if (u === 'SIZE' || u.includes('INDIAN SIZE')) return 2;
            return 3;
        };
        return rank(a) - rank(b);
    });

    if (!activeCategory || (activeCategory === 'Gearboxes' && !selectedType)) return null;

    return (
        <section className="filter-system-v2">
            <div className="filter-bar-v2">
                {/* Gearbox Type Selector (Special Case) */}
                {activeCategory === 'Gearboxes' && masterOptions.types.length > 0 && (
                    <div 
                        className={`filter-card ${openFilter === 'gearbox_type' ? 'open active' : ''}`}
                        onClick={() => toggleFilter('gearbox_type')}
                    >
                        <span className="filter-label">Gearbox Type</span>
                        <div className="filter-value-row">
                            <span className="filter-value">{selectedType || 'Select Type'}</span>
                            <ChevronDown size={14} className="filter-chevron" />
                        </div>

                        {openFilter === 'gearbox_type' && (
                            <>
                                <div className="popover-overlay" onClick={() => setOpenFilter(null)} />
                                <div className="popover-container" ref={popoverRef} onClick={e => e.stopPropagation()}>
                                    <div className="popover-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                                        <span style={{ fontWeight: 800, color: 'white', fontSize: '0.9rem', textTransform: 'uppercase' }}>Gearbox Type</span>
                                        <X size={18} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setOpenFilter(null)} />
                                    </div>
                                    <div className="popover-grid">
                                        {masterOptions.types.map(t => (
                                            <div 
                                                key={t}
                                                className={`popover-item ${selectedType === t ? 'active' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedType(t);
                                                    setFilters({});
                                                    setReferenceMake(null);
                                                    setReferenceVariant(null);
                                                    setOpenFilter(null);
                                                }}
                                            >
                                                {t}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Dynamic Filter Cards */}
                {criteriaKeys.map(key => {
                    const selectedVal = filters[key];
                    const displayValue = Array.isArray(selectedVal) 
                        ? `${selectedVal.length} Selected` 
                        : (selectedVal || 'All');

                    return (
                        <div 
                            key={key} 
                            className={`filter-card ${openFilter === key ? 'open active' : ''} ${selectedVal ? 'active' : ''}`}
                            onClick={() => toggleFilter(key)}
                        >
                            <span className="filter-label">{key}</span>
                            <div className="filter-value-row">
                                <span className="filter-value">{displayValue}</span>
                                <ChevronDown size={14} className="filter-chevron" />
                            </div>

                            {openFilter === key && (
                                <>
                                    {/* Mobile Overlay */}
                                    <div className="popover-overlay" onClick={() => setOpenFilter(null)} />
                                    
                                    <div className="popover-container" ref={popoverRef} onClick={e => e.stopPropagation()}>
                                        <div className="popover-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                                            <span style={{ fontWeight: 800, color: 'white', fontSize: '0.9rem', textTransform: 'uppercase' }}>{key}</span>
                                            <X size={18} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setOpenFilter(null)} />
                                        </div>
                                        <div className="popover-grid" style={{ gridTemplateColumns: (key === 'HP' || key.includes('Size')) ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)' }}>
                                            {masterOptions.criteria[key].map(val => {
                                                const isAvailable = masterOptions.available[key]?.has(String(val));
                                                if (!isAvailable && filters[key] !== val) return null;
                                                
                                                const isActive = Array.isArray(filters[key])
                                                    ? filters[key].includes(val)
                                                    : filters[key] === val;

                                                return (
                                                    <div 
                                                        key={val}
                                                        className={`popover-item ${isActive ? 'active' : ''} ${!isAvailable ? 'disabled' : ''}`}
                                                        onClick={() => handleSelect(key, val, isAvailable)}
                                                    >
                                                        {val}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default FilterSystemV2;
