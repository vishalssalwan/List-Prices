import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Settings, Zap, Layers, X, Percent, Search, CheckCircle2,
  ArrowRightLeft, TrendingDown, TrendingUp, Target, Sliders,
  Download, Trophy, BarChart3, Info, AlertCircle, RefreshCw,
  Lock, Mail, ChevronRight, LogOut, ShieldCheck
} from 'lucide-react';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? "http://localhost:4000/api"
    : "https://list-prices.onrender.com/api";
};
const API_URL = getApiUrl();

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
  const [makesData, setMakesData] = useState({});
  const [fieldConfig, setFieldConfig] = useState({}); // { fieldName: 'input' | 'display' }
  const [dimensionsData, setDimensionsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [discounts, setDiscounts] = useState({});
  const [config, setConfig] = useState({
    lowFrameSurcharge: 3,
    highFrameSurcharge: 5,
    profitMargin: 10
  });
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Motors');
  const [selectedType, setSelectedType] = useState('All');
  const [discountsFromSheet, setDiscountsFromSheet] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [userRole, setUserRole] = useState('user'); // 'admin' or 'user'
  const [isAuthChecking, setIsAuthChecking] = useState(false);
  const [authError, setAuthError] = useState(null);
  const resultsRef = useRef(null);

  const [filters, setFilters] = useState({});
  const [referenceMake, setReferenceMake] = useState(null);
  const [referenceVariant, setReferenceVariant] = useState(null); // Full row object for EXACT match
  const [discountRules, setDiscountRules] = useState([]);
  const [activePillField, setActivePillField] = useState(null);



  useEffect(() => {
    try {
      const auth = localStorage.getItem('userAuthenticated');
      const role = localStorage.getItem('userRole');
      if (auth === 'true') {
        setIsAuthenticated(true);
        setUserRole(role || 'user');
        fetchData();
      } else {
        setLoading(false);
      }

      const savedDiscounts = localStorage.getItem('motorDiscounts_v4');
      const savedConfig = localStorage.getItem('motorConfig_v4');
      if (savedDiscounts) setDiscounts(JSON.parse(savedDiscounts));
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error("Initialization error", e);
      setLoading(false);
      setIsAuthenticated(false);
    }
  }, []);

  const verifyAccess = async (email) => {
    if (!email || !email.includes('@')) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    try {
      setIsAuthChecking(true);
      setAuthError(null);

      // Assuming axios is imported or available globally, as per the provided change.
      // If not, this line will cause an error.
      const response = await fetch(`${API_URL}/auth?email=${encodeURIComponent(email)}&t=${Date.now()}`);

      if (!response.ok && response.status !== 304) throw new Error("Auth server unreachable.");

      const { authorized, role } = await response.json();

      if (authorized) {
        setIsAuthenticated(true);
        setUserRole(role);
        setAuthEmail(email);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userAuthenticated', 'true');
        localStorage.setItem('userRole', role);
        fetchData();
      } else {
        setAuthError('Email not authorized for access.');
      }
    } catch (err) {
      console.error("Auth Error:", err);
      setAuthError("Auth sync failed. Try again.");
    } finally {
      setIsAuthChecking(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setAuthEmail('');
    setUserRole('user');
    setMakesData({});
  };

  const updateConfig = (key, value) => {
    const next = { ...config, [key]: parseFloat(value) || 0 };
    setConfig(next);
    localStorage.setItem('motorConfig_v4', JSON.stringify(next));
  };

  const updateDiscount = (key, value) => {
    const normKey = String(key).toUpperCase().trim();
    const next = { ...discounts, [normKey]: parseFloat(value) || 0 };
    setDiscounts(next);
    localStorage.setItem('motorDiscounts_v4', JSON.stringify(next));
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/data?t=${Date.now()}`);

      if (!response.ok) throw new Error('API server unreachable.');

      const data = await response.json();
      const { makesData: apiData, fieldConfig: apiFields, dimensionsData: apiDims, sheetDiscounts: apiDiscounts, discountRules: apiRules, lastRefreshed: apiTime } = data;

      if (!apiData || Object.keys(apiData).length === 0) {
        setError("No data returned from engine.");
      } else {
        setMakesData(apiData);
        setFieldConfig(apiFields || {});
        setDimensionsData(apiDims || {});
        setDiscountRules(apiRules || []);
        setDiscountsFromSheet(Object.keys(apiDiscounts || {}).length > 0);

        setDiscounts(() => {
          const next = {};
          // Load fresh from sheet
          Object.keys(apiDiscounts || {}).forEach(k => next[String(k).toUpperCase().trim()] = apiDiscounts[k]);

          // Ensure basic existence (back-fill for missing makes)
          Object.keys(apiData).forEach(m => {
            const motors = (apiData[m] || []);
            const mocs = Array.from(new Set(motors.map(r => (r.MOC || 'CI').toUpperCase().trim())));
            const uM = String(m).toUpperCase().trim();
            mocs.forEach(moc => {
              const k = `${uM}-${moc}`;
              if (!next[k]) next[k] = 0;
            });
          });
          return next;
        });

        setLastRefreshed(apiTime || new Date().toISOString());
        console.log(`[SYNC] App data synchronized at ${new Date().toLocaleTimeString()}.`);

        // Default Selections
        if (activeCategory === 'Motors' && selectedType === 'All') {
          const allRows = Object.values(apiData).flat();
          const validCats = Array.from(new Set(allRows.map(r => r._category)));
          const defaultCat = validCats.includes('Motors') ? 'Motors' : validCats[0];
          setActiveCategory(prev => prev || defaultCat);
          const defaultType = allRows.find(r => r._category === defaultCat)?._type || 'Standard';
          setSelectedType(prev => prev === 'All' ? defaultType : prev);
        }
      }
    } catch (err) {
      console.error("Fetch/Sync Error:", err);
      if (!Object.keys(makesData).length) {
        setError("Sync failed: Backend connection error.");
      } else {
        // Just a subtle notification if data already exists
        console.warn("Sync failed, keeping existing data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getAdjustedPrice = useCallback((lp, frame, mount, category) => {
    if (category !== 'Motors') return lp;
    if (mount !== 'Flange') return lp;
    const fNum = parseInt(String(frame || '').replace(/\D/g, ''));
    if (isNaN(fNum)) return lp;
    return lp * (1 + (fNum <= 160 ? config.lowFrameSurcharge : config.highFrameSurcharge) / 100);
  }, [config]);

  const masterOptions = useMemo(() => {
    const categories = new Set();
    const typesByCategory = {}; // { Cat: Set }
    const allRows = Object.values(makesData).flat();

    allRows.forEach(r => {
      categories.add(r._category);
      if (!typesByCategory[r._category]) typesByCategory[r._category] = new Set();
      typesByCategory[r._category].add(r._type);
    });

    const currentTypes = Array.from(typesByCategory[activeCategory] || []).sort();
    const effectiveType = (activeCategory === 'Motors' || activeCategory === 'Drives') ? (currentTypes[0] || 'Standard') : selectedType;
    const relevantRows = allRows.filter(r => r._category === activeCategory && r._type === effectiveType);

    // Identify input fields (detected from Excel Row 1)
    const inputFields = Object.keys(fieldConfig).filter(k => fieldConfig[k] === 'input');

    // Core Criteria (All possible values)
    const criteriaValues = {};
    inputFields.forEach(f => {
      const values = new Set();
      relevantRows.forEach(r => { if (r[f]) values.add(r[f]); });
      if (values.size > 0) {
        criteriaValues[f] = Array.from(values).sort((a, b) => {
          const getVal = (s) => parseFloat(String(s).replace(/[^\d.]/g, '')) || 0;
          const na = getVal(a), nb = getVal(b);
          return (na !== nb) ? na - nb : String(a).localeCompare(String(b), undefined, { numeric: true });
        });
      }
    });

    // Dynamic Options (Available given CURRENT filters)
    // For each field, what values exist in rows that match ALL OTHER selected filters?
    const availableCriteria = {};
    inputFields.forEach(f => {
      const otherFilters = { ...filters };
      delete otherFilters[f]; // Forget current selection for THIS field to see all alternatives

      const possibleRows = relevantRows.filter(r => {
        return Object.keys(otherFilters).every(k => {
          const fV = otherFilters[k];
          if (!fV || !r[k]) return true;
          if (Array.isArray(fV)) return fV.some(v => String(r[k]).toUpperCase() === String(v).toUpperCase());
          return String(r[k]).toUpperCase() === String(fV).toUpperCase();
        });
      });

      const avail = new Set();
      possibleRows.forEach(r => { if (r[f]) avail.add(String(r[f])); });
      availableCriteria[f] = avail;
    });

    const finalCriteria = { ...criteriaValues };
    if (activeCategory === 'Gearboxes') {
      delete finalCriteria['Model'];
    }

    return {
      categories: Array.from(categories).sort(),
      types: currentTypes,
      criteria: finalCriteria,
      available: availableCriteria
    };
  }, [makesData, activeCategory, selectedType, filters, fieldConfig]);

  const comparisonData = useMemo(() => {
    if (!referenceMake || !referenceVariant) return null;

    // Filters to match other brands (Everything marked input EXCEPT Brand itself)
    const matchKeys = Object.keys(masterOptions.criteria).filter(k => k !== 'Brand');

    const filterKeys = Object.keys(masterOptions.criteria);
    const filtersMatchRef = filterKeys.every(k => {
      const fV = filters[k];
      if (!fV) return true;
      if (Array.isArray(fV)) return fV.includes(referenceVariant[k]);
      return fV === referenceVariant[k];
    });
    if (!filtersMatchRef) return null;

    const refMotor = referenceVariant;
    const refAdjLp = getAdjustedPrice(refMotor['List Price'], refMotor.Frame || '', filters['Mounting'] || 'Foot', activeCategory);
    const getVal = (obj, key) => {
      if (!obj) return null;
      if (obj[key] !== undefined) return obj[key];
      const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace('EFFECIENCY', 'EFFICIENCY');
      const targetK = norm(key);
      const isBrandLookup = targetK === 'BRAND' || targetK === 'MAKE' || targetK === 'MFG' || targetK === 'MANUFACTURER';
      const foundKey = Object.keys(obj).find(k => {
        const nk = norm(k);
        if (isBrandLookup && (nk === 'BRAND' || nk === 'MAKE' || nk === 'MFG' || nk === 'MANUFACTURER' || nk === 'BRANDNAME')) return true;
        if ((targetK === 'MOC' || targetK === 'MATERIAL') && (nk === 'MOC' || nk === 'MATERIAL')) return true;
        if ((targetK === 'EFFECIENCY' || targetK === 'EFFICIENCY') && (nk === 'EFFECIENCY' || nk === 'EFFICIENCY')) return true;
        if ((targetK === 'APPLICATION') && (nk === 'APPLICATION' || nk === 'APPTYPE')) return true;
        if ((targetK === 'HP' || targetK === 'KW') && (nk === 'HP' || nk === 'KW' || nk === 'CAPACITY')) return true;
        if ((targetK === 'POLES') && (nk === 'POLES' || nk === 'POLE' || nk === 'RPM')) return true;
        if ((targetK === 'DUTYTYPE' || targetK === 'DUTY') && (nk === 'DUTYTYPE' || nk === 'DUTY')) return true;
        return nk.includes(targetK) || targetK.includes(nk);
      });
      return foundKey ? obj[foundKey] : null;
    };

    const normalize = (s) => {
      let up = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (up === 'BBL' || up.includes('BHARATBIJLEE')) return 'BHARATBIJLEE';
      if (up === 'CG' || up === 'CROMPTON' || up.includes('CROMPTONGREAVES')) return 'CROMPTONGREAVES';
      if (up === 'SIEMENS') return 'SIEMENS';
      if (up === 'ABB') return 'ABB';
      if (up === 'PREMIUM') return 'PREMIUM';
      if (up === 'ELECON') return 'ELECON';
      return up;
    };

    const lookupDiscount = (row) => {
      let baseDiscount = 0;
      let matchedIdx = -1;

      const idx = discountRules.findIndex(rule => {
        const rowVal = (k) => String(getVal(row, k) || '').toUpperCase().trim();
        const ruleVal = (k) => String(getVal(rule._raw, k) || '').toUpperCase().trim();

        const isIgnored = (k) => {
          const rV = ruleVal(k);
          if (!rV || rV === 'ALL') return true;
          const rowHas = getVal(row, k) !== null && getVal(row, k) !== undefined && String(getVal(row, k)).trim() !== '';
          if (!rowHas) return true;
          return false;
        };

        const rowCat = String(row._category || '').toUpperCase();
        const rowType = String(row._type || '').toUpperCase();
        const rowSub = String(row._subCategory || '').toUpperCase();
        const rowSheet = String(row._sheet || '').toUpperCase();

        const pMatch = !ruleVal('PRODUCT') ||
          ruleVal('PRODUCT') === 'ALL' ||
          ruleVal('PRODUCT').split(',').some(p => {
            const up = normalize(p);
            const rC = normalize(rowCat);
            const rType = normalize(rowType);
            const rSub = normalize(rowSub);
            const rSheet = normalize(rowSheet);
            if (up === rSheet || up === rC || up === rSub || up === rType) return true;
            if (rSheet.includes(up) || up.includes(rSheet)) return true;
            if (rC.includes(up) || up.includes(rC)) return true;
            const uP = up.replace(/S$/, '');
            const rCS = rC.replace(/S$/, '');
            const rSS = rSheet.replace(/S$/, '');
            if (uP === rCS || rCS.includes(uP) || uP.includes(rCS) || uP === rSS || rSS.includes(uP)) return true;
            return false;
          }) || (rule._tableName && (
            normalize(rule._tableName) === normalize(rowCat) ||
            normalize(rule._tableName) === normalize(rowSheet) ||
            normalize(rowSheet).includes(normalize(rule._tableName))
          ));

        const brandMatch = () => {
          if (isIgnored('BRANDNAME')) return true;
          const rBrand = ruleVal('BRANDNAME');
          const rowBrand = getVal(row, 'Brand') || getVal(row, 'Make') || '';
          const rs = rowSheet;
          const nrBrand = normalize(rBrand);
          const nRowBrand = normalize(rowBrand);
          const nRowSheet = normalize(rs);
          if (nRowBrand === nrBrand || nRowSheet === nrBrand) return true;
          if (rs.includes(nrBrand) || nrBrand.includes(rs) || rs.includes(rBrand) || rBrand.includes(rs)) return true;
          if (nRowBrand.includes(nrBrand) || nrBrand.includes(nRowBrand)) return true;
          return false;
        };

        const aMatch = isIgnored('APPLICATION') || rowVal('APPLICATION') === ruleVal('APPLICATION');
        const dMatch = isIgnored('DUTYTYPE') || rowVal('DUTYTYPE') === ruleVal('DUTYTYPE');
        const eMatch = isIgnored('EFFICIENCY') || rowVal('EFFICIENCY') === ruleVal('EFFICIENCY');
        const mMatch = isIgnored('MOC') || ruleVal('MOC').split(',').map(s => s.trim().toUpperCase()).includes(rowVal('MOC')) || ruleVal('MOC').split(',').map(s => s.trim().toUpperCase()).includes(rowVal('MATERIAL'));

        return pMatch && aMatch && dMatch && eMatch && brandMatch() && mMatch;
      });

      if (idx !== -1) {
        baseDiscount = discountRules[idx]._discount;
        matchedIdx = idx;
      } else {
        const rowBrand = getVal(row, 'Brand') || getVal(row, 'Make') || row._sheet || '';
        const make = normalize(rowBrand);
        const moc = String(getVal(row, 'MOC') || getVal(row, 'Material') || 'CI').toUpperCase().trim();
        baseDiscount = discounts[`${make}-${moc}`] || discounts[make] || 0;
      }
      return { discount: baseDiscount, idx: matchedIdx };
    };

    const refLookup = lookupDiscount(refMotor);
    const refDisc = refLookup.discount;
    const refNet = refAdjLp * (1 - refDisc / 100);

    const brands = Object.keys(makesData).flatMap(make => {
      const matches = (makesData[make] || []).filter(r => {
        if (r._category !== activeCategory) return false;
        if ((activeCategory === 'Motors' || activeCategory === 'Drives') && r._type !== (masterOptions.types[0] || 'Standard')) return false;

        return matchKeys.every(k => {
          const val = r[k];
          const refVal = refMotor[k];
          const fV = filters[k];

          if (Array.isArray(fV)) return fV.some(v => String(r[k]).toUpperCase() === String(v).toUpperCase());
          if (!refVal) return true;

          const clean = (s) => String(s || '').replace('1:', '').replace(/\s/g, '').toUpperCase();
          if (k === 'Ratio' || k === 'Size' || k === 'Model' || k.toUpperCase().includes('SIZE')) {
            return clean(val) === clean(refVal);
          }
          return String(val).toUpperCase() === String(refVal).toUpperCase();
        });
      });

      const variants = {};
      matches.forEach(m => {
        const vKey = `${m.Frame || ''}-${m.MOC || ''}-${m.Size || ''}-${m.Ratio || ''}-${m.Model || ''}`;
        if (!variants[vKey] || m['List Price'] < variants[vKey]['List Price']) {
          variants[vKey] = m;
        }
      });

      return Object.values(variants).map(motor => {
        const motorLookup = lookupDiscount(motor);
        const motorDiscount = motorLookup.discount;

        const adjLp = getAdjustedPrice(motor['List Price'], motor.Frame || '', filters['Mounting'] || 'Foot', activeCategory);
        const net = adjLp * (1 - motorDiscount / 100);

        const isBaseline = make === referenceMake && JSON.stringify(motor) === JSON.stringify(refMotor);

        return {
          id: `${make}-${motor['List Price']}-${motor.Frame || ''}-${motor.MOC || ''}-${motor.Size || ''}`,
          make, lp: motor['List Price'], adjLp, net,
          moc: motor.MOC,
          frame: motor.Frame,
          discount: motorDiscount,
          rowRaw: motor,
          diffINR: net - refNet,
          diffPercent: refNet > 0 ? ((net - refNet) / refNet) * 100 : 0,
          equivDiscount: adjLp > 0 ? ((adjLp - refNet) / adjLp) * 100 : 0,
          isRef: isBaseline
        };
      });
    }).sort((a, b) => a.net - b.net);

    const totalDiscsLoaded = Object.keys(discounts).length;

    return {
      refNet,
      brands,
      refLp: refMotor['List Price'] || 0,
      refMotor,
      refDiscount: refDisc,
      debug: {
        base: refDisc,
        rules: discountRules.length,
        fallbackCount: totalDiscsLoaded,
        matchedIdx: refLookup.idx !== -1 ? refLookup.idx + 1 : 'FB'
      }
    };
  }, [referenceMake, referenceVariant, filters, activeCategory, makesData, discounts, discountRules, masterOptions, getAdjustedPrice]);

  // Auto-select reference when filters match products
  useEffect(() => {
    if (Object.keys(filters).length === 0) {
      setReferenceMake(null);
      setReferenceVariant(null);
      return;
    }

    const matchKeys = Object.keys(masterOptions.criteria);
    const isFullyFiltered = matchKeys.every(k => filters[k]);

    if (isFullyFiltered) {
      // For multi-select fields, we pick the first selected variant as reference
      const targetBrand = filters['Brand'];
      let foundVariant = null;
      let foundMake = null;

      const makesToSearch = targetBrand ? [targetBrand] : Object.keys(makesData);

      for (const m of makesToSearch) {
        const matches = (makesData[m] || []).filter(r => {
          if (r._category !== activeCategory) return false;
          if ((activeCategory === 'Motors' || activeCategory === 'Drives') && r._type !== (masterOptions.types[0] || 'Standard')) return false;
          if (activeCategory === 'Gearboxes' && r._type !== selectedType) return false;
          return matchKeys.every(k => {
            const fV = filters[k];
            if (!fV) return true;
            if (Array.isArray(fV)) return fV.some(v => String(r[k]).toUpperCase() === String(v).toUpperCase());
            return String(r[k]).toUpperCase() === String(fV).toUpperCase();
          });
        });

        if (matches.length > 0) {
          foundVariant = matches[0];
          foundMake = m;
          break;
        }
      }

      if (foundVariant && (foundMake !== referenceMake || JSON.stringify(foundVariant) !== JSON.stringify(referenceVariant))) {
        setReferenceMake(foundMake);
        setReferenceVariant(foundVariant);
      }
    }
  }, [filters, makesData, activeCategory, selectedType, masterOptions.criteria, masterOptions.types, referenceMake, referenceVariant]);

  // Size <-> Indian Size Sync Logic
  useEffect(() => {
    if (activeCategory !== 'Gearboxes') return;

    const size = filters['Size'];
    const indianSize = filters['Indian Size'];

    // Auto-update Indian Sizes when a Size is picked
    if (size && !Array.isArray(size)) {
      const allRowsForType = Object.values(makesData).flat().filter(r => r._category === 'Gearboxes' && r._type === selectedType);
      const matches = Array.from(new Set(allRowsForType.filter(r => String(r['Size']).toUpperCase() === String(size).toUpperCase()).map(r => r['Indian Size']).filter(Boolean)));

      if (matches.length > 0 && JSON.stringify(indianSize) !== JSON.stringify(matches)) {
        setFilters(prev => ({ ...prev, 'Indian Size': matches }));
      }
    }

    // Auto-update Size when Indian Sizes are picked
    if (indianSize && Array.isArray(indianSize) && indianSize.length > 0) {
      const allRowsForType = Object.values(makesData).flat().filter(r => r._category === 'Gearboxes' && r._type === selectedType);
      const parentSizes = Array.from(new Set(allRowsForType.filter(r => indianSize.includes(r['Indian Size'])).map(r => r['Size']).filter(Boolean)));

      if (parentSizes.length === 1 && size !== parentSizes[0]) {
        setFilters(prev => ({ ...prev, 'Size': parentSizes[0] }));
      }
    }
  }, [filters, activeCategory, selectedType, makesData]);



  // Auto-select benchmark for gearboxes to skip that step
  useEffect(() => {
    if (activeCategory === 'Gearboxes' && selectedType !== 'All' && !referenceVariant) {
      const filterKeys = Object.keys(masterOptions.criteria);
      if (filterKeys.length > 0 && filterKeys.every(k => filters[k])) {
        // Find first valid brand match within the selectedType (sheet)
        for (const m of Object.keys(makesData)) {
          const match = (makesData[m] || []).find(r =>
            r._category === 'Gearboxes' &&
            r._type === selectedType && // selectedType is now the sheetName
            filterKeys.every(k => r[k] === filters[k])
          );
          if (match) {
            setReferenceMake(m);
            setReferenceVariant(match);
            break;
          }
        }
      }
    }
  }, [activeCategory, selectedType, filters, masterOptions, makesData, referenceVariant]);

  const highlights = useMemo(() => {
    if (!comparisonData || comparisonData.brands.length < 2) return null;
    const sorted = [...comparisonData.brands].sort((a, b) => a.net - b.net);
    return { best: sorted[0], worst: sorted[sorted.length - 1] };
  }, [comparisonData]);

  // Global error safety for render - placed after hooks
  if (error && !makesData) {
    return (
      <div className="layout" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '2rem' }}>
        <div className="logo" style={{ position: 'fixed', top: '2rem', left: '2rem' }}>Antigravity <span>PRO</span></div>
        <AlertCircle size={60} color="#f87171" />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '1rem' }}>Application Refusal</h2>
          <p style={{ color: '#94a3b8', maxWidth: '400px' }}>{error}</p>
        </div>
        <button className="nav-btn" onClick={() => window.location.reload()} style={{ padding: '1rem 2rem' }}><RefreshCw size={18} /> Hard Restart</button>
      </div>
    );
  }

  const exportToExcel = () => {
    if (!comparisonData) return;
    const data = comparisonData.brands.map(b => {
      const row = { 'Make': b.make };
      // Add all current filters as columns
      Object.keys(filters).forEach(fk => row[fk] = filters[fk]);
      // Add MOC and Frame if they exist in the raw data and not already covered by filters
      if (b.moc && !filters.MOC) row['MOC'] = b.moc;
      if (b.frame && !filters.Frame) row['Frame'] = b.frame;
      if (b.rowRaw.Model && !filters.Model) row['Model'] = b.rowRaw.Model; // Add Model for gearboxes

      row['List Price'] = b.lp;
      row['Net Price'] = Math.round(b.net);
      row['Gap %'] = b.isRef ? 'REF' : b.diffPercent.toFixed(2) + '%';
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison");
    XLSX.writeFile(wb, `${activeCategory}_Comparison.xlsx`);
  };

  return (
    <div className="layout">
      <header className="navbar">
        <div className="logo">Antigravity <span>PRO</span></div>
        <div className="nav-actions">
          {isAuthenticated ? (
            <>
              <div className={`resync-timer ${loading ? 'active' : ''}`}>
                <span className={`sync-dot ${loading ? 'busy' : ''}`} />
                {loading ? 'Crunching Sheets...' : `Last Sync: ${lastRefreshed ? new Date(lastRefreshed).toLocaleTimeString() : 'Refreshing...'}`}
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
              >
                <RefreshCw size={22} color={loading ? '#94a3b8' : '#f87171'} strokeWidth={3} />
              </button>
              <button className="nav-btn" onClick={logout} title="Logout"><LogOut size={18} color="#94a3b8" /></button>
            </>
          ) : (
            <div className="guest-badge">Secure Access Portal</div>
          )}
        </div>
      </header>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
          <RefreshCw size={48} className="spinning" color="#6366f1" />
          <p style={{ marginTop: '1.5rem', color: '#64748b', fontWeight: 700 }}>Initializing Live Data Engine...</p>
        </div>
      ) : !isAuthenticated ? (
        <main className="auth-wall-container">
          <div className="auth-card">
            <div className="auth-icon"><Lock size={40} /></div>
            <h2>Restricted Access</h2>
            <p>Please enter your authorized work email to access the List Pricing system.</p>

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

              {authError && <div className="auth-error-mini"><AlertCircle size={14} /> {authError}</div>}

              <button
                className={`auth-submit ${isAuthChecking ? 'loading' : ''}`}
                onClick={() => verifyAccess(authEmail)}
                disabled={isAuthChecking}
              >
                {isAuthChecking ? "Verifying..." : "Validate Access"}
                {!isAuthChecking && <ChevronRight size={18} />}
              </button>
            </div>

            <div className="auth-footer">
              <ShieldCheck size={14} /> Secure sync with Google Sheets authorized list
            </div>
          </div>
        </main>
      ) : (
        <main className="container">
          {error && <div className="error-box"><AlertCircle size={20} /> {error}</div>}

          <div className="product-hub-header">
            <div className="hub-label">Select Product Line</div>
            <div className="category-switcher-main">
              {masterOptions.categories.map(c => (
                <button
                  key={c}
                  className={activeCategory === c ? 'active' : ''}
                  onClick={() => {
                    setActiveCategory(c);
                    // Handle type switching
                    const types = Array.from(new Set(Object.values(makesData).flat().filter(r => r._category === c).map(r => r._type)));
                    setSelectedType((c === 'Motors' || c === 'Drives') ? 'Standard' : (types[0] || 'All'));
                    setFilters({});
                    setReferenceMake(null);
                    setReferenceVariant(null);
                  }}
                >
                  {c === 'Motors' ? <Zap size={16} /> : c === 'Drives' ? <ArrowRightLeft size={16} /> : <Layers size={16} />}
                  {c}
                </button>
              ))}
            </div>
          </div>



          <section className="input-card">
            <div className="selection-stack">
              {(activeCategory === 'Motors' || activeCategory === 'Drives' || (activeCategory === 'Gearboxes' && selectedType)) ? (
                <>
                  {activeCategory === 'Gearboxes' && masterOptions.types.length > 0 && (
                    <div className="field">
                      <label>Select Gearbox Type</label>
                      <div className="pill-grid">
                        {masterOptions.types.map(t => (
                          <button
                            key={t}
                            className={`pill-item ${selectedType === t ? 'active' : ''}`}
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
                        <label>Select {criteriaKey}</label>
                        <div className="pill-grid">
                          {masterOptions.criteria[criteriaKey].map(val => {
                            const isAvailable = masterOptions.available[criteriaKey]?.has(String(val));
                            if (!isAvailable && filters[criteriaKey] !== val) return null;
                            return (
                              <button
                                key={val}
                                className={`pill-item ${Array.isArray(filters[criteriaKey]) ? (filters[criteriaKey].includes(val) ? 'active' : '') : (filters[criteriaKey] === val ? 'active' : '')}`}
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
                  {activeCategory === 'Motors' && (
                    <div className="field">
                      <label>Mounting Position</label>
                      <div className="pill-grid binary">
                        {['Foot', 'Flange', 'Face'].map(m => (
                          <button
                            key={m}
                            className={`pill-item ${filters['Mounting'] === m ? 'active' : (filters['Mounting'] === undefined && m === 'Foot' ? 'active' : '')}`}
                            onClick={() => { setFilters(prev => ({ ...prev, 'Mounting': m })); setReferenceMake(null); setReferenceVariant(null); }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state-mini">Checking available specifications...</div>
              )}
            </div>
          </section>

          <div ref={resultsRef} />

          <div className="compare-view">
            {Object.keys(masterOptions.criteria).length > 0 ? (
              <>
                {Object.keys(filters).length >= Object.keys(masterOptions.criteria).length && Object.keys(filters).length > 0 ? (
                  <div className="results-container fadeInUp">
                    {/* Benchmark section removed as it is now auto-selected based on filters */}

                    {comparisonData && (
                      <div className="results-wrapper">
                        <div className="results-header">
                          <div className="header-main-row">
                            <div className="ref-side">
                              <div className="ref-label">Baseline Reference</div>
                              <h3>{referenceMake} {(activeCategory === 'Motors' || activeCategory === 'Drives') ? 'Base' : ''} {userRole === 'admin' && <span className="ref-disc-badge">{Math.round(comparisonData.refDiscount * 100) / 100}% OFF</span>}</h3>
                            </div>
                            <div className="price-tag-massive">
                              {userRole === 'admin' && <button className="download-icon-btn" onClick={exportToExcel}><Download size={24} /></button>}
                              <div className="price-current">
                                <span className="cur">₹</span>
                                <div className="price-stack">
                                  <span className="num">{Math.round(comparisonData.refNet).toLocaleString('en-IN')}</span>
                                  <span className="lab">NET TOTAL {userRole === 'admin' && <span style={{ fontSize: '0.6rem', opacity: 0.5 }}> (B:{Math.round(comparisonData.debug.base * 100) / 100}% D:{comparisonData.debug.matchedIdx})</span>}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="ref-spec-bar">
                            <div className="ref-spec-grid">
                              {activePillField && <div className="pill-dropdown-overlay" onClick={() => setActivePillField(null)} />}
                              {Object.keys(filters).filter(k => {
                                const filterKeys = Object.keys(masterOptions.criteria);
                                // Deduplicate MOC/Material redundancy
                                if (k === 'Material' && filterKeys.includes('MOC')) return false;
                                return true;
                              }).map(fk => (
                                <div
                                  className={`header-badge interactive ${activePillField === fk ? 'editing' : ''}`}
                                  key={fk}
                                  onClick={(e) => { e.stopPropagation(); setActivePillField(activePillField === fk ? null : fk); }}
                                >
                                  <span className="badge-lab">{fk} <ChevronRight size={10} className="edit-chevron" /></span>
                                  <span className="badge-val">{Array.isArray(filters[fk]) ? filters[fk].join(', ') : filters[fk]}</span>

                                  {activePillField === fk && (
                                    <div className="pill-dropdown-portal" onClick={(e) => e.stopPropagation()}>
                                      <div className="dropdown-scroll-box">
                                        <div className="dropdown-header">Select {fk}</div>
                                        {masterOptions.criteria[fk]?.map(val => {
                                          const isAvail = masterOptions.available[fk]?.has(String(val));
                                          return (
                                            <button
                                              key={val}
                                              disabled={!isAvail}
                                              className={`dropdown-option ${filters[fk] === val ? 'active' : ''} ${!isAvail ? 'disabled' : ''}`}
                                              onClick={() => {
                                                setFilters(prev => ({ ...prev, [fk]: val }));
                                                setReferenceMake(null);
                                                setReferenceVariant(null);
                                                setActivePillField(null);
                                              }}
                                            >
                                              {val}
                                              {filters[fk] === val && <CheckCircle2 size={12} style={{ marginLeft: 'auto' }} />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {referenceVariant.Frame && !filters.Frame && (
                                <div className="header-badge disabled">
                                  <span className="badge-lab">Frame</span>
                                  <span className="badge-val">{referenceVariant.Frame}</span>
                                </div>
                              )}
                              {referenceVariant.MOC && !filters.MOC && !filters.Material && (
                                <div className={`header-badge disabled ${referenceVariant.MOC.toUpperCase() === 'AL' ? 'al' : 'ci'}`}>
                                  <span className="badge-lab">Material</span>
                                  <span className="badge-val">{referenceVariant.MOC}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <table className="analysis-table">
                          <thead>
                            <tr>
                              <th>Manufacturer & Specs</th>
                              <th style={{ textAlign: 'center' }}>Net Price</th>
                              {userRole === 'admin' && <th style={{ textAlign: 'center' }}>Match Target</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Always include the reference row first for clarity */}
                            <tr className="row-reference-active">
                              <td>
                                <div className="brand-cell">
                                  <div className="brand-top-row">
                                    <span className="brand-title">{referenceMake}</span>
                                    <span className="subtle-badge best-val">REFERENCE</span>
                                  </div>
                                  <div className="brand-specs">
                                    {Object.keys(fieldConfig).map(k => {
                                      if ((fieldConfig[k] === 'display' || (k === 'Model' && activeCategory === 'Gearboxes')) && comparisonData.refMotor[k]) {
                                        const isMoc = k.toUpperCase() === 'MOC' || k.toUpperCase() === 'MATERIAL';
                                        const isFrame = k.toUpperCase() === 'FRAME';
                                        const val = comparisonData.refMotor[k];
                                        const isNumeric = !isNaN(parseFloat(val)) && isFinite(val) && !String(val).includes(':');
                                        const displayVal = isNumeric ? Math.round(parseFloat(val)).toLocaleString('en-IN') : val;

                                        return (
                                          <span key={k} className={`spec-pill ${isMoc ? (comparisonData.refMotor.MOC === 'AL' ? 'al-pill' : 'ci-pill') : ''}`}>
                                            {isMoc || isFrame ? (isFrame ? `F${displayVal}` : displayVal) : `${k}: ${displayVal}`}
                                          </span>
                                        );
                                      }
                                      return null;
                                    })}
                                    {/* Legacy/Fallback specs if no markers provided */}
                                    {!Object.values(fieldConfig).includes('display') && (
                                      <>
                                        {comparisonData.refMotor.MOC && <span className={`spec-pill ${comparisonData.refMotor.MOC === 'AL' ? 'al-pill' : 'ci-pill'}`}>{comparisonData.refMotor.MOC}</span>}
                                        {comparisonData.refMotor.MATERIAL && <span className={`spec-pill ${comparisonData.refMotor.MATERIAL === 'AL' ? 'al-pill' : 'ci-pill'}`}>{comparisonData.refMotor.MATERIAL}</span>}
                                        {comparisonData.refMotor.Frame && <span className="spec-pill">F{comparisonData.refMotor.Frame}</span>}
                                        {comparisonData.refMotor.Ratio && <span className="spec-pill">Ratio: {comparisonData.refMotor.Ratio}</span>}
                                        {comparisonData.refMotor.Size && <span className="spec-pill">Size: {comparisonData.refMotor.Size}</span>}
                                      </>
                                    )}
                                    {userRole === 'admin' && (
                                      <span className="applied-tag">
                                        {Math.round(comparisonData.refDiscount * 100) / 100}% Off
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div className="massive-price">
                                  <div className="price-main"><span className="curr">₹</span><span className="amt">{Math.round(comparisonData.refNet).toLocaleString('en-IN')}</span></div>
                                  <div className="price-diff">BASELINE</div>
                                </div>
                              </td>
                              {userRole === 'admin' && <td style={{ textAlign: 'center' }}><div className="match-pill-large"><span className="val">-</span></div></td>}
                            </tr>
                            {comparisonData.brands.filter(b => !b.isRef).map((b, i) => (
                              <tr key={i} className={highlights?.best?.id === b.id ? 'row-best' : ''}>
                                <td>
                                  <div className="brand-cell">
                                    <div className="brand-top-row">
                                      <span className="brand-title">{b.make}</span>
                                      {highlights?.best?.id === b.id && <span className="subtle-badge best-val">BEST VALUE</span>}
                                    </div>
                                    <div className="brand-specs">
                                      {Object.keys(fieldConfig).map(k => {
                                        if ((fieldConfig[k] === 'display' || (k === 'Model' && activeCategory === 'Gearboxes')) && b.rowRaw[k]) {
                                          const isMoc = k.toUpperCase() === 'MOC';
                                          const isFrame = k.toUpperCase() === 'FRAME';
                                          const val = b.rowRaw[k];
                                          const isNumeric = !isNaN(parseFloat(val)) && isFinite(val) && !String(val).includes(':');
                                          const displayVal = isNumeric ? Math.round(parseFloat(val)).toLocaleString('en-IN') : val;

                                          return (
                                            <span key={k} className={`spec-pill ${isMoc ? (b.moc === 'AL' ? 'al-pill' : 'ci-pill') : ''}`}>
                                              {isMoc || isFrame ? (isFrame ? `F${displayVal}` : displayVal) : `${k}: ${displayVal}`}
                                            </span>
                                          );
                                        }
                                        return null;
                                      })}
                                      {!Object.values(fieldConfig).includes('display') && (
                                        <>
                                          {b.moc && <span className={`spec-pill ${b.moc === 'AL' ? 'al-pill' : 'ci-pill'}`}>{b.moc}</span>}
                                          {b.frame && <span className="spec-pill">F{b.frame}</span>}
                                        </>
                                      )}
                                      {userRole === 'admin' && <span className="applied-tag">{Math.round(b.discount * 100) / 100}% Off</span>}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div className="massive-price">
                                    <div className="price-main"><span className="curr">₹</span><span className="amt">{Math.round(b.net).toLocaleString('en-IN')}</span></div>
                                    <div className={`price-diff ${b.diffINR > 0 ? 'plus' : 'minus'}`}>{b.diffINR > 0 ? '+' : ''}{Math.round(b.diffINR).toLocaleString('en-IN')} vs REF</div>
                                  </div>
                                </td>
                                {userRole === 'admin' && (
                                  <td style={{ textAlign: 'center' }}>
                                    <div className="match-pill-large"><span className="val">{b.equivDiscount.toFixed(1)}%</span><span className="lab">TO MATCH</span></div>
                                  </td>
                                )}
                              </tr>
                            ))}
                            {comparisonData.brands.filter(b => !b.isRef).length === 0 && referenceVariant && (
                              <tr>
                                <td colSpan={userRole === 'admin' ? 3 : 2} style={{ textAlign: 'center', padding: '2rem' }}>
                                  <div className="empty-state-mini">No matching products found in other sheets for the selected specifications.</div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Search size={40} />
                    <p>Selection is partially complete.</p>
                    <div className="criteria-status">
                      {Object.keys(masterOptions.criteria).map(k => (
                        <span key={k} className={`status-tag ${filters[k] ? 'done' : 'pending'}`}>{k}: {filters[k] || '...'}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state-lrg">
                <AlertCircle size={40} />
                <h3>No Data Found</h3>
                <p>Ensure your Google Sheet highlights Gearbox columns (Ratio, Size) or Motor columns (HP, Poles).</p>
                <button className="nav-btn" onClick={fetchData}><RefreshCw size={16} /> Sync Now</button>
              </div>
            )}
          </div>
        </main>
      )
      }

      {/* Modals */}
      {
        showConfig && (
          <div className="modal" onClick={() => setShowConfig(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3><Sliders size={20} /> Surcharge Rules</h3>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="modal-field">
                    <label>Frame &le; 160 Surcharge (%)</label>
                    <input type="number" value={config.lowFrameSurcharge} onChange={e => updateConfig('lowFrameSurcharge', e.target.value)} />
                  </div>
                  <div className="modal-field">
                    <label>Frame &gt; 160 Surcharge (%)</label>
                    <input type="number" value={config.highFrameSurcharge} onChange={e => updateConfig('highFrameSurcharge', e.target.value)} />
                  </div>
                  <div className="modal-field">
                    <label>Profit Margin (%)</label>
                    <input type="number" value={config.profitMargin} onChange={e => updateConfig('profitMargin', e.target.value)} />
                  </div>
                </div>
              </div>
              <button className="save-btn" onClick={() => setShowConfig(false)}>Save Configuration</button>
            </div>
          </div>
        )
      }

      {
        showSettings && (
          <div className="modal" onClick={() => setShowSettings(false)}>
            <div className="modal-content lrg" onClick={e => e.stopPropagation()}>
              <div className="modal-header-row">
                <h3><Percent size={20} /> Market Discounts</h3>
                <div className="modal-actions-row">
                  <button className="logout-btn" onClick={() => { if (confirm('Are you sure you want to log out?')) logout(); }}>
                    <LogOut size={14} /> Log Out
                  </button>
                  {discountsFromSheet ? (
                    <span className="sync-badge-active">Synced from Sheet</span>
                  ) : (
                    <button className="reset-data-btn" onClick={() => { if (confirm('Clear all local data and hard-sync from server?')) { localStorage.clear(); window.location.reload(); } }}>
                      Hard Reset
                    </button>
                  )}
                </div>
              </div>
              <div className="user-context">
                <div className="session-info">
                  Active Session: <strong>{authEmail}</strong>
                  <span className={`role-badge ${userRole}`}>{userRole.toUpperCase()}</span>
                </div>
                <button className="view-rules-btn" onClick={() => setShowRules(prev => !prev)}>
                  {showRules ? 'Hide Rules' : 'View Fetched Rules'}
                </button>
              </div>
              {showRules && (
                <div className="rules-explorer">
                  <div className="rule-box-header">
                    <span>Target Product</span>
                    <span>Brand</span>
                    <span>Discount</span>
                  </div>
                  <div className="rules-scroll">
                    {discountRules.map((rule, idx) => (
                      <div key={idx} className="rule-item">
                        <span className="r-prod">{rule._raw?.PRODUCT || 'ALL'}</span>
                        <span className="r-brand">{rule._raw?.BRANDNAME || 'ALL'}</span>
                        <span className="r-disc">{rule._discount}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="modal-subtitle">
                {discountsFromSheet
                  ? "Discounts are being automatically picked up from your 'Discount' worksheet. Manual changes here are temporary."
                  : "Configure standard market discounts for each manufacturer. These values are saved automatically."}
              </p>
              <div className="modal-grid">
                {Object.keys(makesData).length > 0 ? Object.keys(makesData).flatMap(m => {
                  const motors = (makesData[m] || []);
                  const mocs = Array.from(new Set(motors.map(r => (r.MOC || 'CI').toUpperCase().trim())));
                  const upperM = String(m).toUpperCase().trim();
                  return mocs.map(moc => {
                    const k = `${upperM}-${moc}`;
                    return (
                      <div key={k} className="b-row">
                        <div className="brand-meta">
                          <span className="b-name">{m}</span>
                          <span className={`b-status ${moc.toLowerCase()}-text`}>{moc} Variant</span>
                        </div>
                        <div className="input-group-mini">
                          <input type="number" value={discounts[k] || 0} onChange={e => updateDiscount(k, e.target.value)} />
                          <span className="pct">%</span>
                        </div>
                      </div>
                    );
                  });
                }) : (
                  <div className="no-brands">No brands detected in Excel file.</div>
                )}
              </div>
              <button className="save-btn" onClick={() => setShowSettings(false)}>Done & Apply</button>
            </div>
          </div>
        )
      }

      <style>{`
        * { box-sizing: border-box; }
      .layout {min-height: 100vh; background: #020617; color: #f8fafc; font-family: 'Outfit', sans-serif; overflow-x: hidden; }
      .container {max-width: 1200px; margin: 0 auto; padding: 2.5rem 1.5rem; }
      .navbar {display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 2.5rem; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.08); position: sticky; top: 0; z-index: 100; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5); }
      .logo {font-size: 1.8rem; font-weight: 800; letter-spacing: -0.5px; background: linear-gradient(135deg, #fff 0%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .logo span {background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%); color: #fff; -webkit-text-fill-color: #fff; padding: 0.2rem 0.6rem; border-radius: 8px; font-size: 0.75rem; margin-left: 10px; vertical-align: middle; box-shadow: 0 0 20px rgba(99, 102, 241, 0.4); font-weight: 900; }
      .nav-actions {display: flex; align-items: center; gap: 1.5rem; }
      .sync-info {font-size: 0.7rem; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
      .nav-btn {background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 0.7rem; border-radius: 14px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; }
      .nav-btn:hover {background: rgba(255,255,255,0.12); transform: translateY(-2px); border-color: rgba(99, 102, 241, 0.5); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }

      .tab-switcher {display: flex; gap: 1rem; margin-bottom: 3rem; background: rgba(15, 23, 42, 0.5); padding: 0.5rem; border-radius: 18px; border: 1px solid rgba(255,255,255,0.05); }
      .tab-switcher button {flex: 1; padding: 1rem; background: transparent; border: none; color: #64748b; font-weight: 700; border-radius: 12px; cursor: pointer; transition: 0.3s; }
      .tab-switcher button.active {background: #6366f1; color: #fff; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3); }

      .product-hub-header {margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 12px; }
      .hub-label {font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 2px; }
      .category-switcher-main {display: flex; gap: 12px; background: rgba(15, 23, 42, 0.4); padding: 6px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); align-self: flex-start; }
      .category-switcher-main button {display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: transparent; border: 1px solid transparent; border-radius: 14px; color: #64748b; font-weight: 700; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-size: 0.9rem; }
      .category-switcher-main button.active {background: #6366f1; color: #fff; box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3); }
      .category-switcher-main button:hover:not(.active) {background: rgba(255,255,255,0.05); color: #fff; }

      .type-selector-box {margin-bottom: 2rem; background: rgba(15,23,42,0.3); padding: 1.5rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.03); }
      .empty-state-mini {padding: 3rem; text-align: center; color: #64748b; font-weight: 700; background: rgba(0,0,0,0.2); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1); }
      .empty-state-lrg {padding: 5rem; text-align: center; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 1rem; background: rgba(0,0,0,0.2); border-radius: 32px; border: 2px dashed rgba(255,255,255,0.05); }
      .empty-state-lrg h3 {color: #fff; margin: 0; }
      .status-tag {padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
      .status-tag.done {background: rgba(34, 197, 94, 0.1); color: #22c55e; }
      .status-tag.pending {background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
      .criteria-status {display: flex; gap: 10px; margin-top: 10px; }

      .results-list-title {display: flex; align-items: center; gap: 12px; margin-bottom: 2rem; font-size: 1.2rem; font-weight: 900; color: #fff; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); }

      .input-card {background: linear-gradient(135deg, rgba(30,41,59,0.5), rgba(15,23,42,0.8)); border: 1px solid rgba(255,255,255,0.06); padding: 3rem; border-radius: 40px; margin-bottom: 3rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); backdrop-filter: blur(20px); }
      .selection-stack { 
        display: grid; 
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
        gap: 2.5rem; 
        width: 100%;
      }
      .selection-stack .field { 
        display: flex; 
        flex-direction: column; 
        gap: 1rem; 
        min-width: 0; 
      }
      .pill-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 5px 10px 5px 0;
        margin: 0;
        max-height: 250px;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        scrollbar-color: rgba(99, 102, 241, 0.3) transparent;
      }
      .pill-grid::-webkit-scrollbar { width: 5px; height: 5px; }
      .pill-grid::-webkit-scrollbar-track { background: transparent; }
      .pill-grid::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
      .pill-grid::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
      .pill-grid.locked {opacity: 0.3; pointer-events: none; }
      .pill-item {
        padding: 0.8rem 1.6rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      color: #94a3b8;
      border-radius: 14px;
      font-weight: 800;
      font-size: 0.95rem;
      cursor: pointer;
      transition: 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      white-space: nowrap;
      flex-shrink: 0;
        }
      .pill-item:hover {background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); color: #fff; }
      .pill-item.active {background: #6366f1; border-color: #6366f1; color: #fff; box-shadow: 0 8px 16px rgba(99, 102, 241, 0.4); transform: scale(1.05); }
      .pill-grid.binary .pill-item {flex: 1; text-align: center; }
      .field label {display: block; font-size: 0.7rem; color: #64748b; margin-bottom: 0.75rem; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
      .field select {width: 100%; padding: 1rem; background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; font-weight: 600; outline: none; transition: 0.3s; }
      .field select:focus {border-color: #6366f1; box-shadow: 0 0 15px rgba(99, 102, 241, 0.2); }

      .brand-picker-box {margin-bottom: 2rem; position: relative; z-index: 10; }
      .picker-label {font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
      .brand-selector {
        display: inline-flex;
      background: rgba(15, 23, 42, 0.8);
      padding: 6px;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,0.05);
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      gap: 4px;
        }
      .brand-selector button {
        padding: 0.6rem 1.5rem;
      background: transparent;
      border: 1px solid transparent;
      color: #94a3b8;
      border-radius: 14px;
      font-weight: 800;
      cursor: pointer;
      transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 0.85rem;
        }
      .brand-selector button.active {
        background: #6366f1;
      color: #fff;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
      transform: translateY(0); 
        }
      .brand-selector button:hover:not(.active) {color: #fff; background: rgba(255,255,255,0.03); }

      .clickable {cursor: pointer; transition: 0.2s; }
      .clickable:hover {transform: translateY(-1px); filter: brightness(1.2); }
      .ref-disc-badge.clickable:active, .applied-tag.clickable:active {transform: scale(0.95); }

      .no-brands {padding: 3rem; text-align: center; color: #64748b; font-weight: 800; }
      .guest-badge {font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; border: 1px solid rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 8px; }

      .highlights-row {display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2.5rem; }
      .high-card {display: flex; align-items: center; gap: 1.25rem; padding: 1.5rem; border-radius: 20px; border: 1px solid transparent; backdrop-filter: blur(5px); }
      .high-card.best {background: rgba(16,185,129,0.05); color: #34d399; border-color: rgba(16,185,129,0.15); }
      .high-card.peak {background: rgba(239,68,68,0.05); color: #f87171; border-color: rgba(239,68,68,0.15); }
      .high-card h3 {font-size: 0.7rem; text-transform: uppercase; opacity: 0.6; font-weight: 800; letter-spacing: 1px; }
      .high-card p {font-size: 1.4rem; font-weight: 900; margin-top: 4px; }

      .results-wrapper {background: rgba(30,41,59,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 32px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.5); isolation: isolate; position: relative; backdrop-filter: blur(10px); }
      .results-header { padding: 2.5rem 3rem; background: linear-gradient(165deg, #1e1b4b 0%, #0f172a 100%); position: relative; display: flex; flex-direction: column; gap: 2rem; border-bottom: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05); }
      .results-header::before {content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.1), transparent); pointer-events: none; }
      .header-main-row { display: flex; justify-content: space-between; align-items: flex-end; width: 100%; }
      .ref-side .ref-label {font-size: 0.65rem; font-weight: 950; color: #818cf8; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 8px; opacity: 0.8; }
      .ref-side h3 {font-size: 2.8rem; font-weight: 900; display: flex; align-items: center; gap: 15px; letter-spacing: -1.5px; line-height: 1; color: #fff; margin: 0; }
      .ref-disc-badge {font-size: 0.75rem; background: rgba(99, 102, 241, 0.15); padding: 5px 12px; border-radius: 10px; border: 1px solid rgba(99, 102, 241, 0.3); font-weight: 900; color: #a5b4fc; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }

      .ref-spec-bar { padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); position: relative; margin-top: 1rem; }
      .ref-spec-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; width: 100%; transition: 0.3s; }
      .header-badge {
        background: rgba(255,255,255,0.04);
        padding: 0.5rem 1.25rem;
        border-radius: 100px;
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(255,255,255,0.08);
        min-width: 110px;
        backdrop-filter: blur(10px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }
      .header-badge.al {border-color: rgba(34, 211, 238, 0.4); background: rgba(34, 211, 238, 0.1); }
      .header-badge.ci {border-color: rgba(248, 113, 113, 0.4); background: rgba(248, 113, 113, 0.1); }
      .badge-lab { font-size: 0.5rem; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.5; font-weight: 950; margin-bottom: 2px; color: #fff; display: flex; align-items: center; gap: 4px; }
      .badge-val { font-size: 0.9rem; font-weight: 900; color: #fff; line-height: 1.1; }
      .header-badge.interactive:hover { border-color: #6366f1; background: rgba(99, 102, 241, 0.15); transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.3), 0 0 10px rgba(99, 102, 241, 0.2); }
      .header-badge.editing { border-color: #6366f1; background: rgba(99, 102, 241, 0.25); z-index: 1001; box-shadow: 0 0 30px rgba(99, 102, 241, 0.3); }
      .edit-chevron { opacity: 0.4; transition: 0.3s; color: #818cf8; font-size: 0.6rem; }

      .pill-dropdown-overlay {position: fixed; inset: 0; z-index: 1000; background: transparent; }
      .pill-dropdown-portal {
        position: absolute;
      top: calc(100% + 10px);
      left: 0;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 18px;
      min-width: 180px;
      max-height: 280px;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
      z-index: 1002;
      animation: popIn 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28);
      transform-origin: top left;
        }
      @keyframes popIn {from {opacity: 0; transform: scale(0.9) translateY(-10px); } to {opacity: 1; transform: scale(1) translateY(0); } }

      .dropdown-header {font-size: 0.6rem; text-transform: uppercase; letter-spacing: 1px; color: #6366f1; font-weight: 900; padding: 10px 14px 4px; opacity: 0.8; }
      .dropdown-scroll-box {padding: 6px; overflow-y: auto; max-height: 270px; }
      .dropdown-option {
        width: 100%;
      padding: 10px 14px;
      background: transparent;
      border: none;
      color: #fff;
      text-align: left;
      font-weight: 700;
      border-radius: 12px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: 0.2s;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
        }
      .dropdown-option:hover:not(.disabled) {background: rgba(255,255,255,0.1); }
      .dropdown-option.active {background: #6366f1; color: #fff; }
      .dropdown-option.disabled {opacity: 0.25; cursor: not-allowed; grayscale: 1; }

      .price-tag-massive {display: flex; align-items: flex-start; gap: 15px; text-align: right; }
      .ref-strike {font-size: 1.8rem; font-weight: 800; color: #f87171; text-decoration: line-through; opacity: 0.6; margin-top: 15px; }
      .price-stack { display: flex; flex-direction: column; align-items: flex-end; }
      .price-current .cur {font-size: 1.8rem; font-weight: 800; color: #a5b4fc; margin-top: 8px; }
      .price-current .num {font-size: 4.8rem; font-weight: 1000; line-height: 0.85; letter-spacing: -4px; color: #fff; text-shadow: 0 0 40px rgba(99, 102, 241, 0.3); }
      .price-current .lab {display: block; font-size: 0.7rem; font-weight: 950; opacity: 0.6; letter-spacing: 2.5px; margin-top: 6px; text-transform: uppercase; }

      .analysis-table {width: 100%; border-collapse: separate; border-spacing: 0 16px; background: transparent; padding: 0 2rem 2.5rem; }
      .analysis-table th {padding: 1rem 2.5rem; color: #64748b; font-weight: 900; text-transform: uppercase; font-size: 0.6rem; letter-spacing: 2.5px; border: none; text-align: left; }
      .analysis-table td {padding: 1.8rem 2.5rem; background: rgba(15, 23, 42, 0.45); border-top: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); vertical-align: middle; backdrop-filter: blur(5px); }
      .analysis-table td:first-child {border-left: 1px solid rgba(255,255,255,0.04); border-radius: 28px 0 0 28px; width: 45%; }
      .analysis-table td:nth-child(2) { text-align: right; width: 25%; }
      .analysis-table td:last-child {border-right: 1px solid rgba(255,255,255,0.04); border-radius: 0 28px 28px 0; text-align: right; width: 30%; }
      .analysis-table tr:hover td {background: rgba(30, 41, 59, 0.7); transform: translateY(-5px) scale(1.01); box-shadow: 0 25px 60px rgba(0,0,0,0.4); border-color: rgba(99, 102, 241, 0.4); z-index: 10; position: relative; }
      .row-reference-active td {background: rgba(99, 102, 241, 0.08) !important; border-color: rgba(99, 102, 241, 0.3) !important; }

      /* Technical Specs Styles */
      .tech-specs-section {margin-bottom: 2.5rem; }
      .tech-specs-grid {display: grid; grid-template-columns: 1.5fr 1fr; gap: 1.5rem; }
      .dim-guide-card, .dim-values-card {background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; overflow: hidden; }
      .guide-header {padding: 1.25rem 1.5rem; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 10px; font-weight: 900; color: #fff; font-size: 0.85rem; }
      .dim-visual-container {padding: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; min-height: 280px; }
      .gearbox-svg {width: 100%; max-width: 380px; filter: drop-shadow(0 0 20px rgba(99, 102, 241, 0.2)); }
      .dim-overlay-info {font-size: 0.65rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-top: 10px; }

      .dim-table-container {padding: 1.5rem; }
      .dim-spec-grid {display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
      .dim-spec-item {display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 16px; border: 1px solid rgba(255,255,255,0.03); }
      .dim-label {font-size: 0.65rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
      .dim-value {font-size: 1.1rem; font-weight: 800; color: #fff; }
      .no-tech-data {text-align: center; padding: 4rem 1rem; color: #475569; font-weight: 700; font-size: 0.9rem; }

      @media (max-width: 900px) { .tech-specs-grid {grid-template-columns: 1fr; } }


      .brand-cell {display: flex; flex-direction: column; gap: 6px; }
      .brand-top-row {display: flex; align-items: center; gap: 10px; }
      .subtle-badge {font-size: 0.65rem; font-weight: 900; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase; }
      .subtle-badge.best-val {background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
      .subtle-badge.peak-val {background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
      .subtle-badge.frame-val {background: rgba(34, 211, 238, 0.15); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.3); }

      .brand-specs {display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
      .spec-pill {font-size: 0.75rem; font-weight: 800; padding: 5px 12px; background: rgba(255,255,255,0.06); border-radius: 8px; color: #cbd5e1; display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,0.1); }
      .moc-pill {background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); }
      .al-pill {background: rgba(6, 182, 212, 0.15); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.3); }
      .ci-pill {background: rgba(148, 163, 184, 0.15); color: #e2e8f0; border: 1px solid rgba(148, 163, 184, 0.3); }

      .brand-title {font-size: 1.6rem; font-weight: 950; color: #fff; line-height: 1; letter-spacing: -0.5px; }
      .lp-sub {font-size: 0.85rem; color: #94a3b8; font-weight: 700; }
      .applied-tag {font-size: 0.75rem; color: #818cf8; font-weight: 950; text-transform: uppercase; background: rgba(99, 102, 241, 0.15); padding: 5px 10px; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.25); }

      .row-best {background: rgba(16, 185, 129, 0.02); }
      .row-reference-active {background: rgba(99, 102, 241, 0.05); border-left: 4px solid #6366f1; }
      .brand-selector button.active.al-btn {background: #06b6d4; }
      .brand-selector button.active.ci-btn {background: #6366f1; }
      .moc-tag-inline {font-size: 0.6rem; opacity: 0.7; font-weight: 900; background: rgba(0,0,0,0.2); padding: 1px 4px; border-radius: 4px; margin-left: 5px; }
      .brand-selector button.active .moc-tag-inline {background: rgba(0,0,0,0.1); opacity: 1; }

      .ci-text {color: #818cf8; }
      .al-text {color: #22d3ee; }

      .user-context {display: flex; align-items: center; gap: 8px; }
      .role-badge {font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; font-weight: 900; letter-spacing: 0.5px; }
      .role-badge.admin {background: rgba(251, 191, 36, 0.1); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.2); }
      .role-badge.user {background: rgba(148, 163, 184, 0.1); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2); }

      .download-icon-btn {background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px; border-radius: 12px; cursor: pointer; transition: 0.2s; margin-right: 15px; }
      .download-icon-btn:hover {background: rgba(255,255,255,0.2); transform: translateY(-2px); }

      /* Category Switcher */
      .pill-grid.binary button {flex: 0 1 200px; }
      @media (max-width: 600px) { .pill-grid.binary button {flex: 1; } }

      .empty-state {padding: 5rem; text-align: center; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
      .empty-state p {font-size: 1.1rem; font-weight: 600; }

      /* Quote Toggle */
      .quote-toggle-box {display: flex; align-items: center; gap: 10px; background: rgba(30, 41, 59, 0.5); padding: 5px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
      .toggle-label {font-size: 0.8rem; font-weight: 800; color: #94a3b8; }
      .toggle-switch {position: relative; display: inline-block; width: 36px; height: 18px; }
      .toggle-switch input {opacity: 0; width: 0; height: 0; }
      .slider {position: absolute; cursor: pointer; inset: 0; background: #334155; transition: .4s; border-radius: 34px; }
      .slider:before {position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background: white; transition: .4s; border-radius: 50%; }
      input:checked + .slider {background: #6366f1; }
      input:checked + .slider:before {transform: translateX(18px); }

      .modal-body .grid-2 {display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .modal-field label {display: block; margin-bottom: 8px; font-size: 0.75rem; font-weight: 800; color: #64748b; }
      .modal-field input {width: 100%; padding: 0.8rem; background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-weight: 800; }

      .massive-price {display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
      .price-main {display: flex; align-items: baseline; justify-content: flex-end; gap: 6px; color: #fff; }
      .price-main .curr {font-size: 1.25rem; font-weight: 800; color: #818cf8; text-shadow: 0 0 15px rgba(129, 140, 248, 0.3); }
      .price-main .amt {font-size: 2.8rem; font-weight: 900; letter-spacing: -1.5px; }
      .price-diff {font-size: 0.75rem; font-weight: 800; margin-top: 4px; padding: 5px 12px; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); }
      .price-diff.plus {color: #fda4af; background: rgba(244, 63, 94, 0.15); border-color: rgba(244, 63, 94, 0.3); }
      .price-diff.minus {color: #6ee7b7; background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); }

      .match-pill-large {display: inline-flex; flex-direction: column; align-items: center; background: rgba(16, 185, 129, 0.08); padding: 1.25rem 2.5rem; border-radius: 24px; border: 1px solid rgba(16, 185, 129, 0.25); box-shadow: 0 10px 30px rgba(16, 185, 129, 0.1); transition: 0.3s; }
      .match-pill-large .val {font-size: 2.2rem; font-weight: 1000; color: #10b981; text-shadow: 0 0 20px rgba(16, 185, 129, 0.3); }
      .match-pill-large .lab {font-size: 0.65rem; font-weight: 950; opacity: 0.6; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }

      .v-bar-container {position: relative; height: 35px; display: flex; align-items: center; gap: 15px; }
      .v-bar-track {flex: 1; height: 6px; background: rgba(255,255,255,0.03); border-radius: 10px; position: relative; overflow: hidden; }
      .v-bar {position: absolute; height: 100%; border-radius: 10px; transition: 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
      .v-bar.good {background: #34d399; box-shadow: 0 0 10px rgba(52, 211, 153, 0.4); }
      .v-bar.bad {background: #fb7185; box-shadow: 0 0 10px rgba(251, 113, 133, 0.4); }
      .v-center {position: absolute; left: 50%; height: 16px; width: 1px; background: rgba(255,255,255,0.3); top: 50%; transform: translateY(-50%); z-index: 2; }
      .v-text {font-size: 0.8rem; font-weight: 900; min-width: 50px; text-align: right; }
      .v-text.good {color: #34d399; }
      .v-text.bad {color: #f43f5e; }

      .pill {background: rgba(99,102,241,0.1); color: #818cf8; padding: 0.5rem 1rem; border-radius: 10px; font-weight: 900; border: 1px solid rgba(99,102,241,0.2); font-size: 1.1rem; }
      .export-btn {width: 100%; background: transparent; color: #64748b; border: none; padding: 1.25rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); transition: 0.3s; }
      .export-btn:hover {background: #10b981; color: #fff; }

      /* Modern Responsive Architecture */
      @media (max-width: 1200px) {
        .container { padding: 2rem; }
        .input-card { padding: 2rem; }
      }

      @media (max-width: 900px) {
        .selection-stack { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; }
        .results-header { padding: 2.5rem; }
        .ref-side h3 { font-size: 2rem; }
      }

      @media (max-width: 768px) {
        .container { padding: 1.25rem; width: 100%; }
        .navbar { padding: 0.75rem 1.25rem; }
        .logo { font-size: 1.1rem; }
        .sync-info { display: none; }
        .nav-actions { gap: 10px; }
        
        .product-hub-header { align-items: stretch; margin-bottom: 1.5rem; }
        .category-switcher-main { align-self: stretch; width: 100%; justify-content: space-between; padding: 4px; gap: 8px; }
        .category-switcher-main button { flex: 1; justify-content: center; padding: 10px 5px; font-size: 0.8rem; border-radius: 12px; }
        .category-switcher-main button span { display: none; } /* Hide icons if too narrow */

        .input-card { padding: 1.5rem; border-radius: 28px; margin-bottom: 2rem; }
        .selection-stack { grid-template-columns: 1fr; gap: 1.75rem; }
        
        .pill-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; max-height: 220px; overflow-y: auto; padding-right: 5px; scrollbar-width: thin; }
        .pill-item { padding: 0.75rem 0.5rem; font-size: 0.85rem; border-radius: 12px; justify-content: center; text-align: center; }

        .results-header { padding: 1.5rem; gap: 1.5rem; }
        .header-main-row { flex-direction: column; align-items: center; text-align: center; gap: 1.5rem; }
        .ref-side h3 { font-size: 2rem; }
        .price-tag-massive { width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.5rem; justify-content: center; }
        .ref-spec-bar { padding: 1rem 0; border-top: 1px solid rgba(255,255,255,0.08); overflow: hidden; position: relative; width: 100%; }
        .ref-spec-bar::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 40px; background: linear-gradient(to left, rgba(15, 23, 42, 0.8), transparent); pointer-events: none; }
        .ref-spec-grid { display: flex; flex-wrap: nowrap; gap: 10px; width: 100%; overflow-x: auto; padding: 5px 40px 10px 10px; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }
        .ref-spec-grid::-webkit-scrollbar { display: none; }
        .header-badge { min-width: 120px; flex-shrink: 0; padding: 0.6rem 1.2rem; border-radius: 100px; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); align-items: center; text-align: center; }
        .badge-lab { font-size: 0.5rem; margin-bottom: 1px; justify-content: center; }
        .badge-val { font-size: 0.85rem; width: 100%; overflow: visible; text-overflow: clip; }

        /* Transform table to cards */
        .analysis-table, .analysis-table thead, .analysis-table tbody, .analysis-table tr, .analysis-table th, .analysis-table td { display: block; width: 100%; }
        .analysis-table thead { display: none; }
        .analysis-table { padding: 0 0.5rem 1rem; }
        .analysis-table tr { 
          margin-bottom: 1.5rem; 
          background: rgba(30, 41, 59, 0.4); 
          border: 1px solid rgba(255,255,255,0.05); 
          border-radius: 24px; 
          padding: 1.5rem;
          transition: none;
        }
        .analysis-table td { padding: 0 !important; border: none !important; background: transparent !important; margin-bottom: 1.5rem; text-align: center !important; width: 100% !important; border-radius: 0 !important; }
        .analysis-table td:last-child { margin-bottom: 0; }
        
        .brand-top-row { justify-content: center; margin-bottom: 10px; }
        .brand-specs { justify-content: center; }
        .price-main { justify-content: center; }
        .match-pill-large { width: 100%; flex-direction: row; justify-content: space-between; padding: 1rem 1.5rem; border-radius: 16px; margin-top: 1.25rem; height: auto; }
        .match-pill-large .val { font-size: 1.8rem; }
      }

      @media (max-width: 480px) {
        .container { padding: 1rem; }
        .navbar { padding: 0.6rem 1rem; }
        .logo { font-size: 1rem; }
        .logo span { display: none; } /* Hide 'Engine' on tiny screens */
        .price-main .amt { font-size: 2.8rem; }
        .ref-side h3 { font-size: 1.5rem; }
        .input-card { padding: 1.25rem; border-radius: 20px; }
        .pill-grid { grid-template-columns: repeat(2, 1fr); max-height: 200px; }
        .ref-spec-grid { gap: 8px; padding-left: 5px; }
        .header-badge { padding: 0.5rem 1rem; border-radius: 100px; min-width: 100px; }
        .badge-val { font-size: 0.75rem; }
        .ref-side h3 { font-size: 1.8rem; }
      }
        }

      .calc-view {background: rgba(15, 23, 42, 0.6); padding: 3rem; border-radius: 32px; border: 1px solid rgba(255,255,255,0.05); }
      .calc-input {max-width: 450px; margin: 0 auto 3rem; text-align: center; }
      .calc-input input {width: 100%; padding: 1.5rem; background: #000; color: #fff; border: 2px solid rgba(255,255,255,0.1); border-radius: 20px; font-size: 2.2rem; font-weight: 900; margin-bottom: 1.5rem; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      .calc-input button {width: 100%; padding: 1.25rem; background: #22d3ee; color: #000; font-weight: 900; border-radius: 15px; border: none; cursor: pointer; font-size: 1.2rem; box-shadow: 0 4px 15px rgba(34, 211, 238, 0.3); transition: 0.3s; }
      .calc-input button:hover:not(:disabled) {transform: translateY(-2px); box-shadow: 0 8px 25px rgba(34, 211, 238, 0.5); }

      .calc-grid {display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
      .calc-card {background: #000; padding: 2rem; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); position: relative; }
      .calc-card::after {content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: #22d3ee; border-radius: 24px 24px 0 0; }
      .c-name {font-size: 1.3rem; font-weight: 900; color: #fff; }
      .c-lp {font-size: 0.85rem; color: #64748b; margin-top: 8px; font-weight: 600; }
      .c-res {font-size: 2.8rem; font-weight: 900; color: #34d399; margin-top: 1.5rem; }
      .c-res small {font-size: 1rem; opacity: 0.6; margin-left: 4px; }

      .modal {position: fixed; inset: 0; background: rgba(2, 6, 23, 0.95); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 2rem; }
      .modal-content {background: #0f172a; border: 1px solid rgba(255,255,255,0.1); padding: 3rem; border-radius: 32px; width: 100%; max-width: 500px; box-shadow: 0 40px 100px rgba(0,0,0,0.8); }
      .modal-content.lrg {max-width: 900px; }
      .modal-header-row {display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
      .modal-header-row h3 {font-size: 1.5rem; font-weight: 900; display: flex; align-items: center; gap: 0.75rem; }
      .modal-subtitle {color: #64748b; font-size: 0.9rem; margin-bottom: 2.5rem; }
      .reset-data-btn {background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.4rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.8rem; }

      .modal-grid {display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.25rem; margin-top: 1rem; max-height: 450px; overflow-y: auto; padding-right: 10px; }
      .b-row {background: rgba(255,255,255,0.03); padding: 1.25rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; }
      .brand-meta .b-name {font-weight: 900; font-size: 1.1rem; color: #fff; display: block; }
      .brand-meta .b-status {font-size: 0.65rem; color: #34d399; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
      .input-group-mini {position: relative; width: 100px; }
      .input-group-mini input {width: 100%; background: #000; color: #22d3ee; border: 1px solid rgba(255,255,255,0.1); padding: 0.75rem; border-radius: 12px; text-align: center; font-weight: 900; font-size: 1.1rem; }
      .input-group-mini .pct {position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 0.75rem; color: #64748b; font-weight: 800; }

      .save-btn {width: 100%; margin-top: 3rem; padding: 1.5rem; background: #6366f1; color: #fff; border: none; border-radius: 18px; font-weight: 900; font-size: 1.1rem; cursor: pointer; box-shadow: 0 10px 30px rgba(99, 102, 241, 0.3); }

      .sync-badge-active {background: rgba(52, 211, 153, 0.1); color: #34d399; padding: 0.4rem 1rem; border-radius: 8px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(52, 211, 153, 0.2); }
      .logout-btn {background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.4rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; transition: 0.3s; }
      .logout-btn:hover {background: #ef4444; color: #fff; }
      .modal-actions-row {display: flex; gap: 10px; align-items: center; }
      .user-context { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.75rem 1rem; background: rgba(255,255,255,0.03); border-radius: 12px; margin-bottom: 2rem; margin-top: -1.5rem; }
      .session-info { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
      .view-rules-btn { background: rgba(99, 102, 241, 0.1); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.2); padding: 0.4rem 1rem; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer; transition: 0.3s; }
      .view-rules-btn:hover { background: #6366f1; color: #fff; }
      .rules-explorer { background: #000; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; margin-bottom: 2rem; overflow: hidden; }
      .rules-scroll { max-height: 250px; overflow-y: auto; padding: 1rem; }
      .rule-box-header { display: flex; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 0.75rem 1rem; font-size: 0.7rem; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
      .rule-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem; font-weight: 700; color: #cbd5e1; }
      .rule-item:last-child { border-bottom: none; }
      .r-disc { color: #34d399; font-weight: 900; }
      /* Auth Wall Styles */
      .auth-wall-container {min-height: calc(100vh - 80px); display: flex; align-items: center; justify-content: center; padding: 2rem; background: radial-gradient(circle at center, #0f172a 0%, #020617 100%); }
      .auth-card {background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); padding: 3rem; border-radius: 36px; width: 100%; max-width: 440px; text-align: center; box-shadow: 0 40px 100px rgba(0,0,0,0.6); animation: fadeInUp 0.8s cubic-bezier(0.23, 1, 0.32, 1); }
      .auth-icon {width: 80px; height: 80px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; border: 1px solid rgba(99, 102, 241, 0.2); }
      .auth-card h2 {font-size: 2rem; font-weight: 900; margin-bottom: 0.75rem; letter-spacing: -0.5px; }
      .auth-card p {color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin-bottom: 2.5rem; }
      .auth-form {text-align: left; }
      .auth-field {position: relative; margin-bottom: 1.25rem; }
      .field-icon {position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: #64748b; }
      .auth-field input {width: 100%; background: #000; border: 1px solid rgba(255,255,255,0.1); padding: 1.2rem 1.2rem 1.2rem 3.5rem; border-radius: 16px; color: #fff; font-size: 1rem; font-weight: 700; outline: none; transition: 0.3s; }
      .auth-field input:focus {border-color: #6366f1; box-shadow: 0 0 20px rgba(99, 102, 241, 0.2); }
      .auth-submit {width: 100%; padding: 1.25rem; background: #6366f1; color: #fff; border: none; border-radius: 16px; font-weight: 900; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s; box-shadow: 0 10px 30px rgba(99, 102, 241, 0.3); }
      .auth-submit:hover:not(:disabled) {transform: translateY(-2px); box-shadow: 0 15px 40px rgba(99, 102, 241, 0.5); }
      .auth-submit.loading {opacity: 0.7; cursor: wait; }
      .auth-error-mini {background: rgba(239, 68, 68, 0.1); color: #f87171; padding: 0.75rem 1rem; border-radius: 12px; font-size: 0.8rem; font-weight: 700; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 8px; border: 1px solid rgba(239, 68, 68, 0.2); }
      .auth-footer {margin-top: 2.5rem; font-size: 0.7rem; color: #475569; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
      .nav-actions { display: flex; align-items: center; gap: 1.25rem; }
      .resync-timer { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #94a3b8; font-weight: 700; background: rgba(255,255,255,0.03); padding: 0.4rem 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
      .sync-dot { width: 6px; height: 6px; background: #34d399; border-radius: 50%; box-shadow: 0 0 10px #34d399; animation: pulse 2s infinite; }
      @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
      .spinning { animation: spin 1s linear infinite; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .nav-btn { background: none; border: none; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; padding: 8px; border-radius: 50%; }
      .nav-btn:hover { background: rgba(248, 113, 113, 0.1); transform: scale(1.1); }
      .nav-btn:active { transform: scale(0.9); }
      .nav-btn.spinning { pointer-events: none; opacity: 0.5; }

      @keyframes fadeInUp {from {opacity: 0; transform: translateY(20px); } to {opacity: 1; transform: translateY(0); } }

      .error-box {background: rgba(239,68,68,0.1); color: #ef4444; padding: 1.5rem; border-radius: 20px; border: 1px solid rgba(239, 68, 68, 0.3); margin-bottom: 2.5rem; display: flex; align-items: center; gap: 1.25rem; font-weight: 700; }
      .empty-state {text-align: center; padding: 10rem 2rem; color: #1e293b; }
      .empty-state p {margin-top: 1.5rem; font-size: 1.3rem; font-weight: 600; color: #64748b; }
      `}</style>
    </div >
  );
}

export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
