import * as XLSX from 'xlsx';
import { fetchSheetData } from '../services/excelService.js';

export const getPriceEngineData = async (req, res) => {
  try {
    const workbook = await fetchSheetData();
    const allMakes = {};
    const allDimensions = {};
    const sheetDiscounts = {};
    const allDiscountRules = [];
    let globalFieldConfig = {};

    const sheetList = workbook.SheetNames.map(name => ({
      name,
      worksheet: workbook.Sheets[name],
      jsonData: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }),
      sName: name.toUpperCase().trim()
    }));

    // PHASE 1: PROCESS ALL DISCOUNT SHEETS FIRST
    sheetList.filter(s => s.sName.includes('DISCOUNT')).forEach(sheet => {
      const { name: sheetName, jsonData, sName } = sheet;

      const findTables = (data) => {
        const tables = [];
        const headerRows = [];
        for (let i = 0; i < Math.min(data.length, 10); i++) {
          const r = data[i] || [];
          if (r.some(c => {
            const sc = String(c || '').toUpperCase();
            return sc.includes('BRAND') || sc.includes('DISCOUNT') || sc.includes('MFG') || sc.includes('MAKE');
          })) {
            headerRows.push(i);
          }
        }
        if (headerRows.length > 0) {
          const hIdx = headerRows[0];
          const r = data[hIdx];
          let currentTable = null;
          for (let j = 0; j < r.length; j++) {
            const val = String(r[j] || '').trim();
            if (val) {
              if (!currentTable || (j > 0 && !String(r[j - 1] || '').trim())) {
                currentTable = { startCol: j, hIdx, headers: [] };
                tables.push(currentTable);
              }
              currentTable.headers.push({ name: val, col: j });
            }
          }
        }
        return tables;
      };

      const tables = findTables(jsonData);
      tables.forEach((table, tIdx) => {
        let lastValues = {};
        for (let i = table.hIdx + 1; i < jsonData.length; i++) {
          const r = jsonData[i];
          if (!r) continue;
          const rule = { _raw: {}, _tableIdx: tIdx };
          let hasDiscount = false;
          table.headers.forEach(h => {
            let val = r[h.col];
            const hKey = h.name;
            const uH = hKey.toUpperCase().trim();
            let normKey = uH.replace(/[^A-Z0-9]/g, '');
            if (uH.includes('BRAND') || uH === 'MFG' || uH.includes('MANUFACTURER') || uH === 'MAKE') normKey = 'BRANDNAME';
            else if (uH === 'PRODUCT' || uH === 'CATEGORY' || uH === 'SERIES' || uH === 'ITEM') normKey = 'PRODUCT';
            else if (uH.includes('APPLICATION')) normKey = 'APPLICATION';
            else if (uH.includes('DUTY')) normKey = 'DUTYTYPE';
            else if (uH.includes('EFFICIENCY')) normKey = 'EFFICIENCY';
            else if (uH.includes('MOC') || uH.includes('MATERIAL')) normKey = 'MOC';
            else if (uH.includes('FRAME') || uH === 'RANGE') normKey = 'FRAME_RANGE';

            if (val === null || val === undefined || String(val).trim() === '') val = lastValues[normKey];
            else { lastValues[normKey] = val; }

            if (hKey.includes('%') || uH.includes('DISC') || uH === 'STANDARD DISCOUNT') {
              if (val !== null && val !== undefined && val !== '') {
                let dVal = val;
                if (typeof dVal === 'string') dVal = parseFloat(dVal.replace(/[^\d.]/g, ''));
                else if (typeof dVal === 'number' && dVal <= 1 && dVal > 0) dVal *= 100;
                rule._discount = Math.round((dVal || 0) * 100) / 100;
                hasDiscount = true;
              }
            } else {
              rule[hKey] = val;
              rule._raw[normKey] = val;
              // If the first column is not explicitly named PRODUCT, treat it as such anyway for table isolation
              if (h.col === table.startCol && !rule._raw['PRODUCT']) {
                rule._raw['PRODUCT'] = val;
              }
            }
          });
          rule._tableName = table.headers[0].name;
          if (hasDiscount) {
            const rawBName = String(rule._raw['BRANDNAME'] || '').toUpperCase().trim();
            const pName = String(rule._raw['PRODUCT'] || '').toUpperCase().trim();
            const mocVal = String(rule._raw['MOC'] || 'CI').trim().toUpperCase();
            const normalize = (s) => (String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
            const bName = normalize(rawBName);
            if (bName || pName) {
              const addDisc = (name) => { sheetDiscounts[`${name}-${mocVal}`] = rule._discount; };
              if (bName) {
                addDisc(bName);
                if (bName === 'BBL' || bName.includes('BHARATBIJLEE')) { addDisc('BBL'); addDisc('BHARATBIJLEE'); }
                if (bName === 'CG' || bName.includes('CROMPTON')) { addDisc('CG'); addDisc('CROMPTON'); addDisc('CROMPTONGREAVES'); }
              }
              allDiscountRules.push(rule);
            }
          }
        }
      });
      console.log(`[DISCOUNT] Processed ${sheetName}: found ${tables.length} tables, ${allDiscountRules.length} rules.`);
    });

    // PHASE 2: PROCESS ALL OTHER SHEETS
    sheetList.filter(s => !s.sName.includes('DISCOUNT') && s.sName !== 'AUTHORIZED').forEach(sheet => {
      const { name: sheetName, jsonData, sName } = sheet;
      if (jsonData && jsonData.length > 0) {
        let headerMap = null;
        let startIdx = 0;
        for (let i = 0; i < Math.min(jsonData.length, 25); i++) {
          const row = jsonData[i] || [];
          const tempMap = {};
          const prevRow = i > 0 ? jsonData[i - 1] : [];
          row.forEach((cell, idx) => {
            const val = String(cell || '').trim();
            if (!val) return;
            const uVal = val.toUpperCase();
            const upClean = uVal.replace(/[^A-Z]/g, '');
            if (upClean === 'BRAND' || upClean === 'MFG' || upClean === 'MAKE' || upClean === 'BRANDNAME' || upClean === 'MANUFACTURER' || upClean === 'COMPANY' || uVal.includes('BRAND') || uVal.includes('MAKE') || uVal.includes('MFG')) tempMap['Brand'] = idx;
            else if (uVal.includes('PRICE') || uVal.includes('LIST')) { if (!uVal.includes('NET')) tempMap['List Price'] = idx; }
            else { tempMap[val] = idx; }

            // Meta mapping from row above
            const meta = String(prevRow[idx] || '').toUpperCase();
            if (meta.includes('USER INPUT')) globalFieldConfig[val] = 'input';
            else if (meta.includes('DISPLAY LOGIC') || meta.includes('SYSTEM')) globalFieldConfig[val] = 'display';

            // Overrides for specific existing logic
            if (uVal === 'HP' || uVal === 'POLES' || uVal === 'RATIO' || uVal === 'SIZE' || uVal === 'MODEL' || uVal === 'TYPE') {
              if (!globalFieldConfig[val]) globalFieldConfig[val] = 'input';
            }
            if (uVal === 'FRAME' || uVal === 'MOC' || uVal === 'MATERIAL') {
              if (!globalFieldConfig[val]) globalFieldConfig[val] = 'display';
            }
          });
          if (tempMap['List Price'] !== undefined && Object.keys(tempMap).length > 1) {
            headerMap = tempMap; startIdx = i + 1; break;
          }
        }

        if (headerMap) {
          const sUpper = sheetName.toUpperCase();
          const isWorm = sUpper.includes('WORM');
          const isHelical = sUpper.includes('HELICAL');
          const isDrive = sUpper.includes('DRIVE') || sUpper.includes('VFD') || sUpper.includes('INVERTER');
          let cat = isDrive ? 'Drives' : (isWorm || isHelical ? 'Gearboxes' : 'Motors');

          // BRAND RESOLUTION FOR SHEETS MISSING BRAND COLUMN
          let forcedBrand = null;
          if (!headerMap['Brand']) {
            const matchingRule = allDiscountRules.find(r => {
              const rProd = String(r._raw['PRODUCT'] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
              const sClean = sUpper.replace(/[^A-Z0-9]/g, '');
              return rProd === sClean || sClean.includes(rProd) || rProd.includes(sClean);
            });
            if (matchingRule) forcedBrand = matchingRule._raw['BRANDNAME'];
          }

          const rows = jsonData.slice(startIdx).map(row => {
            const obj = { _category: cat, _sheet: sheetName, _subCategory: (isWorm ? 'Worm' : (isHelical ? 'Helical' : '')) };
            obj._type = (headerMap['Type'] && row[headerMap['Type']]) ? String(row[headerMap['Type']]).trim() : ((cat === 'Motors' || cat === 'Drives') ? 'Standard' : sheetName);
            Object.keys(headerMap).forEach(key => {
              let val = row[headerMap[key]];
              if (key === 'List Price') val = parseFloat(String(val || 0).replace(/[^\d.]/g, '')) || 0;
              else val = String(val || '').trim();
              obj[key] = val;
            });
            if (forcedBrand) obj.Brand = forcedBrand;
            return obj;
          }).filter(r => r['List Price'] > 0);

          rows.forEach(r => {
            const brandKey = r['Brand'] || sheetName;
            r.Brand = brandKey;
            if (!allMakes[brandKey]) allMakes[brandKey] = [];
            allMakes[brandKey].push(r);
          });

          // Dim Scan... same as before
          let dimHeaderMap = null; let dimStartIdx = -1;
          for (let i = startIdx + rows.length; i < Math.min(jsonData.length, startIdx + rows.length + 50); i++) {
            const row = jsonData[i] || [];
            const dMap = {};
            row.forEach((cell, idx) => {
              const v = String(cell || '').trim().toUpperCase();
              if (v.includes('SHAFT') || v.includes('DIA')) dMap['Shaft'] = idx;
              else if (v.includes('BORE')) dMap['Bore'] = idx;
              else if (v.includes('CENTRE') || v === 'CD') dMap['Center Distance'] = idx;
              else if (v === 'A' || v === 'B' || v === 'D' || v === 'E') dMap[v] = idx;
            });
            if (Object.keys(dMap).length >= 2) { dimHeaderMap = dMap; dimStartIdx = i + 1; break; }
          }
          if (dimHeaderMap) {
            const sDims = {};
            jsonData.slice(dimStartIdx).forEach(row => {
              const mVal = String(row[0] || '').trim();
              if (!mVal) return;
              const dObj = {};
              Object.keys(dimHeaderMap).forEach(dk => { dObj[dk] = row[dimHeaderMap[dk]]; });
              sDims[mVal] = dObj;
            });
            allDimensions[sheetName] = sDims;
          }
        }
      }
    });

    res.json({
      makesData: allMakes,
      fieldConfig: globalFieldConfig,
      dimensionsData: allDimensions,
      sheetDiscounts: sheetDiscounts,
      discountRules: allDiscountRules,
      lastRefreshed: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch engine data" });
  }
};

export const getAuthorizedUsers = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const workbook = await fetchSheetData();
    const cleanEmail = email.toLowerCase().trim();
    let authorized = false;
    let role = 'user';
    let discountDeviation = 0;

    const authSheetName = workbook.SheetNames.find(n => n.toUpperCase().trim() === 'AUTHORIZED');
    if (!authSheetName) return res.status(500).json({ error: "Auth sheet not found" });

    const worksheet = workbook.Sheets[authSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Find headers to look for "Disc. Deviation"
    const headers = jsonData[0] || [];
    const devIdx = headers.findIndex(h => String(h || '').toUpperCase().includes('DEVIATION'));

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row && row.some(cell => String(cell || '').toLowerCase().trim() === cleanEmail)) {
        authorized = true;
        // Check Role
        const roleIdx = headers.findIndex(h => String(h || '').toUpperCase() === 'ROLE');
        if (roleIdx !== -1 && String(row[roleIdx] || '').toUpperCase().trim() === 'ADMIN') {
          role = 'admin';
        }
        // Capture Deviation
        if (devIdx !== -1) {
          discountDeviation = parseFloat(row[devIdx]) || 0;
        }
        break;
      }
    }

    if (authorized) {
      res.json({ authorized: true, role, deviation: discountDeviation });
    } else {
      res.json({ authorized: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Authentication engine failed" });
  }
};
