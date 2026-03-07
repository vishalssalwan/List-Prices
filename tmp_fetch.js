import axios from 'axios';

async function testFetch() {
    try {
        const response = await axios.get('http://localhost:4000/api/data');
        const { discountRules, sheetDiscounts } = response.data;
        console.log(`Rules: ${discountRules.length}`);
        console.log(`Fallback Keys: ${Object.keys(sheetDiscounts || {}).length}`);
        console.log(`First Discount Key: ${Object.keys(sheetDiscounts || {})[0]}`);
        console.log(`First Rule Brand: ${discountRules[0]?._raw?.BRANDNAME}`);
    } catch (e) {
        console.error("Fetch failed", e);
    }
}

testFetch();
