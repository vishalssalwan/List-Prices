import fs from 'fs';

async function check() {
    const res = await fetch('http://localhost:4000/api/data');
    const data = await res.json();
    
    // Find BBL Motors discount rules
    const bblRules = data.discountRules.filter(r => 
        r._raw.BRANDNAME === 'BBL' && 
        r._raw.MOC === 'CI' &&
        r._raw.PRODUCT === 'Motors' &&
        r._raw.EFFICIENCY === 'IE2'
    );
    
    console.log("RULES:", bblRules.map(r => ({
        Frame: r._raw.FRAME_RANGE,
        Discount: r._discount
    })));
}

check();
