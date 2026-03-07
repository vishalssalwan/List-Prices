import axios from 'axios';
import * as XLSX from 'xlsx';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQuIU5ubtIXwz-j3TdBPeopdklMf567ywXY_tm63dxZIWRAobgDXEbpp5CR6ps55gMeXwT4nAZMlEmf/pub?output=xlsx";

const normalize = (s) => {
    let up = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (up === 'BBL' || up.includes('BHARATBIJLEE')) return 'BHARATBIJLEE';
    if (up === 'CG' || up === 'CROMPTON' || up.includes('CROMPTONGREAVES')) return 'CROMPTONGREAVES';
    return up;
};

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
                if (!currentTable || (j > 0 && !r[j-1] && !data[hIdx-1]?.[j])) {
                    if (currentTable) tables.push(currentTable);
                    currentTable = { startCol: j, hIdx, headers: [] };
                }
                currentTable.headers.push({ name: val, col: j });
            }
        }
        if (currentTable) tables.push(currentTable);
    }
    return tables;
};

async function test() {
    try {
        const response = await axios.get(SHEET_URL, { responseType: 'arraybuffer' });
        const workbook = XLSX.read(new Uint8Array(response.data), { type: 'array' });
        const sheetDiscounts = {};
        const allDiscountRules = [];

        workbook.SheetNames.forEach(sheetName => {
            if (sheetName.toUpperCase().includes('DISCOUNT')) {
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                const tables = findTables(jsonData);
                console.log(`Found ${tables.length} tables in ${sheetName}`);

                tables.forEach((table, tidx) => {
                    console.log(`Table ${tidx}: columns ${table.startCol} headers: ${table.headers.map(h => h.name).join(', ')}`);
                    let lastValues = {};
                    for (let i = table.hIdx + 1; i < jsonData.length; i++) {
                        const r = jsonData[i];
                        if (!r) continue;
                        const rule = { _raw: {} };
                        let hasDiscount = false;
                        let rowHasData = false;
                        
                        table.headers.forEach(h => {
                            let val = r[h.col];
                            const hKey = h.name;
                            const uH = hKey.toUpperCase();
                            let normKey = uH.replace(/[^A-Z0-9]/g, '');
                            
                            if (uH.includes('BRAND') || uH === 'MFG' || uH.includes('MANUFACTURER') || uH === 'MAKE') normKey = 'BRANDNAME';
                            else if (uH === 'PRODUCT' || uH === 'CATEGORY' || uH === 'SERIES' || uH === 'ITEM') normKey = 'PRODUCT';
                            else if (uH.includes('APPLICATION')) normKey = 'APPLICATION';
                            else if (uH.includes('DUTY')) normKey = 'DUTYTYPE';
                            else if (uH.includes('EFFICIENCY')) normKey = 'EFFICIENCY';
                            else if (uH.includes('MOC') || uH.includes('MATERIAL')) normKey = 'MOC';

                            if ((normKey === 'PRODUCT' || normKey === 'BRANDNAME' || normKey === 'APPLICATION' || normKey === 'MOC') && (val === null || val === undefined || String(val).trim() === '')) {
                                val = lastValues[normKey];
                            } else if (val !== null && val !== undefined && String(val).trim() !== '') {
                                lastValues[normKey] = val;
                            }

                            if (hKey.includes('%') || uH.includes('DISC')) {
                                if (val !== null && val !== undefined && val !== '') {
                                    let dVal = val;
                                    if (typeof dVal === 'string') dVal = parseFloat(dVal.replace(/[^\d.]/g, ''));
                                    else if (typeof dVal === 'number' && dVal <= 1 && dVal > 0) dVal *= 100;
                                    rule._discount = dVal || 0;
                                    hasDiscount = true;
                                }
                            } else {
                                rule[hKey] = val;
                                rule._raw[normKey] = val;
                                if (val !== null && val !== undefined && String(val).trim() !== '') rowHasData = true;
                            }
                        });

                        if (hasDiscount && rowHasData) {
                            const rawBName = String(rule._raw['BRANDNAME'] || '').toUpperCase().trim();
                            const bName = normalize(rawBName);
                            const mocVal = String(rule._raw['MOC'] || 'CI').trim().toUpperCase();
                            
                            allDiscountRules.push(rule);
                            if (bName) {
                                sheetDiscounts[`${bName}-${mocVal}`] = rule._discount;
                                if (bName === 'BHARATBIJLEE') sheetDiscounts[`BBL-${mocVal}`] = rule._discount;
                                if (bName === 'CROMPTONGREAVES') {
                                    sheetDiscounts[`CG-${mocVal}`] = rule._discount;
                                    sheetDiscounts[`CROMPTON-${mocVal}`] = rule._discount;
                                }
                            }
                        }
                    }
                });
            }
        });

        console.log("FINAL Sheet Discounts:", JSON.stringify(sheetDiscounts, null, 2));
        console.log("Discount Rules Count:", allDiscountRules.length);
        if (allDiscountRules.length > 0) {
            console.log("Example Rule 0:", JSON.stringify(allDiscountRules[0], null, 2));
        }

    } catch (e) {
        console.error("Test failed", e);
    }
}

test();
