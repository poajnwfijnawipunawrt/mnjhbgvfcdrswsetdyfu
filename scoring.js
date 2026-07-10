/**
 * Core scoring algorithm as specified in the PRD.
 * Scores workorders 0-100 (can go negative with penalties).
 */

// ─── Committee + Vendor classification ───────────────────────────────────────
//
// Two orthogonal concepts that share the workorder-prefix namespace:
//
//   COMMITTEE — the political body that owns the donation program.  These are
//   the highest-leverage donation sources and receive a scoring boost so their
//   creative competes harder.  A workorder belongs to AT MOST one committee.
//
//   VENDOR — the agency/firm that produced the creative (Frontline, Active
//   Engagement, etc.).  Diagnostic only — no scoring impact.  A vendor ships
//   creative for many committees, so a workorder with vendor "FL" might be
//   for any committee or no committee at all.
//
// Listed longest-first so the prefix matcher resolves the most specific code
// first (e.g. NRCC matches before NR; SLFA before SLF; RWMS before RWS).
const COMMITTEES = ['NRCC', 'NRSC', 'RNC'];

const VENDORS = {
  FL:   'Frontline',
  AE:   'Active Engagement',
  EP:   'EP',
  RS:   'RS',
  TV:   'TV',
  RWMS: 'RWMS',
  RWS:  'RWS',
  CM:   'CM',
  DJT:  'DJT',
  PC:   'PC',
  WM:   'WM',
  SLFA: 'SLFA',
  SLFO: 'SLFO',
  SLF:  'SLF',
  NL:   'NL',
  AG:   'AG',
  PR:   'PR',
  RC:   'RC',
};

const COMMITTEES_SORTED = [...COMMITTEES].sort((a, b) => b.length - a.length);
const VENDORS_SORTED    = Object.keys(VENDORS).sort((a, b) => b.length - a.length);

export function getCommittee(wo) {
  const u = String(wo || '').toUpperCase();
  for (const c of COMMITTEES_SORTED) if (u.startsWith(c)) return c;
  return null;
}

export function getVendor(wo) {
  const u = String(wo || '').toUpperCase();
  for (const v of VENDORS_SORTED) if (u.startsWith(v)) return { code: v, name: VENDORS[v] };
  return null;
}

export const COMMITTEE_LIST = COMMITTEES;
export const VENDOR_LIST    = Object.entries(VENDORS).map(([code, name]) => ({ code, name }));

export function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const str = String(val).replace(/[$,]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Scoring weights: Volume 55 · Efficiency 15 · Trend 30 = 100 max
// Volume is the strongest predictor of continued donation volume.
// Efficiency (avg gift size) is a tiebreaker, not a primary signal.

// A3 — Extended volume tiers above 30 donations so dominant workorders
// score higher than merely adequate ones (previously all 30+ = 55).
export function calculateVolumeScore(donations) {
  if (donations >= 60) return 59; // dominant
  if (donations >= 45) return 57; // strong
  if (donations >= 30) return 55;
  if (donations >= 20) return 48;
  if (donations >= 15) return 42;
  if (donations >= 10) return 35;
  if (donations >= 5)  return 20;
  if (donations >= 3)  return 13;
  if (donations >= 1)  return 6;
  return 0;
}

export function calculateEfficiencyScore(efficiency) {
  if (efficiency > 25) return 15;
  if (efficiency > 15) return 12;
  if (efficiency > 10) return 10;
  if (efficiency > 5)  return 7;
  if (efficiency > 2)  return 4;
  if (efficiency > 0)  return 2;
  return 0;
}

export function calculateTrendScore(trend) {
  if (trend > 15) return 30;
  if (trend > 10) return 25;
  if (trend > 5) return 20;
  if (trend > 0) return 15;
  if (trend === 0) return 5;
  if (trend > -5) return -10;
  if (trend > -10) return -20;
  return -30;
}

/**
 * Calculate score, optionally excluding down days from volume/trend/penalty.
 *
 * Down days (e.g. low volume due to staffing) are excluded so they don't
 * unfairly penalise workorders. The algorithm falls back to the best available
 * non-down day for volume/efficiency, and skips trend/penalties for down days.
 *
 * @param {object} workorderData  { day1, day2, day3 }
 * @param {{ day1Down, day2Down, day3Down }} downDays
 * @param {number} totalRaise     3-day total net raise (used for A2 confidence dampening)
 */
export function calculateScore(workorderData, downDays = {}, totalRaise = 0) {
  let score = 0;
  const breakdown = {};

  const d1Down = !!downDays.day1Down;
  const d2Down = !!downDays.day2Down;
  const d3Down = !!downDays.day3Down;

  // Pick the best non-down day for volume/efficiency (prefer day3, then day2, then day1).
  // If all days are down, fall back to day3 as-is (edge case).
  const refDay =
    !d3Down ? workorderData.day3 :
    !d2Down ? workorderData.day2 :
    !d1Down ? workorderData.day1 :
    workorderData.day3;

  // 1. Volume Score — based on reference day donations
  const refDonations = refDay?.donations ?? 0;
  const volumeScore = calculateVolumeScore(refDonations);
  score += volumeScore;
  breakdown.volumeScore = volumeScore;

  // 2. Efficiency Score — based on reference day
  // A2 — Confidence dampening now takes the MAX of count-based and raise-based
  // factors so a single large donation ($250+) isn't penalised for low volume.
  // Either strong count OR strong dollar amount unlocks full confidence.
  const refNetRaise = refDay?.netRaise ?? 0;
  const rawEfficiency = refDonations > 0 ? refNetRaise / refDonations : 0;
  const countFactor = Math.min(1.0, Math.sqrt(refDonations / 10));
  const raiseFactor = Math.min(1.0, totalRaise / 200); // reaches 1.0 at $200 total raise
  const confidenceFactor = Math.max(countFactor, raiseFactor);
  const efficiency = rawEfficiency * confidenceFactor;
  const efficiencyScore = calculateEfficiencyScore(efficiency);
  score += efficiencyScore;
  breakdown.efficiencyScore = efficiencyScore;
  breakdown.confidenceFactor = parseFloat(confidenceFactor.toFixed(2));

  // 3. Trend Score — compare oldest non-down day to newest non-down day.
  // A4 — Trend now blends efficiency change (60%) with raw donation count
  // growth (40%) so a workorder gaining donors is never punished just because
  // its per-donation efficiency dropped slightly.
  // If only one valid day exists, trend is neutral (0).
  const day1Donations = workorderData.day1?.donations ?? 0;
  const day1NetRaise  = workorderData.day1?.netRaise ?? 0;
  const day2Donations = workorderData.day2?.donations ?? 0;
  const day2NetRaise  = workorderData.day2?.netRaise ?? 0;
  const day3Donations = workorderData.day3?.donations ?? 0;
  const day3NetRaise  = workorderData.day3?.netRaise ?? 0;

  // Determine baseline (oldest non-down) and latest (newest non-down) for trend
  const baselineDay = !d1Down ? workorderData.day1 : !d2Down ? workorderData.day2 : null;
  const latestDay   = !d3Down ? workorderData.day3 : !d2Down ? workorderData.day2 : null;

  let trend = 0;
  if (baselineDay && latestDay && baselineDay !== latestDay) {
    const baseEff  = (baselineDay.donations ?? 0) > 0
      ? (baselineDay.netRaise ?? 0) / baselineDay.donations : 0;
    const latestEff = (latestDay.donations ?? 0) > 0
      ? (latestDay.netRaise ?? 0) / latestDay.donations : 0;
    const effTrend = latestEff - baseEff;

    // Donation count growth — capped at ±10 to stay in the same numeric range
    // as the efficiency trend signal (which is measured in $/donation)
    const baseDon  = baselineDay.donations ?? 0;
    const latDon   = latestDay.donations ?? 0;
    const donGrowth = Math.max(-10, Math.min(10, latDon - baseDon));

    trend = effTrend * 0.6 + donGrowth * 0.4;
  }
  const trendScore = calculateTrendScore(trend);
  score += trendScore;
  breakdown.trendScore = trendScore;
  breakdown.trend = trend;

  // 4. Penalties — skip entirely for down days
  // A1 — Day3 penalty is now proportional to the magnitude of the loss.
  // A tiny refund ($2) no longer triggers the same -40 as a genuine disaster.
  let penalties = 0;
  if (!d3Down && day3NetRaise < 0) {
    if (day3NetRaise < -100)     penalties -= 40; // large loss
    else if (day3NetRaise < -50) penalties -= 25; // moderate loss
    else if (day3NetRaise < -20) penalties -= 15; // small loss
    else                         penalties -=  5; // trivial (rounding / tiny refund)
  }

  const validNetRaises = [
    ...(!d1Down ? [day1NetRaise] : []),
    ...(!d2Down ? [day2NetRaise] : []),
    ...(!d3Down ? [day3NetRaise] : []),
  ];
  const avgNetRaise = validNetRaises.length > 0
    ? validNetRaises.reduce((a, b) => a + b, 0) / validNetRaises.length
    : 0;
  if (avgNetRaise < 0) penalties -= 20;

  // A6 — Consecutive decline penalty
  // If donations fell every single day (d1 > d2 > d3), the audience is
  // actively exhausting — faster than the endpoint trend alone captures.
  // Requires all three days to be valid (non-down) with real day1 volume.
  const consecutiveDecline =
    !d1Down && !d2Down && !d3Down &&
    day1Donations > 0 &&
    day1Donations > day2Donations &&
    day2Donations > day3Donations;
  if (consecutiveDecline) penalties -= 15;

  score += penalties;
  breakdown.penalties = penalties;
  breakdown.consecutiveDecline = consecutiveDecline;

  // 5. Plateau penalty — only applies when day3 is a valid (non-down) reference
  const day2Efficiency = day2Donations > 0 ? day2NetRaise / day2Donations : 0;
  const day1Efficiency = day1Donations > 0 ? day1NetRaise / day1Donations : 0;
  const midTrend = day2Efficiency - day1Efficiency;

  const isPlateaued =
    !d3Down &&
    day3Donations >= 10 &&
    trend >= -1 && trend <= 3 &&
    midTrend <= 5;

  const plateauPenalty = isPlateaued ? -10 : 0;
  score += plateauPenalty;
  breakdown.plateauPenalty = plateauPenalty;
  breakdown.isPlateaued = isPlateaued;

  return {
    score,
    efficiency,
    rawEfficiency,
    trend,
    breakdown,
  };
}

// Minimum day-3 donations required to qualify for Acoustic (TOP_TIER).
// Prevents a single-donation fluke from occupying a premium slot.
const ACOUSTIC_MIN_DONATIONS = 3;

// Minimum 30-day donations for a history-only importer to be floored into the
// daily schedule (SECOND_TIER / Iterable).  Set above the bare-meaningfulness
// floor (3) so we only widen variety with importers that have a real donation
// base — never 1–2 donation noise.  See the 30-day importer floor in Pass 2.
const IMPORT_FLOOR_MIN_DONATIONS = 5;

// ── 30-day weighting knobs ───────────────────────────────────────────────────
// Tune these to draw more (or fewer) of the whole month's top pieces onto sheets.
// PROVEN_PERFORMER: a workorder with this much 30-day evidence is floored to
// TOP_TIER (Acoustic) even on a weak recent window.  Lowered from 50/$1,000 so
// more of the month's proven winners surface.
const PROVEN_MIN_DONATIONS = 35;   // ≥35 donations over 30 days → proven
const PROVEN_MIN_NET        = 600; // …OR ≥$600 net raise over 30 days
// Score a proven performer is floored to, so its rank matches its TOP tier and
// it actually lands on Acoustic (which fills in score order).  Above the static
// TOP threshold (65); genuinely hot recent pieces (70–95) still outrank it.
const PROVEN_SCORE_FLOOR    = 72;
// The proven floor scales up with 30-day donation volume so the month's biggest
// pieces rank near the top (not tied in a pile). floor = 72 + min(20, don/7).
const PROVEN_FLOOR_VOLUME_DIV = 7;
const PROVEN_FLOOR_VOLUME_CAP = 20;
// Max points the Historical Strength Bonus can add (was 15).  Higher = the
// 30-day track record pulls harder on the score ranking.
const HISTORICAL_BONUS_CAP  = 22;

// ── Blockbuster tier ─────────────────────────────────────────────────────────
// The program's revenue historically came from a small "home-run" tail: in
// spring 8% of workorders raised $1,000+ and were 69% of all gross.  A
// blockbuster is a piece with heavy 30-day GROSS.  Blockbusters are force-kept
// at TOP_TIER, exempted from every demotion penalty, floored above the normal
// ranking, and later given uncapped, dollar-weighted send volume so the tail is
// rebuilt instead of flattened.
const BLOCKBUSTER_MIN_GROSS_30D = 1000; // ≥$1,000 30-day gross → blockbuster
const BLOCKBUSTER_SCORE_FLOOR   = 100;  // ranks above all normal pieces

// D3 — getTier now accepts dynamic thresholds derived from the session's score
// distribution (quartiles). Defaults preserve backward compatibility.
export function getTier(score, day3Donations = 0, topThreshold = 65, secondThreshold = 35) {
  if (score >= topThreshold && day3Donations >= ACOUSTIC_MIN_DONATIONS) return 'TOP_TIER';
  if (score >= secondThreshold) return 'SECOND_TIER';
  return 'CUT';
}

export function getESP(tier) {
  if (tier === 'TOP_TIER') return 'Acoustic';
  if (tier === 'SECOND_TIER') return 'Iterable';
  return null;
}

export function getStatus(trend) {
  if (trend > 5) return 'EXPAND';
  if (trend >= 0) return 'MAINTAIN';
  if (trend >= -5) return 'CONSOLIDATE';
  return 'REDUCE';
}

export function getCutReason(workorderData, score, efficiency, trend, downDays = {}, isCollapsing = false) {
  const reasons = [];
  const day3NetRaise = workorderData.day3?.netRaise ?? 0;
  const day1NetRaise = workorderData.day1?.netRaise ?? 0;
  const day2NetRaise = workorderData.day2?.netRaise ?? 0;

  const validNetRaises = [
    ...(!downDays.day1Down ? [day1NetRaise] : []),
    ...(!downDays.day2Down ? [day2NetRaise] : []),
    ...(!downDays.day3Down ? [day3NetRaise] : []),
  ];
  const avgNetRaise = validNetRaises.length > 0
    ? validNetRaises.reduce((a, b) => a + b, 0) / validNetRaises.length : 0;

  if (isCollapsing) reasons.push('Collapsing audience (day3 < 35% of day1 volume)');
  const d1Don = workorderData.day1?.donations ?? 0;
  const d2Don = workorderData.day2?.donations ?? 0;
  const d3Don = workorderData.day3?.donations ?? 0;
  if (!downDays.day1Down && !downDays.day2Down && !downDays.day3Down &&
      d1Don > 0 && d1Don > d2Don && d2Don > d3Don) {
    reasons.push('Consecutive donation decline (' + d1Don + '→' + d2Don + '→' + d3Don + ')');
  }
  if (!downDays.day3Down && day3NetRaise < 0) reasons.push('Negative net raise');
  if (avgNetRaise < 0) reasons.push('Negative average raise');
  if (trend < -10) reasons.push('Efficiency crashed ' + Math.round(trend) + '%');
  else if (trend < -5) reasons.push('Declining efficiency ' + Math.round(trend));
  if (efficiency <= 0) reasons.push('Zero or negative efficiency');

  const refDonations = !downDays.day3Down ? (workorderData.day3?.donations ?? 0)
    : !downDays.day2Down ? (workorderData.day2?.donations ?? 0)
    : (workorderData.day1?.donations ?? 0);
  if (refDonations === 0) reasons.push('No donations');
  if (score >= 65 && refDonations < ACOUSTIC_MIN_DONATIONS)
    reasons.push('Score qualifies for Acoustic but < ' + ACOUSTIC_MIN_DONATIONS + ' donations (low-volume)');
  if (reasons.length === 0) reasons.push('Score below threshold (' + score + ')');

  return reasons.join(', ');
}

/**
 * SLF workorders (SLFA, SLFO, etc.) operate on an external system where only
 * 1% of the actual raise is visible in the performance reports.
 * Multiply their raise figures by 100 to get the true picture.
 */
const SLF_MULTIPLIER = 100;
function isSLF(workorder) {
  return /^SLF/i.test(String(workorder));
}

/**
 * Merge 3 days of CSV data into unified workorder objects.
 * Workorders only in some days use available data; missing days default to 0.
 */
export function mergeWorkorderData(day1Data, day2Data, day3Data) {
  const workorderMap = new Map();

  const addDay = (dayData, dayKey) => {
    dayData.forEach(row => {
      const wo = String(row.Workorder || '').trim();
      if (!wo) return;
      if (!workorderMap.has(wo)) {
        workorderMap.set(wo, {
          workorder: wo,
          organization: String(row.Organization || '').trim(),
          isSLF: isSLF(wo),
          committee: getCommittee(wo),  // 'NRCC' | 'NRSC' | 'RNC' | null
          vendor:    getVendor(wo),     // { code, name } | null
          daysPresent: 0,
          day1: null,
          day2: null,
          day3: null,
        });
      }
      const entry = workorderMap.get(wo);
      if (!entry.organization && row.Organization) {
        entry.organization = String(row.Organization).trim();
      }
      entry.daysPresent += 1;
      const raiseMultiplier = isSLF(wo) ? SLF_MULTIPLIER : 1;
      entry[dayKey] = {
        donations: parseNumber(row.Donations),
        grossRaise: parseNumber(row['Gross Raise']) * raiseMultiplier,
        netRaise: parseNumber(row['Net Raise']) * raiseMultiplier,
      };
    });
  };

  addDay(day1Data, 'day1');
  addDay(day2Data, 'day2');
  addDay(day3Data, 'day3');

  // Record which days the workorder actually appeared in BEFORE backfilling.
  // An absent day (no row) is fundamentally different from a present day with
  // zero activity: absence means "not deployed", not "audience died", so the
  // scorer treats absent days as down-days (excluded) rather than real zeros.
  const emptyDay = { donations: 0, grossRaise: 0, netRaise: 0 };
  workorderMap.forEach(wo => {
    wo.day1Present = wo.day1 != null;
    wo.day2Present = wo.day2 != null;
    wo.day3Present = wo.day3 != null;
    if (!wo.day1) wo.day1 = { ...emptyDay };
    if (!wo.day2) wo.day2 = { ...emptyDay };
    if (!wo.day3) wo.day3 = { ...emptyDay };
  });

  return Array.from(workorderMap.values());
}

// sendCount below this threshold = "under-sent" (high-efficiency but low-exposure)
const UNDER_SENT_THRESHOLD = 20;

/**
 * Run the full analysis pipeline on merged workorder data.
 *
 * D3 — Two-pass approach: Pass 1 computes raw scores for all workorders,
 * then derives TOP/SECOND tier thresholds from the Q3 and Q2 quartiles of
 * that score distribution. Pass 2 assigns final tiers using those dynamic
 * thresholds (clamped so they never exceed the historic static values of
 * 65 / 35, and never drop below sensible minimums of 20 / 10).
 * This ensures the top quarter of any session's content always reaches
 * Acoustic even on days when the overall pool quality is lower than usual.
 *
 * @param {object[]} mergedData      Output of mergeWorkorderData()
 * @param {object}   downDays        { day1Down, day2Down, day3Down }
 * @param {Map}      deployHistory   workorder → sendCount from prior deployment sheets (optional)
 * @param {object[]} history30Rows   Optional: 30-day aggregate CSV rows (same columns as daily CSVs).
 *                                   Workorders only here (not in 3-day window) are synthesised as
 *                                   daily-average entries capped at SECOND_TIER.  Workorders in both
 *                                   windows receive a historical strength bonus (up to +15 pts).
 */
export function analyzeWorkorders(mergedData, downDays = {}, deployHistory = new Map(), history30Rows = []) {
  // ── Build 30-day history lookup ───────────────────────────────────────────────
  const history30Map = new Map();
  for (const row of (history30Rows || [])) {
    const wo = String(row.Workorder || '').trim().toUpperCase();
    if (!wo) continue;
    const donations  = parseNumber(row.Donations);
    const grossRaise = parseNumber(row['Gross Raise']);
    const netRaise   = parseNumber(row['Net Raise']);
    if (donations <= 0 && netRaise <= 0) continue;
    history30Map.set(wo, {
      workorder: wo,
      organization: String(row.Organization || '').trim(),
      donations,
      grossRaise,
      netRaise,
    });
  }

  // ── Pre-filter: remove residual/recurring-donation workorders ────────────────
  // When gross raise === net raise the platform deducted zero processing cost,
  // which is the signature of residual recurring donations being attributed to
  // a workorder rather than genuine new fundraising activity.  These workorders
  // are excluded from scoring entirely — they should never enter the schedule.
  const filteredData = mergedData.filter(wo => {
    const totalGross = (wo.day1?.grossRaise ?? 0) + (wo.day2?.grossRaise ?? 0) + (wo.day3?.grossRaise ?? 0);
    const totalNet   = (wo.day1?.netRaise   ?? 0) + (wo.day2?.netRaise   ?? 0) + (wo.day3?.netRaise   ?? 0);
    // Only flag when both are non-zero and equal (no cost deducted = suspicious)
    if (totalGross > 0 && totalNet > 0 && Math.abs(totalGross - totalNet) < 0.01) return false;
    return true;
  });

  // ── Synthesise history-only entries ──────────────────────────────────────────
  // Workorders that appear in the 30-day summary but NOT in any of the 3 recent
  // day CSVs are added as synthetic entries using their 30-day daily averages for
  // all three day slots (flat — trend = 0).  They are marked fromHistory30 = true
  // so Pass 2 can cap them at SECOND_TIER (they haven't been active recently).
  const mergedWOSet = new Set(filteredData.map(w => w.workorder));
  const history30OnlyEntries = [];
  for (const [wo, h30] of history30Map) {
    if (mergedWOSet.has(wo)) continue;
    if (h30.donations < 3) continue; // fewer than 3 donations over 30 days — not meaningful
    const dailyDon   = h30.donations  / 30;
    const dailyNet   = h30.netRaise   / 30;
    const dailyGross = h30.grossRaise / 30;
    const synthDay   = {
      donations:  Math.max(1, Math.round(dailyDon)),
      netRaise:   dailyNet,
      grossRaise: dailyGross,
    };
    history30OnlyEntries.push({
      workorder:    wo,
      organization: h30.organization,
      isSLF:        isSLF(wo),
      committee:    getCommittee(wo),
      vendor:       getVendor(wo),
      daysPresent:  3,           // 30-day history is well-established; no tier cap
      day1: { ...synthDay },
      day2: { ...synthDay },
      day3: { ...synthDay },
      day1Present: true, day2Present: true, day3Present: true,
      fromHistory30: true,
    });
  }

  const allData = [...filteredData, ...history30OnlyEntries];

  // ── Pass 1: compute raw scores for every workorder ──────────────────────────
  const pass1 = allData.map(wo => {
    const totalRaise = (wo.day1?.netRaise ?? 0) + (wo.day2?.netRaise ?? 0) + (wo.day3?.netRaise ?? 0);
    const totalDonations = (wo.day1?.donations ?? 0) + (wo.day2?.donations ?? 0) + (wo.day3?.donations ?? 0);

    // A day the workorder didn't appear in counts as a down-day for THIS
    // workorder (excluded from volume/trend/penalties) on top of any
    // session-wide down-days.  Absence never scores against a workorder.
    const woDownDays = {
      day1Down: !!downDays.day1Down || wo.day1Present === false,
      day2Down: !!downDays.day2Down || wo.day2Present === false,
      day3Down: !!downDays.day3Down || wo.day3Present === false,
    };

    const { score, efficiency, rawEfficiency, trend, breakdown } =
      calculateScore(wo, woDownDays, totalRaise);

    const refDonations = !woDownDays.day3Down ? (wo.day3?.donations ?? 0)
      : !woDownDays.day2Down ? (wo.day2?.donations ?? 0)
      : (wo.day1?.donations ?? 0);

    const sendCount = deployHistory.get(wo.workorder) || 0;

    // ── New Content Bonus ───────────────────────────────────────────────────
    // Workorders that appear in only ONE of the three day CSVs are brand-new.
    // A strong debut (net positive + multiple donations) earns a score boost so
    // promising new content isn't cut on its very first showing.
    // Bonus tiers: 2–4 donations → +15 · 5–9 donations → +20 · 10+ → +25
    const newContentBonus = (() => {
      if ((wo.daysPresent ?? 3) !== 1) return 0;
      if (totalRaise <= 0)             return 0;
      if (totalDonations < 2)          return 0;
      if (totalDonations >= 10) return 25;
      if (totalDonations >= 5)  return 20;
      return 15;
    })();

    // ── Intermittent Test Bonus ─────────────────────────────────────────────
    // Workorders present on 2 of 3 days are being tested/rotated. If they
    // perform well on the days they appear (≥1 donation, net positive) bump
    // them toward expansion. Smaller than new-content bonus (some history exists).
    // Bonus tiers: 1–4 donations → +8 · 5–9 donations → +12 · 10+ → +15
    const intermittentBonus = (() => {
      if ((wo.daysPresent ?? 3) !== 2) return 0;
      if (totalRaise <= 0)             return 0;
      if (totalDonations < 1)          return 0;
      if (totalDonations >= 10) return 15;
      if (totalDonations >= 5)  return 12;
      return 8;
    })();

    // ── Donation Collapse Detection ─────────────────────────────────────────
    // If a workorder had real volume on day1 but day3 donations are < 35% of
    // that, the audience is collapsing. Flagged here; tier override applied in
    // Pass 2 so it cannot hold a TOP_TIER (Acoustic) slot.
    const _d1Don = wo.day1?.donations ?? 0;
    const _d3Don = wo.day3?.donations ?? 0;
    const isCollapsing =
      !woDownDays.day1Down && !woDownDays.day3Down &&
      _d1Don >= 10 &&
      _d3Don < _d1Don * 0.35;

    // ── Breakout Bonus ───────────────────────────────────────────────────────
    // When day3 donations are 5x+ day2 donations (with meaningful day3 volume
    // and a valid day2 baseline), the workorder is accelerating sharply.
    // This stacks with the intermittent bonus so emerging content gets enough
    // priority to reach Acoustic before the window closes.
    const _d2Don = wo.day2?.donations ?? 0;
    const breakoutBonus = (() => {
      if (woDownDays.day3Down || woDownDays.day2Down) return 0;
      if (_d3Don < 5)        return 0; // need real day3 volume
      if (_d2Don === 0)      return 0; // need a baseline to compare
      if (_d3Don < _d2Don * 5) return 0; // must be 5× growth
      return 20;
    })();

    // ── A5 — Plateau refund based on send history ───────────────────────────
    // calculateScore() always applies the -10 plateau penalty when isPlateaued.
    // But a steady workorder with few sends isn't fatigued — it's just consistent.
    // Refund part of that penalty unless send history confirms heavy deployment.
    let plateauRefund = 0;
    if (breakdown.isPlateaued) {
      if (sendCount === 0)       plateauRefund = +7; // no history → don't punish steady WOs
      else if (sendCount < 50)   plateauRefund = +5; // light sends → only mild plateau signal
      // sendCount ≥ 50 → keep full -10 (genuine audience fatigue)
    }

    // ── Historical Strength Bonus ───────────────────────────────────────────────
    // Reward sustained 30-day performance so the month's top pieces rank higher
    // and actually get drawn onto sheets — including history-only pieces that
    // weren't active in the recent 3-day window (their synthetic base score is
    // built from diluted daily averages and badly under-rates a monthly winner).
    // Volume is driven by WHOLE-MONTH donation count, up to +HISTORICAL_BONUS_CAP.
    //   Volume component (0–20): total donations over 30 days
    //   Efficiency component (0–8): net-per-donation over 30 days
    const h30 = history30Map.get(wo.workorder);
    let historicalBonus = 0;
    if (h30) {
      const monthlyDon = h30.donations;
      const histEff30  = monthlyDon > 0 ? h30.netRaise / monthlyDon : 0;
      const volBonus =
        monthlyDon >= 150 ? 20 :
        monthlyDon >= 80  ? 16 :
        monthlyDon >= 40  ? 12 :
        monthlyDon >= 20  ? 8  :
        monthlyDon >= 10  ? 5  :
        monthlyDon >= 5   ? 2  : 0;
      const effBonus   = histEff30 >= 25 ? 8 : histEff30 >= 15 ? 6 : histEff30 >= 8 ? 4 : histEff30 >= 4 ? 2 : 0;
      historicalBonus  = Math.min(HISTORICAL_BONUS_CAP, volBonus + effBonus);
    }

    // ── Committee Boost ──────────────────────────────────────────────────────
    // NRCC, NRSC, and RNC are the highest-leverage donation programs.  Per the
    // Path-to-1k findings, NRCC + NRSC alone account for 94% of the channel
    // shortfall vs July.  Give committee creative a thumb on the scale so it
    // competes harder against vendor-only creative — but the strongest creative
    // overall still wins.  +8 ≈ one tier-width; +5 ≈ half-tier nudge.
    let committeeBoost = 0;
    if (wo.committee === 'NRCC' || wo.committee === 'NRSC') committeeBoost = 8;
    else if (wo.committee === 'RNC')                        committeeBoost = 5;

    let rawFinalScore = score + newContentBonus + intermittentBonus + plateauRefund + breakoutBonus + historicalBonus + committeeBoost;

    // ── Proven-performer score floor ────────────────────────────────────────────
    // A workorder with strong 30-day evidence (and net-positive over the month)
    // is Acoustic-worthy.  Pass 2 already forces its TIER to TOP, but sheets are
    // filled in SCORE-rank order — so a proven piece with a low raw score (e.g. a
    // history-only winner scored off diluted daily averages) sorts to the bottom
    // and never gets an Acoustic slot.  Floor its score into the top band so its
    // ranking matches its tier and it actually places.
    // The floor SCALES with whole-month donation volume so the month's biggest
    // pieces rank at the top of the proven group (and reliably reach Acoustic),
    // instead of all proven pieces tying at one score and the back half never
    // getting placed.  base 72 → up to 72 + PROVEN_FLOOR_VOLUME_CAP.
    const provenH30 = history30Map.get(wo.workorder);
    const isProvenForFloor = !!provenH30 && provenH30.netRaise > 0 &&
      (provenH30.donations >= PROVEN_MIN_DONATIONS || provenH30.netRaise >= PROVEN_MIN_NET);
    if (isProvenForFloor) {
      const volFloor = Math.min(PROVEN_FLOOR_VOLUME_CAP, Math.round(provenH30.donations / PROVEN_FLOOR_VOLUME_DIV));
      rawFinalScore = Math.max(rawFinalScore, PROVEN_SCORE_FLOOR + volFloor);
    }

    // ── Blockbuster detection + protection ──────────────────────────────────────
    // The home-run tail is where the money lives.  A blockbuster is judged on
    // DOLLARS (gross), not the compressed composite score: monthly gross if we
    // have 30-day history, otherwise the 3-day window extrapolated to a month.
    const totalGross = (wo.day1?.grossRaise ?? 0) + (wo.day2?.grossRaise ?? 0) + (wo.day3?.grossRaise ?? 0);
    const h30gross = provenH30?.grossRaise ?? 0;
    const expectedGross = Math.max(h30gross, totalGross * 10);
    const isBlockbuster = expectedGross >= BLOCKBUSTER_MIN_GROSS_30D;
    // Force blockbusters to the very top of the ranking so the compressed 0-100
    // score can't bury a $9k piece next to a $500 one, and so no demotion penalty
    // baked into the raw score can knock it down.
    if (isBlockbuster) rawFinalScore = Math.max(rawFinalScore, BLOCKBUSTER_SCORE_FLOOR);

    return {
      _wo: wo,
      woDownDays,
      rawFinalScore,
      refDonations,
      sendCount,
      totalRaise,
      totalGross,
      totalDonations,
      hist30Gross:     h30gross,
      hist30Net:       provenH30?.netRaise ?? 0,
      hist30Donations: provenH30?.donations ?? 0,
      expectedGross,
      isBlockbuster,
      efficiency,
      rawEfficiency,
      confidenceFactor: breakdown.confidenceFactor ?? 1,
      trend,
      breakdown,
      newContentBonus,
      intermittentBonus,
      plateauRefund,
      breakoutBonus,
      historicalBonus,
      committeeBoost,
      isCollapsing,
    };
  });

  // ── D3: Derive dynamic tier thresholds from score quartiles ─────────────────
  // Q3 (75th percentile) → TOP_TIER floor  — clamped [20, 65]
  // Q2 (50th percentile) → SECOND_TIER floor — clamped [10, 35]
  // On strong days, Q3 ≥ 65 → threshold unchanged (same as historic static).
  // On weak days, Q3 < 65 → threshold drops, ensuring top quarter reaches Acoustic.
  const sortedScores = [...pass1].map(p => p.rawFinalScore).sort((a, b) => a - b);
  const n = sortedScores.length;
  const q3Raw = n > 0 ? (sortedScores[Math.floor(n * 0.75)] ?? 65) : 65;
  const q2Raw = n > 0 ? (sortedScores[Math.floor(n * 0.50)] ?? 35) : 35;
  const topThreshold    = Math.min(65, Math.max(20, q3Raw));
  const secondThreshold = Math.min(35, Math.max(10, q2Raw));

  // ── Pass 2: assign tiers using dynamic thresholds ───────────────────────────
  return pass1.map(p => {
    const wo            = p._wo;
    const dd            = p.woDownDays;
    const finalScore    = p.rawFinalScore;
    const refDay        = !dd.day3Down ? wo.day3
      : !dd.day2Down ? wo.day2
      : wo.day1;
    const latestDonations = refDay.donations;
    const latestRaise     = refDay.netRaise;
    const status          = getStatus(p.trend);

    let finalTier = getTier(finalScore, p.refDonations, topThreshold, secondThreshold);
    // Single-day cap: a workorder that only appears in ONE of the three day CSVs
    // has no trend data and cannot be verified as a real deployment — it may be
    // a residual recurring donation or a data artefact.  Cap at SECOND_TIER so it
    // lands on Iterable and proves itself before earning an Acoustic slot.
    if ((wo.daysPresent ?? 3) <= 1 && finalTier === 'TOP_TIER') finalTier = 'SECOND_TIER';
    // Collapse override: a workorder that lost 65%+ of its day1 donations by day3
    // cannot hold an Acoustic slot regardless of score.
    if (p.isCollapsing && finalTier === 'TOP_TIER') finalTier = 'SECOND_TIER';

    // Blockbuster exemption: the heavy-gross revenue tail is never demoted — no
    // single-day cap, no collapse, no threshold can knock it off Acoustic.
    if (p.isBlockbuster) finalTier = 'TOP_TIER';

    // ── PROVEN_PERFORMER override ───────────────────────────────────────────
    // Historical evidence over 30 days shows this workorder converts.  When a
    // proven workorder has a bad 3-day window (likely the funnel/suppression
    // collapse described in the Path-to-1k findings, NOT an audience problem),
    // keep deploying it so we maintain test coverage while the team investigates
    // creative + suppression.  Threshold ≥50 donations OR ≥$1,000 net raise over
    // 30 days = the cohort July's bottom-quartile NRCC pieces hit.  This fires
    // on workorder-level evidence — it does NOT force in weak creative, only
    // re-floors creative that has historically worked.
    // Single-day cap and collapse override still take precedence (we don't
    // resurrect literally-collapsing creative — let it cycle naturally).
    const h30Hist        = history30Map.get(wo.workorder);
    const isProvenPerformer = !!h30Hist && (h30Hist.donations >= PROVEN_MIN_DONATIONS || h30Hist.netRaise >= PROVEN_MIN_NET);
    if (isProvenPerformer
        && finalTier !== 'TOP_TIER'
        && !p.isCollapsing
        && (wo.daysPresent ?? 3) > 1) {
      finalTier = 'TOP_TIER';
    }

    // ── 30-day importer variety floor ───────────────────────────────────────
    // We were averaging ~121 unique deployable workorders/day; target ≈150 for
    // more creative variety across all three ESPs.  Grow that count by dipping
    // deeper into the 30-day top-performers import: any history-only importer
    // that is net-POSITIVE over 30 days (with a real donation base) is floored
    // to SECOND_TIER so it reaches Iterable instead of being cut.
    //
    // Hard rule — we only ever floor WINNERS.  Money-losing importers
    // (netRaise ≤ 0) are never floored; the count is never padded with
    // negative workorders.
    if (wo.fromHistory30 && finalTier === 'CUT') {
      const h30Floor = history30Map.get(wo.workorder);
      if (h30Floor && h30Floor.netRaise > 0 && h30Floor.donations >= IMPORT_FLOOR_MIN_DONATIONS) {
        finalTier = 'SECOND_TIER';
      }
    }

    const finalEsp  = getESP(finalTier);
    const cutReason = finalTier === 'CUT'
      ? getCutReason(wo, finalScore, p.efficiency, p.trend, dd, p.isCollapsing) : '';

    const raisePerSend  = p.sendCount > 0 ? p.totalRaise / p.sendCount : null;
    const isUnderSent   = p.sendCount > 0 && p.sendCount < UNDER_SENT_THRESHOLD;

    return {
      ...wo,
      score: finalScore,
      tier: finalTier,
      esp: finalEsp,
      newContentBonus:   p.newContentBonus,
      intermittentBonus: p.intermittentBonus,
      plateauRefund:     p.plateauRefund,
      breakoutBonus:     p.breakoutBonus,
      historicalBonus:   p.historicalBonus,
      committeeBoost:    p.committeeBoost,
      committee:         wo.committee ?? null,
      vendor:            wo.vendor ?? null,
      isProvenPerformer,
      isBlockbuster:     p.isBlockbuster,
      expectedGross:     parseFloat((p.expectedGross || 0).toFixed(2)),
      totalGross:        parseFloat((p.totalGross || 0).toFixed(2)),
      hist30Gross:       parseFloat((p.hist30Gross || 0).toFixed(2)),
      hist30Net:         parseFloat((p.hist30Net || 0).toFixed(2)),
      hist30Donations:   p.hist30Donations || 0,
      fromHistory30:     wo.fromHistory30 ?? false,
      isCollapsing:      p.isCollapsing,
      efficiency:           parseFloat(p.rawEfficiency.toFixed(2)),
      adjustedEfficiency:   parseFloat(p.efficiency.toFixed(2)),
      confidenceFactor:     parseFloat(p.confidenceFactor.toFixed(2)),
      isPlateaued:          p.breakdown.isPlateaued ?? false,
      trend:                parseFloat(p.trend.toFixed(2)),
      status,
      latestDonations,
      latestRaise:          parseFloat(latestRaise.toFixed(2)),
      totalDonations:       p.totalDonations,
      totalRaise:           parseFloat(p.totalRaise.toFixed(2)),
      cutReason,
      sendCount:            p.sendCount,
      raisePerSend:         raisePerSend !== null ? parseFloat(raisePerSend.toFixed(2)) : null,
      isUnderSent,
      // Expose dynamic thresholds so Dashboard can display them
      _topThreshold:    topThreshold,
      _secondThreshold: secondThreshold,
    };
  }).sort((a, b) => b.score - a.score);
}
