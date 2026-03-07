import axios from 'axios';
import * as XLSX from 'xlsx';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQuIU5ubtIXwz-j3TdBPeopdklMf567ywXY_tm63dxZIWRAobgDXEbpp5CR6ps55gMeXwT4nAZMlEmf/pub?output=xlsx";

async function diag() {
    try {
        const response = await axios.get(SHEET_URL, { responseType: 'arraybuffer' });
        const workbook = XLSX.read(new Uint8Array(response.data), { type: 'array' });
        
        console.log("SHEETS IN WORKBOOK:", workbook.SheetNames);

        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            console.log(`\n--- ANALYSIS OF SHEET: ${sheetName} ---`);
            
            // Log first 5 rows to see structure
            console.log("FIRST 5 ROWS:");
            jsonData.slice(0, 5).forEach((r, i) => console.log(`Row ${i}:`, JSON.stringify(r)));

            // Try to find headers
            let headerMap = {};
            for (let i = 0; i < Math.min(jsonData.length, 25); i++) {
                const row = jsonData[i] || [];
                const tempMap = {};
                row.forEach((cell, idx) => {
                    const uVal = String(cell || '').trim().toUpperCase();
                    const upClean = uVal.replace(/[^A-Z]/g, '');
                    if (upClean === 'BRAND' || upClean === 'MFG' || upClean === 'MAKE' || upClean === 'BRANDNAME' || upClean === 'MANUFACTURER' || upClean === 'COMPANY' || uVal.includes('BRAND') || uVal.includes('MAKE') || uVal.includes('MFG')) tempMap['Brand'] = idx;
                    else if (uVal.includes('PRICE') || uVal.includes('LIST')) tempMap['List Price'] = idx;
                });
                if (tempMap['List Price'] !== undefined) {
                    headerMap = tempMap;
                    console.log(`Headers found at Row ${i}:`, JSON.stringify(headerMap));
                    break;
                }
            }

            if (Object.keys(headerMap).length > 0) {
                const brands = new Set();
                jsonData.slice(5).forEach(r => {
                    const b = r[headerMap['Brand']];
                    if (b) brands.add(String(b).trim());
                });
                console.log("BRANDS FOUND IN DATA:", Array.from(brands));
            } else {
                console.log("NO HEADERS DETECTED FOR THIS SHEET.");
            }
        });

    } catch (e) {
        console.error("Diag failed", e);
    }
}

diag();
