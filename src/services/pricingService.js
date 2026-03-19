/**
 * Pricing Service
 * Handles complex discount rule matching and net price calculations.
 */

export const getAdjustedPrice = (lp, frame, category, config) => {
    return lp;
};

export const normalizeBrand = (s) => {
    const up = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (up === 'BBL' || up.includes('BHARATBIJLEE')) return 'BHARATBIJLEE';
    if (up === 'CG' || up === 'CROMPTON' || up.includes('CROMPTONGREAVES')) return 'CROMPTONGREAVES';
    if (['ABB', 'SIEMENS', 'PREMIUM', 'ELECON'].includes(up)) return up;
    return up;
};

export const lookupDiscount = (row, discountRules, staticDiscounts) => {
    let matchedDiscount = 0;
    let ruleIdx = -1;

    // Lifted out of loop for massive performance gain -> O(1) row processing
    const rowBrand = normalizeBrand(row.Brand || row.Make || row._sheet);
    const rowMoc = String(row.MOC || row.Material || 'CI').toUpperCase();
    const rowSheet = String(row._sheet || '').toUpperCase();
    const rowCat = String(row._category || '').toUpperCase();
    const rowEff = String(row.Efficiency || row.EFFICIENCY || '').toUpperCase();
    const rowDuty = String(row['Duty Type'] || row.DUTYTYPE || row.Duty || '').toUpperCase();
    const rowFrame = String(row.Frame || row.FRAME || row['Frame Size'] || '').toUpperCase();

    // 1. Try Matching Complex Rules
    ruleIdx = discountRules.findIndex(rule => {
        const rProd = String(rule._raw?.PRODUCT || '').toUpperCase();
        const rBrand = String(rule._raw?.BRANDNAME || '').toUpperCase();
        const rMoc = String(rule._raw?.MOC || '').toUpperCase();
        const rEff = String(rule._raw?.EFFICIENCY || '').toUpperCase();
        const rDuty = String(rule._raw?.DUTYTYPE || '').toUpperCase();
        const rFrame = String(rule._raw?.FRAME_RANGE || '').toUpperCase().trim();

        // Brand Match
        const brandMatch = !rBrand || rBrand === 'ALL' || normalizeBrand(rBrand) === rowBrand;

        // Product/Category/Sheet Match
        const productMatch = !rProd || rProd === 'ALL' ||
            rowSheet.includes(rProd) ||
            rowCat.includes(rProd) ||
            rProd.includes(rowSheet);

        // MOC Match
        const mocMatch = !rMoc || rMoc === 'ALL' || rMoc.split(',').some(m => m.trim() === rowMoc);

        // Efficiency Match
        const effMatch = !rEff || rEff === 'ALL' || rEff === rowEff;

        // Duty Type Match
        const dutyMatch = !rDuty || rDuty === 'ALL' || rDuty === rowDuty;

        // Frame Match
        let frameMatch = true;
        if (rFrame && rFrame !== 'ALL' && rowCat === 'MOTORS') {
            if (!rowFrame) {
                // If rule requires a frame size, but motor has none, it's a mismatch
                frameMatch = false; 
            } else {
                const frameNum = parseFloat(rowFrame.replace(/[^0-9.]/g, ''));
                if (!isNaN(frameNum)) {
                    if (rFrame.includes('-')) {
                        const parts = rFrame.split('-');
                        const min = parseFloat(parts[0].replace(/[^0-9.]/g, ''));
                        const max = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
                        if (!isNaN(min) && !isNaN(max)) {
                            frameMatch = frameNum >= min && frameNum <= max;
                        }
                    } else if (rFrame.startsWith('<=')) {
                        frameMatch = frameNum <= parseFloat(rFrame.replace(/[^0-9.]/g, ''));
                    } else if (rFrame.startsWith('>=')) {
                        frameMatch = frameNum >= parseFloat(rFrame.replace(/[^0-9.]/g, ''));
                    } else if (rFrame.startsWith('<')) {
                        frameMatch = frameNum < parseFloat(rFrame.replace(/[^0-9.]/g, ''));
                    } else if (rFrame.startsWith('>')) {
                        frameMatch = frameNum > parseFloat(rFrame.replace(/[^0-9.]/g, ''));
                    } else {
                        frameMatch = frameNum === parseFloat(rFrame.replace(/[^0-9.]/g, ''));
                    }
                } else {
                    frameMatch = rFrame === rowFrame;
                }
            }
        }

        return brandMatch && productMatch && mocMatch && effMatch && dutyMatch && frameMatch;
    });

    if (ruleIdx !== -1) {
        matchedDiscount = discountRules[ruleIdx]._discount;
    } else {
        // 2. Fallback to Static Brand-MOC Lookup
        const brand = normalizeBrand(row.Brand || row.Make || row._sheet);
        const moc = String(row.MOC || row.Material || 'CI').toUpperCase();
        matchedDiscount = staticDiscounts[`${brand}-${moc}`] || staticDiscounts[brand] || 0;
    }

    return { discount: matchedDiscount, ruleIdx: ruleIdx !== -1 ? ruleIdx + 1 : 'FB' };
};

export const calculateComparison = (referenceVariant, filters, activeCategory, makesData, discounts, discountRules, config, userDeviation = 0) => {
    if (!referenceVariant) return null;

    const refAdjLp = getAdjustedPrice(referenceVariant['List Price'], referenceVariant.Frame, activeCategory, config);
    const { discount: baseRefDisc, ruleIdx: refRuleIdx } = lookupDiscount(referenceVariant, discountRules, discounts);
    const refDisc = baseRefDisc + (userDeviation || 0);
    const refNet = refAdjLp * (1 - refDisc / 100);

    const brands = Object.keys(makesData).flatMap(make => {
        const matches = (makesData[make] || []).filter(r => {
            if (r._category !== activeCategory) return false;

            return Object.keys(filters).every(k => {
                if (!filters[k]) return true;

                // IGNORE brand/frame filters when looking for cross-brand matches
                const key = k.toUpperCase();
                if (key.includes('BRAND') || key.includes('MAKE') || key.includes('FRAME')) return true;

                return String(r[k] || '').toUpperCase() === String(filters[k] || '').toUpperCase();
            });
        });

        return matches.map(m => {
            const adjLp = getAdjustedPrice(m['List Price'], m.Frame, activeCategory, config);
            const { discount: baseDisc } = lookupDiscount(m, discountRules, discounts);
            const disc = baseDisc + (userDeviation || 0);
            const net = adjLp * (1 - disc / 100);

            return {
                id: `${make}-${m['List Price']}-${m.Frame}-${m.MOC}`,
                make, lp: m['List Price'], adjLp, net,
                moc: m.MOC, frame: m.Frame, discount: disc, rowRaw: m,
                baseDiscount: baseDisc,
                deviation: userDeviation,
                diffINR: net - refNet,
                diffPercent: refNet > 0 ? ((net - refNet) / refNet) * 100 : 0,
                equivDiscount: adjLp > 0 ? ((adjLp - refNet) / adjLp) * 100 : 0,
                isRef: JSON.stringify(m) === JSON.stringify(referenceVariant)
            };
        });
    }).sort((a, b) => a.net - b.net);

    return {
        refNet,
        brands,
        refMotor: referenceVariant,
        refDiscount: refDisc,
        debug: { base: refDisc, matchedIdx: refRuleIdx, deviation: userDeviation }
    };
};
