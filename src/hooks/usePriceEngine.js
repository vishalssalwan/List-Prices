import { useState, useEffect, useCallback } from 'react';

const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? "http://localhost:4000/api"
        : "https://list-prices.onrender.com/api";
};
const API_URL = getApiUrl();

export function usePriceEngine() {
    const [makesData, setMakesData] = useState({});
    const [fieldConfig, setFieldConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [discounts, setDiscounts] = useState({});
    const [config, setConfig] = useState({
        profitMargin: 10
    });
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [discountRules, setDiscountRules] = useState([]);
    const [discountsFromSheet, setDiscountsFromSheet] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authEmail, setAuthEmail] = useState('');
    const [userRole, setUserRole] = useState('user');
    const [userDeviation, setUserDeviation] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${API_URL}/data?t=${Date.now()}`);
            if (!response.ok) throw new Error('API server unreachable.');
            const data = await response.json();
            const { makesData: apiData, fieldConfig: apiFields, sheetDiscounts, discountRules: apiRules, lastRefreshed: apiTime } = data;

            if (!apiData || Object.keys(apiData).length === 0) {
                setError("No data returned from engine.");
            } else {
                setMakesData(apiData);
                setFieldConfig(apiFields || {});
                setDiscountRules(apiRules || []);
                setDiscountsFromSheet(Object.keys(sheetDiscounts || {}).length > 0);
                setLastRefreshed(apiTime || new Date().toISOString());

                setDiscounts(prev => {
                    const next = { ...prev };
                    Object.keys(sheetDiscounts || {}).forEach(k => next[String(k).toUpperCase().trim()] = sheetDiscounts[k]);
                    return next;
                });
            }
        } catch (err) {
            console.error("Fetch Error:", err);
            setError("Sync failed: Backend connection error.");
        } finally {
            setLoading(false);
        }
    }, []);

    const verifyAccess = useCallback(async (email) => {
        try {
            const res = await fetch(`${API_URL}/auth?email=${encodeURIComponent(email)}&t=${Date.now()}`);
            const { authorized, role, deviation } = await res.json();
            if (authorized) {
                setIsAuthenticated(true);
                setUserRole(role);
                setAuthEmail(email);
                setUserDeviation(deviation || 0);
                localStorage.setItem('userEmail', email);
                localStorage.setItem('userAuthenticated', 'true');
                localStorage.setItem('userRole', role);
                localStorage.setItem('userDeviation', String(deviation || 0));
                fetchData();
                return { success: true };
            } else {
                return { success: false, error: 'Email not authorized.' };
            }
        } catch (err) {
            return { success: false, error: "Auth sync failed. Try again." };
        }
    }, [fetchData]);

    const logout = useCallback(() => {
        localStorage.clear();
        setIsAuthenticated(false);
        setAuthEmail('');
        setMakesData({});
    }, []);

    const updateConfig = useCallback((key, value) => {
        setConfig(prev => {
            const next = { ...prev, [key]: parseFloat(value) || 0 };
            localStorage.setItem('motorConfig_v4', JSON.stringify(next));
            return next;
        });
    }, []);

    const updateDiscount = useCallback((key, value) => {
        setDiscounts(prev => {
            const next = { ...prev, [String(key).toUpperCase().trim()]: parseFloat(value) || 0 };
            localStorage.setItem('motorDiscounts_v4', JSON.stringify(next));
            return next;
        });
    }, []);

    useEffect(() => {
        const auth = localStorage.getItem('userAuthenticated');
        const role = localStorage.getItem('userRole');
        if (auth === 'true') {
            setIsAuthenticated(true);
            setUserRole(role || 'user');
            setAuthEmail(localStorage.getItem('userEmail') || '');
            setUserDeviation(parseFloat(localStorage.getItem('userDeviation') || '0'));
            fetchData();
        } else {
            setLoading(false);
        }

        const savedDiscounts = localStorage.getItem('motorDiscounts_v4');
        const savedConfig = localStorage.getItem('motorConfig_v4');
        if (savedDiscounts) setDiscounts(JSON.parse(savedDiscounts));
        if (savedConfig) setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig) }));
    }, [fetchData]);

    return {
        makesData, fieldConfig, loading, error, showSettings: false,
        discounts, config, lastRefreshed, discountRules, discountsFromSheet,
        isAuthenticated, authEmail, userRole, userDeviation,
        fetchData, verifyAccess, logout, updateConfig, updateDiscount
    };
}
