import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Settings,
  Zap,
  Box,
  Layers,
  X,
  CreditCard,
  Percent,
  Search,
  CheckCircle2,
  Table as TableIcon,
  Calculator,
  ArrowRightLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Target
} from 'lucide-react';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQuIU5ubtIXwz-j3TdBPeopdklMf567ywXY_tm63dxZIWRAobgDXEbpp5CR6ps55gMeXwT4nAZMlEmf/pub?output=xlsx";

function App() {
  const [makesData, setMakesData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [discounts, setDiscounts] = useState({});
  const [activeTab, setActiveTab] = useState('compare'); // 'compare' or 'calculator'

  // Selection States
  const [selectedHP, setSelectedHP] = useState('');
  const [selectedPole, setSelectedPole] = useState('');
  const [selectedMOC, setSelectedMOC] = useState('');
  const [referenceMake, setReferenceMake] = useState(null);

  // Calculator States
  const [calcTargetPrice, setCalcTargetPrice] = useState('');
  const [isCalculated, setIsCalculated] = useState(false);

  useEffect(() => {
    fetchData();
    const saved = localStorage.getItem('motorDiscounts_v2');
    if (saved) {
      try {
        setDiscounts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load discounts", e);
      }
    }
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch(`${SHEET_URL}&t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch price list.');

      const blob = await response.blob();
      const reader = new FileReader();

      reader.onload = (e) => {
        const dataArr = new Uint8Array(e.target.result);
        const workbook = XLSX.read(dataArr, { type: 'array' });

        const allMakes = {};
        const initialDiscounts = { ...discounts };

        workbook.SheetNames.forEach(sheetName => {
          // Only skip truly empty/invalid sheets, not ones named "Sheet1" by default
          if (!sheetName || sheetName.trim() === '') return;

          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length > 0) {
            const rawHeaders = jsonData[0] || [];
            const headerMap = {};
            rawHeaders.forEach((h, idx) => {
              const cleanH = String(h || '').toUpperCase().trim();
              if (cleanH.includes('HP')) headerMap['HP'] = idx;
              else if (cleanH.includes('POLE')) headerMap['Poles'] = idx;
              else if (cleanH === 'MOC' || cleanH.includes('MOUNT') || cleanH.includes('MAT')) headerMap['MOC'] = idx;
              else if (cleanH.includes('PRICE')) headerMap['List Price'] = idx;
              else if (cleanH.includes('FRAME')) headerMap['Frame'] = idx;
            });

            const rows = jsonData.slice(1).map(row => {
              const obj = {};
              Object.keys(headerMap).forEach(stdKey => {
                let val = row[headerMap[stdKey]];
                if (stdKey === 'List Price' && val !== undefined) {
                  val = typeof val === 'string' ? parseFloat(val.replace(/,/g, '').replace(/[^\d.]/g, '')) : parseFloat(val);
                }
                if (stdKey === 'HP' || stdKey === 'Poles' || stdKey === 'MOC') {
                  val = String(val || '').trim().toUpperCase().replace(/P/g, '');
                }
                obj[stdKey] = val;
              });
              return obj;
            }).filter(row => row.HP && row['List Price']);

            if (rows.length > 0) {
              allMakes[sheetName] = rows;
              if (initialDiscounts[sheetName] === undefined) {
                initialDiscounts[sheetName] = 0;
              }
            }
          }
        });

        setMakesData(allMakes);
        setDiscounts(initialDiscounts);
        setLoading(false);
      };
      reader.readAsArrayBuffer(blob);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const updateDiscount = (make, value) => {
    const newDiscounts = { ...discounts, [make]: parseFloat(value) || 0 };
    setDiscounts(newDiscounts);
    localStorage.setItem('motorDiscounts_v2', JSON.stringify(newDiscounts));
  };

  // Shared Options
  const masterHPList = useMemo(() => {
    const all = [];
    Object.values(makesData).forEach(rows => rows.forEach(r => r.HP && all.push(r.HP)));
    return [...new Set(all)].sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [makesData]);

  const masterPoleList = useMemo(() => {
    const all = [];
    Object.values(makesData).forEach(rows =>
      rows.filter(r => r.HP === selectedHP).forEach(r => r.Poles && all.push(r.Poles))
    );
    return [...new Set(all)].sort();
  }, [makesData, selectedHP]);

  const masterMOCList = useMemo(() => {
    const all = [];
    Object.values(makesData).forEach(rows =>
      rows.filter(r => r.HP === selectedHP && r.Poles === selectedPole).forEach(r => r.MOC && all.push(r.MOC))
    );
    return [...new Set(all)].sort();
  }, [makesData, selectedHP, selectedPole]);

  // MODE 1: Comparison Logic
  const comparisonData = useMemo(() => {
    if (!referenceMake || !selectedHP || !selectedPole || !selectedMOC) return null;

    const refRows = makesData[referenceMake] || [];
    const refMotor = refRows.find(r => r.HP === selectedHP && r.Poles === selectedPole && r.MOC === selectedMOC);

    if (!refMotor) return { error: `Selected motor not found in ${referenceMake}` };

    const refDiscount = discounts[referenceMake] || 0;
    const refNet = refMotor['List Price'] * (1 - refDiscount / 100);

    const otherBrands = Object.keys(makesData).map(make => {
      const motor = makesData[make].find(r => r.HP === selectedHP && r.Poles === selectedPole && r.MOC === selectedMOC);
      if (!motor) return null;

      const brandDiscount = discounts[make] || 0;
      const brandNet = motor['List Price'] * (1 - brandDiscount / 100);
      const diffINR = brandNet - refNet;
      const diffPercent = ((brandNet - refNet) / refNet) * 100;

      const equivDiscount = ((motor['List Price'] - refNet) / motor['List Price']) * 100;

      return {
        make,
        lp: motor['List Price'],
        discount: brandDiscount,
        equivDiscount,
        net: brandNet,
        diffINR,
        diffPercent,
        isRef: make === referenceMake
      };
    }).filter(Boolean);

    return { refNet, brands: otherBrands };
  }, [referenceMake, selectedHP, selectedPole, selectedMOC, makesData, discounts]);

  // MODE 2: Discount Calculator Logic
  const calcResults = useMemo(() => {
    if (!isCalculated || !selectedHP || !selectedPole || !selectedMOC || !calcTargetPrice) return [];

    return Object.keys(makesData).map(make => {
      const motor = makesData[make].find(r => r.HP === selectedHP && r.Poles === selectedPole && r.MOC === selectedMOC);
      if (!motor) return null;

      const lp = motor['List Price'];
      const tp = parseFloat(calcTargetPrice);
      const discount = lp > 0 ? ((lp - tp) / lp) * 100 : 0;

      return { make, lp, tp, discount };
    }).filter(Boolean);
  }, [isCalculated, selectedHP, selectedPole, selectedMOC, calcTargetPrice, makesData]);

  if (loading) return <div className="loading"><div className="loading-spinner"></div></div>;

  return (
    <div className="app-container">
      <header className="header" style={{ position: 'relative' }}>
        <button
          onClick={() => setShowSettings(true)}
          style={{ position: 'absolute', right: 0, top: 0, padding: '0.5rem', borderRadius: '50%', background: 'var(--bg-card)' }}
        >
          <Settings size={28} />
        </button>
        <h1>Antigravity Pro Pricing</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Multi-Brand Comparative Analysis Tool</p>
      </header>

      {/* Mode Switcher */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveTab('compare')}
          style={{ flex: 1, padding: '1rem', borderRadius: '0.8rem', border: 'none', cursor: 'pointer', background: activeTab === 'compare' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: 'white' }}
        >
          Comparative Analysis
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          style={{ flex: 1, padding: '1rem', borderRadius: '0.8rem', border: 'none', cursor: 'pointer', background: activeTab === 'calculator' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: 'white' }}
        >
          Discount Calculator
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', position: 'relative' }}>
            <button onClick={() => setShowSettings(false)} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'transparent' }}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Percent size={24} /> Set Standard Discounts</h2>
            <div style={{ display: 'grid', gap: '1rem', maxHeight: '50vh', overflowY: 'auto' }}>
              {Object.keys(makesData).map(make => (
                <div key={make} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{make}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number" value={discounts[make]}
                      onChange={(e) => updateDiscount(make, e.target.value)}
                      style={{ width: '80px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '0.4rem', color: 'white', padding: '0.4rem' }}
                    />
                    <span style={{ color: 'var(--accent)' }}>% Off</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSettings(false)} className="success-btn" style={{ width: '100%', marginTop: '1.5rem', background: 'var(--success)', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', color: 'white', border: 'none', fontWeight: 700 }}>Save Discount Structure</button>
          </div>
        </div>
      )}

      {/* Specification Selection */}
      <div className="glass-card" style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Zap size={18} color="var(--accent)" /> Configure Specification</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
          <div>
            <label className="stat-label">Power (HP)</label>
            <select value={selectedHP} onChange={(e) => { setSelectedHP(e.target.value); setSelectedPole(''); setSelectedMOC(''); setReferenceMake(null); setIsCalculated(false); }} className="custom-select">
              <option value="">Select HP</option>
              {masterHPList.map(hp => <option key={hp} value={hp}>{hp} HP</option>)}
            </select>
          </div>
          <div style={{ opacity: selectedHP ? 1 : 0.5 }}>
            <label className="stat-label">Poles</label>
            <select disabled={!selectedHP} value={selectedPole} onChange={(e) => { setSelectedPole(e.target.value); setSelectedMOC(''); setReferenceMake(null); setIsCalculated(false); }} className="custom-select">
              <option value="">Select Poles</option>
              {masterPoleList.map(p => <option key={p} value={p}>{p} Poles</option>)}
            </select>
          </div>
          <div style={{ opacity: selectedPole ? 1 : 0.5 }}>
            <label className="stat-label">MOC</label>
            <select disabled={!selectedPole} value={selectedMOC} onChange={(e) => { setSelectedMOC(e.target.value); setReferenceMake(null); setIsCalculated(false); }} className="custom-select">
              <option value="">Select MOC</option>
              {masterMOCList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* TAB 1: Comparative Analysis */}
      {activeTab === 'compare' && selectedMOC && (
        <>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Analyze with respect to Brand:</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
            {Object.keys(makesData).map(make => (
              <button
                key={make} onClick={() => setReferenceMake(make)}
                style={{
                  padding: '1rem 2rem', borderRadius: '3rem', border: 'none', cursor: 'pointer', transition: 'all 0.3s',
                  background: referenceMake === make ? 'var(--primary)' : 'var(--bg-card)', color: 'white', fontWeight: 600,
                  boxShadow: referenceMake === make ? '0 5px 15px rgba(99, 102, 241, 0.4)' : 'none'
                }}
              >
                With respect to {make}
              </button>
            ))}
          </div>

          {comparisonData && !comparisonData.error && (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ background: 'var(--primary)', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>BASE BRAND: {referenceMake}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Standard Discount: <span style={{ fontWeight: 800 }}>{discounts[referenceMake]}%</span></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, fontSize: '1.75rem' }}>₹ {Math.round(comparisonData.refNet).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Final Net Price</div>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <th style={{ padding: '1.25rem', textAlign: 'left' }}>Compare To</th>
                    <th style={{ padding: '1.25rem', textAlign: 'center' }}>Disc. Needed to Match</th>
                    <th style={{ padding: '1.25rem', textAlign: 'right' }}>Standard Net</th>
                    <th style={{ padding: '1.25rem', textAlign: 'right' }}>Price Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.brands.filter(b => !b.isRef).map((brand, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '1.25rem', fontWeight: 700 }}>{brand.make}</td>
                      <td style={{ padding: '1.25rem', textAlign: 'center' }}>
                        <span style={{ background: 'var(--primary)', padding: '0.4rem 0.8rem', borderRadius: '0.4rem', fontSize: '1rem', fontWeight: 800 }}>
                          {brand.equivDiscount.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem', textAlign: 'right' }}>₹ {Math.round(brand.net).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ color: brand.diffINR > 0 ? '#ef4444' : 'var(--success)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {brand.diffINR > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            {Math.abs(brand.diffPercent).toFixed(2)}%
                          </span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                            {brand.diffINR > 0 ? '+' : '-'} ₹ {Math.round(Math.abs(brand.diffINR)).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {comparisonData?.error && <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '1rem' }}>{comparisonData.error}</div>}
        </>
      )}

      {/* TAB 2: Discount Calculator */}
      {activeTab === 'calculator' && selectedMOC && (
        <div className="glass-card">
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            <label className="stat-label" style={{ marginBottom: '1rem', display: 'block' }}>Enter Your Target Selling Price (₹)</label>
            <div style={{ position: 'relative', marginBottom: '2rem' }}>
              <input
                type="number" placeholder="e.g. 25000" value={calcTargetPrice}
                onChange={(e) => { setCalcTargetPrice(e.target.value); setIsCalculated(false); }}
                style={{ width: '100%', padding: '1.5rem', background: 'rgba(0,0,0,0.3)', border: '2px solid var(--glass-border)', color: 'white', borderRadius: '1rem', fontSize: '1.5rem', paddingLeft: '3rem' }}
              />
              <Target size={24} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            </div>
            <button
              disabled={!calcTargetPrice} onClick={() => setIsCalculated(true)}
              style={{ width: '100%', padding: '1.5rem', background: 'var(--accent)', color: 'var(--bg-dark)', border: 'none', borderRadius: '1rem', fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer' }}
            >
              Analyze Required Discounts
            </button>
          </div>

          {isCalculated && (
            <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {calcResults.map((r, i) => (
                <div key={i} className="glass-card" style={{ borderTop: '4px solid var(--accent)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>{r.make}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                    <span style={{ opacity: 0.6 }}>Official List Price:</span>
                    <span>₹ {r.lp.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '1rem', color: 'var(--accent)' }}>Required Discount</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--success)' }}>{r.discount.toFixed(2)}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedMOC && !loading && (
        <div style={{ textAlign: 'center', marginTop: '6rem', opacity: 0.1 }}>
          <CheckCircle2 size={120} style={{ margin: '0 auto' }} />
          <p style={{ fontSize: '1.5rem', marginTop: '1rem' }}>Awaiting Specifications...</p>
        </div>
      )}

      <style>{`
        .custom-select { width: 100%; padding: 1rem; border-radius: 0.8rem; background: rgba(15, 23, 42, 0.9); color: white; border: 1px solid var(--glass-border); outline: none; cursor: pointer; font-size: 1rem; }
        .success-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
        th { color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
      `}</style>
    </div>
  );
}

export default App;
