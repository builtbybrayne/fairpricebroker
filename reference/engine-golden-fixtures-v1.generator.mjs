// Golden-fixture generator for T3-m1-engine-port.
// The algorithm functions below are copied VERBATIM from
// /Users/al/Studio/projects/vwpa/product/vwpa.jsx lines 5–225 (the maths
// portion only; React/UI excluded). Only additions: export-free harness,
// parameterised threshold pass-through (runConvergence already takes it).

function arithmeticMidpoint(overlapLow, overlapHigh) {
    return (overlapLow + overlapHigh) / 2;
}

function geometricMean(overlapLow, overlapHigh) {
    return Math.sqrt(overlapLow * overlapHigh);
}

function nashBargaining(buyer, seller, overlapLow, overlapHigh) {
    const sellerWorst = seller[0];
    const buyerWorst = buyer[3];
    const nash = (buyerWorst + sellerWorst) / 2;
    return Math.max(overlapLow, Math.min(overlapHigh, nash));
}

function kalaiSmorodinsky(buyer, seller, overlapLow, overlapHigh) {
    const buyerIdeal = overlapLow;
    const buyerWorst = buyer[3];
    const sellerIdeal = overlapHigh;
    const sellerWorst = seller[0];

    const buyerRange = buyerWorst - buyerIdeal;
    const sellerRange = sellerIdeal - sellerWorst;

    if (buyerRange + sellerRange === 0) return (overlapLow + overlapHigh) / 2;

    const ks = (buyerWorst * sellerRange + sellerWorst * buyerRange) / (buyerRange + sellerRange);
    return Math.max(overlapLow, Math.min(overlapHigh, ks));
}

function jointAcceptabilityPeak(buyer, seller, overlapLow, overlapHigh) {
    function trapezoid(x, points) {
        const [tooLow, bargain, expensive, tooHigh] = points;
        if (x <= tooLow || x >= tooHigh) return 0;
        if (x < bargain) return (x - tooLow) / (bargain - tooLow);
        if (x <= expensive) return 1;
        return (tooHigh - x) / (tooHigh - expensive);
    }

    let bestPrice = overlapLow;
    let bestScore = -1;
    const steps = 200;
    const step = (overlapHigh - overlapLow) / steps;

    for (let i = 0; i <= steps; i++) {
        const p = overlapLow + i * step;
        const score = trapezoid(p, buyer) * trapezoid(p, seller);
        if (score > bestScore) {
            bestScore = score;
            bestPrice = p;
        }
    }
    return bestPrice;
}

function weightedByFlexibility(buyer, seller, overlapLow, overlapHigh) {
    const buyerWidth = buyer[3] - buyer[0];
    const sellerWidth = seller[3] - seller[0];
    const totalWidth = buyerWidth + sellerWidth;
    if (totalWidth === 0) return (overlapLow + overlapHigh) / 2;
    const sellerWeight = buyerWidth / totalWidth;
    return overlapLow + (overlapHigh - overlapLow) * sellerWeight;
}

const LAYER1_METHODS = [
    { name: "Arithmetic Midpoint", fn: (b, s, lo, hi) => arithmeticMidpoint(lo, hi) },
    { name: "Geometric Mean", fn: (b, s, lo, hi) => geometricMean(lo, hi) },
    { name: "Nash Bargaining", fn: nashBargaining },
    { name: "Kalai-Smorodinsky", fn: kalaiSmorodinsky },
    { name: "Joint Acceptability", fn: jointAcceptabilityPeak },
    { name: "Flexibility-Weighted", fn: weightedByFlexibility },
];

function consensusArithmeticMean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function consensusMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function consensusTrimmedMean(values) {
    if (values.length <= 2) return consensusArithmeticMean(values);
    const sorted = [...values].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function consensusKDE(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max - min < 0.01) return (min + max) / 2;

    const bandwidth = (max - min) / 3;
    const steps = 200;
    const step = (max - min) / steps;
    let bestX = min;
    let bestDensity = -1;

    for (let i = 0; i <= steps; i++) {
        const x = min + i * step;
        let density = 0;
        for (const v of values) {
            const u = (x - v) / bandwidth;
            density += Math.exp(-0.5 * u * u);
        }
        if (density > bestDensity) {
            bestDensity = density;
            bestX = x;
        }
    }
    return bestX;
}

function consensusGeometricMean(values) {
    const product = values.reduce((a, b) => a * b, 1);
    return Math.pow(product, 1 / values.length);
}

const LAYER2_METHODS = [
    { name: "Mean", fn: consensusArithmeticMean },
    { name: "Median", fn: consensusMedian },
    { name: "Trimmed Mean", fn: consensusTrimmedMean },
    { name: "KDE Mode", fn: consensusKDE },
    { name: "Geometric Mean", fn: consensusGeometricMean },
];

function runConvergence(buyer, seller, maxLayers = 8, convergenceThreshold = 0.01) {
    const dealLow = Math.max(buyer[0], seller[0]);
    const dealHigh = Math.min(buyer[3], seller[3]);

    const comfortLow = Math.max(buyer[1], seller[1]);
    const comfortHigh = Math.min(buyer[2], seller[2]);
    const hasComfortZone = comfortLow <= comfortHigh;

    const hasOverlap = dealLow <= dealHigh;

    let overlapLow, overlapHigh;
    if (hasComfortZone) {
        overlapLow = comfortLow;
        overlapHigh = comfortHigh;
    } else if (hasOverlap) {
        overlapLow = dealLow;
        overlapHigh = dealHigh;
    } else {
        overlapLow = buyer[3];
        overlapHigh = seller[0];
    }

    const gap = hasOverlap ? 0 : overlapHigh - overlapLow;

    const layers = [];

    const layer1 = LAYER1_METHODS.map((m) => ({
        name: m.name,
        value: m.fn(buyer, seller, overlapLow, overlapHigh),
    }));
    const layer1Values = layer1.map((r) => r.value);
    const layer1Spread = Math.max(...layer1Values) - Math.min(...layer1Values);
    layers.push({ methods: layer1, values: layer1Values, spread: layer1Spread });

    let prevValues = layer1Values;
    for (let i = 1; i < maxLayers; i++) {
        const layerResults = LAYER2_METHODS.map((m) => ({
            name: m.name,
            value: m.fn(prevValues),
        }));
        const values = layerResults.map((r) => r.value);
        const spread = Math.max(...values) - Math.min(...values);
        layers.push({ methods: layerResults, values, spread });

        if (spread < convergenceThreshold) break;
        prevValues = values;
    }

    const finalLayer = layers[layers.length - 1];
    const fairPrice = consensusMedian(finalLayer.values);

    return {
        overlap: hasOverlap,
        overlapLow,
        overlapHigh,
        dealLow,
        dealHigh,
        hasComfortZone,
        gap,
        layers,
        fairPrice,
        convergenceAchieved: finalLayer.spread < convergenceThreshold,
    };
}

// ── Harness (not prototype code) ─────────────────────────────────────

// R1 threshold rule (T2-engine §6 R1 as specified in T3): computed from the
// active zone bounds the prototype itself selects. To obtain those bounds we
// run once with the absolute threshold, read overlapLow/High, then re-run
// with the relative threshold.
function r1Threshold(zoneLow, zoneHigh) {
    const zoneWidth = Math.abs(zoneHigh - zoneLow);
    return Math.max(0.01, zoneWidth * 1e-4);
}

const FIXTURES = [
    { id: "comfort-zone",  buyer: [80, 95, 110, 125],    seller: [70, 90, 105, 120] },
    { id: "deal-only",     buyer: [50, 60, 70, 80],      seller: [75, 85, 95, 105] },
    { id: "no-deal",       buyer: [40, 50, 60, 70],      seller: [90, 100, 110, 120] },
    { id: "r1-divergence", buyer: [5000000, 6000000, 7000000, 8000000], seller: [7500000, 8500000, 9500000, 10500000] },
    { id: "decimal-precision", buyer: [80.1234, 95.5678, 110.9012, 125.3456], seller: [70.2345, 90.6789, 105.1111, 120.4444] },
];

const out = {
    anchors: {
        inflection: "reconciliation",
        algorithmVersion: "reconciliation/1",
        numericPolicyVersion: "np/1",
        honestySignalSetVersion: "honesty/1",
        engineVersion: "0.1.0",
        note: "These vectors anchor exactly these versions (T2-engine s2.4). A change to any anchored version requires a new fixture archive (v2), never an edit to this one.",
    },
    provenance: {
        source: "/Users/al/Studio/projects/vwpa/product/vwpa.jsx",
        source_lines: "5-225 (maths only, copied verbatim)",
        generated: "2026-08-20",
        generator: "T3-m1-engine-port revision r2 (fairprice repo), run under Node " + process.version,
        note: "absolute-0.01 records the prototype's native tolerance mode; relative-r1 records the same maths run with threshold = max(0.01, zoneWidth*1e-4). Distances are NOT prototype output; they are derived here by the interval-distance formula of T3-m1-engine-port: distance_p = max(0, tuple[0] - fairPrice, fairPrice - tuple[3]) per party.",
    },
    fixtures: [],
};

for (const f of FIXTURES) {
    const abs = runConvergence(f.buyer, f.seller, 8, 0.01);
    const thr = r1Threshold(abs.overlapLow, abs.overlapHigh);
    const rel = runConvergence(f.buyer, f.seller, 8, thr);
    const entry = {
        id: f.id,
        input: { lowPreferrer: f.buyer, highPreferrer: f.seller },
        modes: {
            "absolute-0.01": { threshold: 0.01, result: abs },
            "relative-r1": { threshold: thr, result: rel },
        },
    };
    if (!abs.overlap) {
        entry.derivedDistances = {
            note: "not prototype output; interval-distance formula per T3",
            lowPreferrer: Math.max(0, f.buyer[0] - abs.fairPrice, abs.fairPrice - f.buyer[3]),
            highPreferrer: Math.max(0, f.seller[0] - abs.fairPrice, abs.fairPrice - f.seller[3]),
        };
    }
    out.fixtures.push(entry);
}

// Sanity: r1-divergence must actually diverge between modes.
const div = out.fixtures.find((f) => f.id === "r1-divergence");
const layersAbs = div.modes["absolute-0.01"].result.layers.length;
const layersRel = div.modes["relative-r1"].result.layers.length;
console.error(`r1-divergence layers: abs=${layersAbs} rel=${layersRel} fairPrice abs=${div.modes["absolute-0.01"].result.fairPrice} rel=${div.modes["relative-r1"].result.fairPrice}`);
if (layersAbs === layersRel) {
    console.error("WARNING: divergence fixture does not diverge in layer count");
}

console.log(JSON.stringify(out, null, 2));
