import fs from 'fs';

async function check() {
    const res = await fetch('http://localhost:4000/api/data');
    const data = await res.json();
    
    // Find ALL rules
    console.log("ALL BBL RULES (first 10):", data.discountRules
        .filter(r => r._raw.BRANDNAME === 'BBL' || !r._raw.BRANDNAME)
        .slice(0, 10)
        .map(r => ({
            Product: r._raw.PRODUCT,
            Brand: r._raw.BRANDNAME,
            MOC: r._raw.MOC,
            Frame: r._raw.FRAME_RANGE,
            Discount: r._discount
        }))
    );
}

check();
