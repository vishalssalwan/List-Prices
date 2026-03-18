import React from 'react';
import { Zap, ArrowRightLeft, Layers } from 'lucide-react';

const CategorySwitcher = ({
    categories,
    activeCategory,
    setActiveCategory,
    makesData,
    setSelectedType,
    setFilters,
    setReferenceMake,
    setReferenceVariant
}) => {
    return (
        <div className="product-hub-header" style={{ marginBottom: '2.5rem' }}>
            <div className="hub-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', marginBottom: '1rem', textAlign: 'center' }}>
                Product Intelligence Hub
            </div>
            <div className="scroll-container">
                {categories.map(c => (
                    <button
                        key={c}
                        className={`nav-btn ${activeCategory === c ? 'active' : ''}`}
                        style={{
                            padding: '1rem 2rem',
                            borderRadius: '16px',
                            backgroundColor: activeCategory === c ? 'rgba(99, 102, 241, 0.1)' : 'var(--surface)',
                            borderColor: activeCategory === c ? 'var(--primary)' : 'var(--glass-border)',
                            color: activeCategory === c ? 'white' : 'var(--text-dim)',
                            fontSize: '1.1rem',
                            fontWeight: 700
                        }}
                        onClick={() => {
                            setActiveCategory(c);
                            const types = Array.from(new Set(Object.values(makesData).flat().filter(r => r._category === c).map(r => r._type)));
                            setSelectedType((c === 'Motors' || c === 'Drives') ? 'Standard' : (types[0] || 'All'));
                            setFilters({});
                            setReferenceMake(null);
                            setReferenceVariant(null);
                        }}
                    >
                        {c === 'Motors' ? <Zap size={18} /> : c === 'Drives' ? <ArrowRightLeft size={18} /> : <Layers size={18} />}
                        {c}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default CategorySwitcher;
