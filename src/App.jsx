import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, Search, RefreshCw } from 'lucide-react';

// Specialized Components
import Navbar from './components/layout/Navbar';
import AuthWall from './components/auth/AuthWall';
import CategorySwitcher from './components/selectors/CategorySwitcher';
import FilterSystem from './components/selectors/FilterSystem';
import FilterSystemV2 from './components/selectors/FilterSystemV2';
import ComparisonResults from './components/pricing/ComparisonResults';
// Custom Hooks & Services
import { usePriceEngine } from './hooks/usePriceEngine';
import { calculateComparison } from './services/pricingService';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("App Crash:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100vh', background: '#020617', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={64} color="#ef4444" style={{ marginBottom: '2rem' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem' }}>Application Crashed</h1>
          <p style={{ color: '#94a3b8', maxWidth: '500px', marginBottom: '2rem' }}>{this.state.error?.message || "An unexpected error occurred in the UI."}</p>
          <button onClick={() => window.location.reload()} style={{ background: '#6366f1', color: '#fff', padding: '1rem 2rem', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Restart Application</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const {
    makesData, fieldConfig, loading, error,
    discounts, config, lastRefreshed, discountRules, discountsFromSheet,
    isAuthenticated, authEmail, userRole, userDeviation,
    fetchData, verifyAccess, logout, updateConfig, updateDiscount
  } = usePriceEngine();


  const [activeCategory, setActiveCategory] = useState('Motors');
  const [selectedType, setSelectedType] = useState('Standard');
  const [filters, setFilters] = useState({});
  const [referenceMake, setReferenceMake] = useState(null);
  const [referenceVariant, setReferenceVariant] = useState(null);
  const [activePillField, setActivePillField] = useState(null);
  const [showV2, setShowV2] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(false);
  const [authEmailInput, setAuthEmailInput] = useState('');

  const handleVerifyAccess = async (email) => {
    setIsAuthChecking(true);
    setAuthError(null);
    const result = await verifyAccess(email);
    if (!result.success) {
      setAuthError(result.error);
    }
    setIsAuthChecking(false);
  };

  const masterOptions = useMemo(() => {
    const categories = new Set();
    const typesByCategory = {};
    const allRows = Object.values(makesData).flat();

    allRows.forEach(r => {
      categories.add(r._category);
      if (!typesByCategory[r._category]) typesByCategory[r._category] = new Set();
      typesByCategory[r._category].add(r._type);
    });

    const currentTypes = Array.from(typesByCategory[activeCategory] || []).sort();
    const effectiveType = (activeCategory === 'Motors' || activeCategory === 'Drives') ? (currentTypes[0] || 'Standard') : selectedType;
    const relevantRows = allRows.filter(r => r._category === activeCategory && r._type === effectiveType);
    const inputFields = Object.keys(fieldConfig).filter(k => fieldConfig[k] === 'input');

    const criteria = {};
    const available = {};

    inputFields.forEach(f => {
      const vals = new Set();
      relevantRows.forEach(r => { if (r[f]) vals.add(r[f]); });

      if (vals.size > 0) {
        criteria[f] = Array.from(vals).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

        const otherFilters = { ...filters };
        delete otherFilters[f];
        const avail = new Set();
        relevantRows.filter(r => Object.keys(otherFilters).every(k => !otherFilters[k] || String(r[k]) === String(otherFilters[k]))).forEach(r => avail.add(String(r[f])));
        available[f] = avail;
      }
    });

    return { categories: Array.from(categories).sort(), types: currentTypes, criteria, available };
  }, [makesData, activeCategory, selectedType, filters, fieldConfig]);

  const comparisonData = useMemo(() => {
    return calculateComparison(referenceVariant, filters, activeCategory, makesData, discounts, discountRules, config, userDeviation);
  }, [referenceVariant, filters, activeCategory, makesData, discounts, discountRules, config, userDeviation]);

  const highlights = useMemo(() => {
    if (!comparisonData || comparisonData.brands.length < 2) return null;
    const sorted = [...comparisonData.brands].sort((a, b) => a.net - b.net);
    return { best: sorted[0], worst: sorted[sorted.length - 1] };
  }, [comparisonData]);

  useEffect(() => {
    const isFullyFiltered = Object.keys(masterOptions.criteria).every(k => filters[k]);
    if (isFullyFiltered) {
      const allRows = Object.values(makesData).flat();
      const match = allRows.find(r => r._category === activeCategory && Object.keys(masterOptions.criteria).every(k => String(r[k]) === String(filters[k])));
      if (match) {
        setReferenceMake(match.Brand || match.Make);
        setReferenceVariant(match);
      }
    }
  }, [filters, masterOptions.criteria, makesData, activeCategory]);

  const exportToExcel = () => {
    if (!comparisonData) return;
    const ws = XLSX.utils.json_to_sheet(comparisonData.brands.map(b => ({
      Make: b.make,
      'List Price': b.lp,
      'Net Price': Math.round(b.net),
      'Gap %': b.isRef ? 'REF' : b.diffPercent.toFixed(2) + '%'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison");
    XLSX.writeFile(wb, `${activeCategory}_Comparison.xlsx`);
  };

  if (loading && !Object.keys(makesData).length) {
    return (
      <div className="layout" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <RefreshCw size={48} className="spinning" color="#6366f1" />
        <p style={{ marginTop: '1.5rem', color: '#64748b', fontWeight: 700 }}>Orchestrating Pricing Engine...</p>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar isAuthenticated={isAuthenticated} loading={loading} lastRefreshed={lastRefreshed} fetchData={fetchData} logout={logout} />

      {!isAuthenticated ? (
        <AuthWall authEmail={authEmailInput} setAuthEmail={setAuthEmailInput} authError={authError} setAuthError={setAuthError} isAuthChecking={isAuthChecking} verifyAccess={handleVerifyAccess} />
      ) : (
        <main className="container">
          {error && <div className="error-box"><AlertCircle size={20} /> {error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: showV2 ? 'var(--primary)' : '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              V2 Compact UI Beta
            </span>
            <button 
              onClick={() => setShowV2(!showV2)}
              style={{
                background: showV2 ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                border: '1px solid',
                borderColor: showV2 ? 'transparent' : 'var(--glass-border)',
                borderRadius: '20px',
                padding: '0.4rem 1rem',
                fontSize: '0.7rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: showV2 ? '0 0 15px rgba(99, 102, 241, 0.4)' : 'none'
              }}
            >
              {showV2 ? 'SWITCH TO CLASSIC' : 'TRY NEW DESIGN'}
            </button>
          </div>

          <CategorySwitcher
            categories={masterOptions.categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory}
            makesData={makesData} setSelectedType={setSelectedType} setFilters={setFilters}
            setReferenceMake={setReferenceMake} setReferenceVariant={setReferenceVariant}
          />

          {!showV2 ? (
            <FilterSystem
              activeCategory={activeCategory} selectedType={selectedType} setSelectedType={setSelectedType}
              masterOptions={masterOptions} filters={filters} setFilters={setFilters}
              setReferenceMake={setReferenceMake} setReferenceVariant={setReferenceVariant}
            />
          ) : (
            <FilterSystemV2
              activeCategory={activeCategory} selectedType={selectedType} setSelectedType={setSelectedType}
              masterOptions={masterOptions} filters={filters} setFilters={setFilters}
              setReferenceMake={setReferenceMake} setReferenceVariant={setReferenceVariant}
            />
          )}

          {referenceVariant ? (
            <ComparisonResults
              activeCategory={activeCategory} comparisonData={comparisonData} userRole={userRole} highlights={highlights}
              exportToExcel={exportToExcel} fieldConfig={fieldConfig} activePillField={activePillField}
              setActivePillField={setActivePillField} filters={filters} masterOptions={masterOptions}
              setFilters={setFilters} setReferenceMake={setReferenceMake} setReferenceVariant={setReferenceVariant}
              referenceMake={referenceMake}
            />
          ) : (
            <div className="empty-state-lrg fadeInUp" style={{ marginTop: '2rem' }}>
              <Search size={48} color="var(--primary)" opacity={0.5} />
              <h3 style={{ marginTop: '1.5rem' }}>Configure Your Selection</h3>
              <p style={{ color: '#64748b' }}>Select all technical parameters above to generate a price comparison.</p>
              <div className="scroll-container" style={{ marginTop: '1.5rem' }}>
                {Object.keys(masterOptions.criteria).map(k => (
                  <span key={k} style={{ padding: '0.4rem 1rem', borderRadius: '10px', background: filters[k] ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)', color: filters[k] ? '#10b981' : '#475569', fontSize: '0.8rem', fontWeight: 700, border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}>
                    {k}: {filters[k] ? '✓' : '...'}
                  </span>
                ))}
              </div>
            </div>
          )}

        </main>
      )}
    </div>
  );
}

export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
