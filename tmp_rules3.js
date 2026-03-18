import fs from 'fs';

async function check() {
    const res = await fetch('http://localhost:4000/api/data');
    const data = await res.json();
    
    console.log("ABSOLUTE FIRST 5 RULES:");
    console.log(JSON.stringify(data.discountRules.slice(0, 5).map(r => ({
        Sheet: r._tableName,
        Brand: r._raw.BRANDNAME,
        MOC: r._raw.MOC,
        Frame: r._raw.FRAME_RANGE,
        Discount: r._discount
    })), null, 2));
}

check();
