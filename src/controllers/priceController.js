import * as XLSX from 'xlsx';
import jwt from 'jsonwebtoken';
import { fetchSheetData } from '../services/excelService.js';
import { parseDiscountSheets, parsePricingSheets, parseAllAuthUsers } from '../services/excelParser.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_123';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'fallback_refresh_key_123';

// Mock DB for refresh tokens
const activeRefreshTokens = new Set();

// --- IN-MEMORY CACHE ---
let cache = {
  engineData: null,
  authUsers: null,
  lastFetchTime: 0
};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- REFRESH LOGIC ---
const refreshCacheIfStale = async () => {
  const now = Date.now();
  if (cache.lastFetchTime && (now - cache.lastFetchTime < CACHE_TTL_MS)) {
    return; // Cache is still fresh, do nothing.
  }

  console.log("Cache stale/empty. Fetching and Parsing Excel Data...");
  const workbook = await fetchSheetData();

  // 1. Build Authorized Users Hash Map (O(1) lookup map)
  cache.authUsers = parseAllAuthUsers(workbook);

  // 2. Build Engine Data
  const sheetList = workbook.SheetNames.map(name => ({
    name,
    worksheet: workbook.Sheets[name],
    jsonData: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }),
    sName: name.toUpperCase().trim()
  }));

  const { sheetDiscounts, allDiscountRules } = parseDiscountSheets(sheetList);
  const { allMakes, globalFieldConfig, allDimensions } = parsePricingSheets(sheetList, allDiscountRules);

  cache.engineData = {
    makesData: allMakes,
    fieldConfig: globalFieldConfig,
    dimensionsData: allDimensions,
    sheetDiscounts: sheetDiscounts,
    discountRules: allDiscountRules,
    lastRefreshed: new Date().toISOString(),
  };

  cache.lastFetchTime = now;
};

export const getPriceEngineData = async (req, res) => {
  try {
    await refreshCacheIfStale();
    res.json(cache.engineData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch engine data" });
  }
};

export const getAuthorizedUsers = async (req, res) => {
  const email = req.body.email || req.query.email;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    await refreshCacheIfStale();

    const cleanEmail = String(email).toLowerCase().trim();
    const user = cache.authUsers[cleanEmail];

    if (user && user.authorized) {
      // 1. Generate Tokens
      const accessToken = jwt.sign({ email: cleanEmail, role: user.role, deviation: user.deviation }, JWT_SECRET, { expiresIn: '15m' });
      const refreshTokenValue = jwt.sign({ email: cleanEmail }, REFRESH_SECRET, { expiresIn: '7d' });
      
      activeRefreshTokens.add(refreshTokenValue);

      // 2. Set Secure HttpOnly Cookie
      res.cookie('refreshToken', refreshTokenValue, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({ authorized: true, role: user.role, deviation: user.deviation, accessToken, email: cleanEmail });
    } else {
      res.status(401).json({ authorized: false, error: "Email not authorized" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Authentication engine failed" });
  }
};

export const refreshToken = async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: "No refresh token provided" });
    if (!activeRefreshTokens.has(token)) return res.status(403).json({ error: "Invalid refresh token" });

    try {
        const decoded = jwt.verify(token, REFRESH_SECRET);
        await refreshCacheIfStale();
        const user = cache.authUsers[decoded.email];
        
        if (!user || !user.authorized) {
            return res.status(403).json({ error: "User no longer authorized" });
        }

        const newAccessToken = jwt.sign({ email: decoded.email, role: user.role, deviation: user.deviation }, JWT_SECRET, { expiresIn: '15m' });
        res.json({ accessToken: newAccessToken, role: user.role, deviation: user.deviation, authorized: true, email: decoded.email });
    } catch (err) {
        activeRefreshTokens.delete(token); // Invalid signature
        return res.status(403).json({ error: "Refresh token expired or invalid" });
    }
};

export const logoutUser = (req, res) => {
    const token = req.cookies?.refreshToken;
    if (token) activeRefreshTokens.delete(token);
    res.clearCookie('refreshToken');
    res.json({ success: true });
};
