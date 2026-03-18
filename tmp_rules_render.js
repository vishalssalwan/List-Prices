import fs from 'fs';

async function check() {
    const res = await fetch('https://list-prices.onrender.com/api/data');
    const data = await res.json();
    
    // Find BBL Motors discount rules
    const bblRules = data.discountRules.filter(r => 
        (r._raw.BRANDNAME === 'BBL' || !r._raw.BRANDNAME) && 
        (r._raw.MOC === 'CI' || !r._raw.MOC) &&
        (r._raw.PRODUCT === 'Motors' || !r._raw.PRODUCT) &&
        (r._raw.EFFICIENCY === 'IE2' || !r._raw.EFFICIENCY)
    );
    
    console.log("RULES ON RENDER SERVER:", bblRules.map(r => ({
        Frame: r._raw.FRAME_RANGE,
        Discount: r._discount
    })));
}

check();
