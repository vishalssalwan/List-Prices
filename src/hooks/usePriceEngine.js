import { useState, useEffect, useCallback } from 'react';
import apiClient, { setAccessToken } from '../services/apiClient';

export function usePriceEngine() {
    const [makesData, setMakesData] = useState({});
    const [fieldConfig, setFieldConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [discounts, setDiscounts] = useState({});
    const [config, setConfig] = useState({ profitMargin: 10 });
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [discountRules, setDiscountRules] = useState([]);
    const [discountsFromSheet, setDiscountsFromSheet] = useState(false);
    
    // Auth State (Secure Memory-Only Tracking)
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authEmail, setAuthEmail] = useState('');
    const [userRole, setUserRole] = useState('user');
    const [userDeviation, setUserDeviation] = useState(0);
    const [isAuthChecking, setIsAuthChecking] = useState(true); // Prevents UI flash before hydration

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Replaced fetch() with securely intercepted apiClient
            const response = await apiClient.get(`/data?t=${Date.now()}`);
            const data = response.data;
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
            if (err.response?.status !== 401) {
                setError("Sync failed: Backend connection error.");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const verifyAccess = useCallback(async (email) => {
        try {
            // Initiate standard Login request
            const res = await apiClient.post(`/auth`, { email });
            const { authorized, role, deviation, accessToken } = res.data;
            
            if (authorized && accessToken) {
                setAccessToken(accessToken); // Store securely in JS memory scope
                setIsAuthenticated(true);
                setUserRole(role);
                setAuthEmail(email);
                setUserDeviation(deviation || 0);

                // Remember email for caching/quality of life only, not for auth boundaries
                localStorage.setItem('userEmail', email);

                fetchData();
                return { success: true };
            } else {
                return { success: false, error: 'Email not authorized.' };
            }
        } catch (err) {
            if (err.response?.status === 401) {
                 return { success: false, error: "Email not authorized." };
            }
            return { success: false, error: "Auth sync failed. Try again." };
        }
    }, [fetchData]);

    const logout = useCallback(async () => {
        try {
            // Signal server to invalidate and strip HttpOnly cookie
            await apiClient.post('/auth/logout');
        } catch (e) { /* ignore */ }
        
        setAccessToken(null);
        localStorage.removeItem('userEmail'); // Erase QOL cache
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

    // Initial Subroutine: Hydration
    useEffect(() => {
        const attemptHydration = async () => {
             try {
                  // Transparently ping the refresh route. If the browser holds a valid HttpOnly cookie, it grants standard access
                  const res = await apiClient.post('/auth/refresh');
                  const { accessToken, email, role, deviation } = res.data;
                  
                  setAccessToken(accessToken);
                  setIsAuthenticated(true);
                  setUserRole(role || 'user');
                  setAuthEmail(email);
                  setUserDeviation(deviation || 0);
                  localStorage.setItem('userEmail', email);
                  
                  // Secure session established: load actual product data
                  fetchData();
             } catch (err) {
                  // No valid cookie, user is safely designated unauthenticated
                  setIsAuthenticated(false);
                  setLoading(false);
             } finally {
                  setIsAuthChecking(false);
             }
        };

        attemptHydration();

        const savedDiscounts = localStorage.getItem('motorDiscounts_v4');
        const savedConfig = localStorage.getItem('motorConfig_v4');
        if (savedDiscounts) setDiscounts(JSON.parse(savedDiscounts));
        if (savedConfig) setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig) }));

        // Seamless Global Escaping Router Hook
        const handleForceLogout = () => logout();
        window.addEventListener('auth-expired', handleForceLogout);
        return () => window.removeEventListener('auth-expired', handleForceLogout);
        
    }, [fetchData, logout]);

    return {
        makesData, fieldConfig, loading: loading || isAuthChecking, error, showSettings: false,
        discounts, config, lastRefreshed, discountRules, discountsFromSheet,
        isAuthenticated, authEmail, userRole, userDeviation,
        fetchData, verifyAccess, logout, updateConfig, updateDiscount,
        isAuthChecking // Passed downward to tell UI we are still verifying initial auth cookie
    };
}
