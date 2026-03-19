import * as XLSX from 'xlsx';

export const parseDiscountSheets = (sheetList) => {
  const sheetDiscounts = {};
  const allDiscountRules = [];

  sheetList.filter(s => s.sName.includes('DISCOUNT')).forEach(sheet => {
    const { name: sheetName, jsonData } = sheet;

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

  return { sheetDiscounts, allDiscountRules };
};

export const parsePricingSheets = (sheetList, allDiscountRules) => {
  const allMakes = {};
  const allDimensions = {};
  let globalFieldConfig = {};

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

          const meta = String(prevRow[idx] || '').toUpperCase();
          if (meta.includes('USER INPUT')) globalFieldConfig[val] = 'input';
          else if (meta.includes('DISPLAY LOGIC') || meta.includes('SYSTEM')) globalFieldConfig[val] = 'display';

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

  return { allMakes, globalFieldConfig, allDimensions };
};

export const parseAllAuthUsers = (workbook) => {
  const authMap = {}; // Maps cleanEmail -> { authorized, role, deviation }

  const authSheetName = workbook.SheetNames.find(n => n.toUpperCase().trim() === 'AUTHORIZED');
  if (!authSheetName) return authMap; // Returns empty map if no auth sheet

  const worksheet = workbook.Sheets[authSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const headers = jsonData[0] || [];
  const devIdx = headers.findIndex(h => String(h || '').toUpperCase().includes('DEVIATION'));
  const roleIdx = headers.findIndex(h => String(h || '').toUpperCase() === 'ROLE');

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row) continue;
    
    // Find the email cell (any string containing '@' or just scan the whole row)
    const emailCell = row.find(cell => typeof cell === 'string' && cell.includes('@'));
    
    // Alternatively, preserving your original flexible logic: 
    // we take the first cell that looks like an email.
    if (emailCell) {
      const cleanEmail = emailCell.toLowerCase().trim();
      let role = 'user';
      let deviation = 0;
      
      if (roleIdx !== -1 && String(row[roleIdx] || '').toUpperCase().trim() === 'ADMIN') {
        role = 'admin';
      }
      if (devIdx !== -1) {
        deviation = parseFloat(row[devIdx]) || 0;
      }
      
      authMap[cleanEmail] = { authorized: true, role, deviation };
    }
  }

  return authMap;
};
