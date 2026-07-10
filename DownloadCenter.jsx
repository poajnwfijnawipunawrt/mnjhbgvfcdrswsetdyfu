import React, { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { fillAcousticTemplate, fillIterableTemplate, fillVerveTemplate, fillNewWOsIntoVerveRows, fillNewWOsIntoIterableRows, rebalanceSheet, parsePriorIterableSheet, parsePriorVerveSheet } from './templateFiller';
import { downloadCSV } from './csvGenerator';
import AcousticTemplateViewer from './AcousticTemplateViewer';

// ─── Shared viewer wrapper (re-used by both ESP cards) ───────────────────────

function GridViewerButton({ label, color, filled, filename, onOpen }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onOpen}
        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all ${color}`}
      >
        {label}
      </button>
      <button
        onClick={() => downloadCSV(filename, filled.csvString)}
        className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all"
      >
        Save CSV
      </button>
    </div>
  );
}

// ─── Acoustic card ────────────────────────────────────────────────────────────

function AcousticTransferCard({ filled, regularWorkorders, uniqueCount }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `acoustic_filled_${date}.csv`;

  // Only show the workorders that are actually placed on the sheet
  const activeWOs = regularWorkorders.slice(0, uniqueCount);
  const previewWOs = activeWOs.slice(0, 8);
  const moreCount = activeWOs.length - previewWOs.length;

  return (
    <>
      <div className="rounded-2xl border-2 border-green-200 overflow-hidden">
        <div className="px-5 py-4 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-green-800">Acoustic</h3>
              <p className="text-sm mt-0.5 text-green-600">
                {filled.headerIndices.length} lists · {uniqueCount} workorder{uniqueCount !== 1 ? 's' : ''} sent on every list
              </p>
            </div>
            <div className="text-3xl font-black text-green-200">{uniqueCount}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {previewWOs.map(wo => (
              <span key={wo} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-mono text-[10px] font-semibold">{wo}</span>
            ))}
            {moreCount > 0 && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-500 rounded text-[10px]">+{moreCount} more</span>
            )}
          </div>
        </div>
        <div className="px-5 py-4 bg-white space-y-3">
          <GridViewerButton
            label="Open & Copy Grid"
            color="bg-green-600 hover:bg-green-700"
            filled={filled}
            filename={filename}
            onOpen={() => setViewerOpen(true)}
          />
          <div className="text-xs text-gray-400 space-y-0.5 pt-1 border-t border-gray-50">
            <p><span className="text-gray-600 font-medium">FPDS_SEND</span> → Top {uniqueCount} workorders, each sent once per list (no repeats on the same list)</p>
            <p><span className="text-gray-600 font-medium">Recent_Active</span> → Filled only after FPDS slots are satisfied</p>
          </div>
        </div>
      </div>

      {viewerOpen && (
        <AcousticTemplateViewer
          title="Acoustic"
          rows={filled.rows}
          headerIndices={filled.headerIndices}
          filename={filename}
          csvString={filled.csvString}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

// ─── Iterable card ────────────────────────────────────────────────────────────

function IterableTransferCard({ filled, regularWorkorders }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `iterable_filled_${date}.csv`;

  const previewWOs = regularWorkorders.slice(0, 6);
  const moreCount = regularWorkorders.length - previewWOs.length;

  return (
    <>
      <div className="rounded-2xl border-2 border-amber-200 overflow-hidden">
        <div className="px-5 py-4 bg-amber-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-amber-800">Iterable</h3>
              <p className="text-sm mt-0.5 text-amber-600">
                {filled.headerIndices.length} lists · top WOs shared with Acoustic
              </p>
            </div>
            <div className="text-3xl font-black text-amber-200">{regularWorkorders.length}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {previewWOs.map(wo => (
              <span key={wo} className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-mono text-[10px] font-semibold">{wo}</span>
            ))}
            {moreCount > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-500 rounded text-[10px]">+{moreCount} more</span>
            )}
          </div>
        </div>
        <div className="px-5 py-4 bg-white space-y-3">
          <GridViewerButton
            label="Open & Copy Grid"
            color="bg-amber-500 hover:bg-amber-600"
            filled={filled}
            filename={filename}
            onOpen={() => setViewerOpen(true)}
          />
          <div className="text-xs text-gray-400 space-y-0.5 pt-1 border-t border-gray-50">
            <p><span className="text-gray-600 font-medium">Top WOs shared across ESPs</span> — same highest-ranked picks as Acoustic reach Iterable audiences too</p>
            <p><span className="text-gray-600 font-medium">GANGBUSTERS → RISING</span> slots filled by score · NL slots untouched · SOFT ASK rows blank</p>
            <p><span className="text-gray-600 font-medium">Gap-fill backup</span> — eligible CUT workorders (≥1 donation, net positive) included to maximise slot coverage</p>
          </div>
        </div>
      </div>

      {viewerOpen && (
        <AcousticTemplateViewer
          title="Iterable"
          rows={filled.rows}
          headerIndices={filled.headerIndices}
          filename={filename}
          csvString={filled.csvString}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

// ─── Verve card ───────────────────────────────────────────────────────────────

function VerveTransferCard({ filled, regularWorkorders }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `verve_filled_${date}.csv`;

  const previewWOs = regularWorkorders.slice(0, 6);
  const moreCount = regularWorkorders.length - previewWOs.length;

  return (
    <>
      <div className="rounded-2xl border-2 border-purple-200 overflow-hidden">
        <div className="px-5 py-4 bg-purple-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-purple-800">Verve</h3>
              <p className="text-sm mt-0.5 text-purple-600">
                {filled.headerIndices.length} lists · top WOs shared with Acoustic + Iterable
              </p>
            </div>
            <div className="text-3xl font-black text-purple-200">{regularWorkorders.length}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {previewWOs.map(wo => (
              <span key={wo} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-mono text-[10px] font-semibold">{wo}</span>
            ))}
            {moreCount > 0 && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-500 rounded text-[10px]">+{moreCount} more</span>
            )}
            {regularWorkorders.length === 0 && (
              <span className="text-[11px] text-purple-400 italic">No deployable workorders available</span>
            )}
          </div>
        </div>
        <div className="px-5 py-4 bg-white space-y-3">
          <GridViewerButton
            label="Open & Copy Grid"
            color="bg-purple-600 hover:bg-purple-700"
            filled={filled}
            filename={filename}
            onOpen={() => setViewerOpen(true)}
          />
          <div className="text-xs text-gray-400 space-y-0.5 pt-1 border-t border-gray-50">
            <p><span className="text-gray-600 font-medium">Top WOs shared across all ESPs</span> — strongest creative reaches every audience on the same day</p>
            <p><span className="text-gray-600 font-medium">TOP PREFORMERS → GANGBUSTERS</span> slots filled · NEW / RECENT ACTIVE left blank</p>
            <p><span className="text-gray-600 font-medium">1-hour gap</span> between sends of the same workorder across all lists</p>
          </div>
        </div>
      </div>

      {viewerOpen && (
        <AcousticTemplateViewer
          title="Verve"
          rows={filled.rows}
          headerIndices={filled.headerIndices}
          filename={filename}
          csvString={filled.csvString}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

// ─── Coming-soon placeholder card ────────────────────────────────────────────

function ComingSoonCard({ espName }) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 overflow-hidden">
      <div className="px-5 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-gray-600">{espName}</h3>
            <p className="text-sm mt-0.5 text-gray-400">Template transfer coming soon</p>
          </div>
          <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-400">Soon</span>
        </div>
      </div>
      <div className="px-5 py-4 bg-white">
        <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-100 rounded-xl p-6">
          <span className="text-2xl opacity-30">🔒</span>
          <p className="text-xs text-gray-400 text-center">
            {espName} template transfer will be enabled in a future update
          </p>
        </div>
      </div>
    </div>
  );
}

// NOTE: Individual workorder bans are now managed dynamically via the "Block WO" button
// in the header and stored in localStorage. They are passed as the `blockedWOs` prop.
// Hardcoded prefix bans (applied to every pool, cannot be overridden): AG, PR, RC

// ─── Fresh Content Mix slider ─────────────────────────────────────────────────

function FreshMixSlider({ freshPct, onChange, dayMode }) {
  const effectivePct = dayMode === 2 ? Math.min(freshPct * 2, 0.5) : freshPct;
  const displayPct = Math.round(effectivePct * 100);

  return (
    <div className="flex items-center gap-3 bg-indigo-50 rounded-lg px-3 py-2">
      <span className="text-xs text-indigo-700 font-medium whitespace-nowrap">Fresh mix:</span>
      <input
        type="range"
        min={0}
        max={0.5}
        step={0.05}
        value={freshPct}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-indigo-600 h-1.5 cursor-pointer"
      />
      <span className="text-xs font-mono font-bold text-indigo-700 w-9 text-right tabular-nums">
        {displayPct}%
      </span>
      <span className="text-xs text-indigo-400 whitespace-nowrap">
        of tomorrow's slots → emerging/lower-ranked pieces
        {dayMode === 2 && freshPct > 0 && (
          <span className="ml-1 text-indigo-500">(slider at {Math.round(freshPct * 100)}% → doubled for 2-Day)</span>
        )}
      </span>
    </div>
  );
}

// After coverage (every deployable piece once), leftover slots go to pieces in
// proportion to expected gross. Ordinary pieces cap at REPEAT_MAX; blockbusters
// (the heavy-gross tail) cap at BLOCKBUSTER_MAX so they can run big.
const REPEAT_MAX = 5;
const BLOCKBUSTER_MAX = 20;

// ─── Tomorrow pool builder ────────────────────────────────────────────────────
//
// Tomorrow keeps the SAME best→worst waterfall as today, but ~freshPct of the
// top performers are "rested" (rotated to the back) so the next-best creative
// rises into their slots.  Net effect: ~freshPct of tomorrow's workorders are
// different from today — but they're the *next tier of good content*, not the
// bottom of the barrel — while the other ~(1-freshPct) is the same top content
// placed in different slots/lists.
//
// Mechanism: walk the ranked pool and rest every Nth workorder (N = 1/freshPct,
// e.g. 0.25 → every 4th).  Rested WOs go to the back; the kept WOs stay in score
// order, so the fill still flows strongest→weakest with the gaps closed up by
// the next-best pieces.  (If deployHistory is uploaded, under-sent winners are
// preferred as the ones to promote.)
//
function buildTomorrowPool(regularWOs, allWorkorders, freshPct, dayMode, { collapsingWOs = new Set() } = {}) {
  if (dayMode === 0 || regularWOs.length === 0) return regularWOs;

  let pool = regularWOs;

  if (freshPct > 0) {
    // 2-Day mode rotates a bit harder (and a different set) so it doesn't mirror
    // Tomorrow mode.
    const effectivePct = dayMode === 2 ? Math.min(freshPct * 1.5, 0.5) : freshPct;
    const N = Math.max(2, Math.round(1 / effectivePct)); // 0.25 → 4, 0.10 → 10
    const restSlot = dayMode === 2 ? Math.floor(N / 2) : N - 1; // which position in each window to rest

    const kept = [];
    const rested = [];
    pool.forEach((wo, i) => {
      if (i % N === restSlot) rested.push(wo); // rest ~1/N of the ranking
      else kept.push(wo);
    });
    // kept is still strongest→weakest; rested top pieces sit out tomorrow's prime
    // slots (they ran today) and only backfill if every kept WO is exhausted.
    pool = [...kept, ...rested];
  }

  // Push collapsing WOs to the back — they shouldn't be prioritised tomorrow.
  if (collapsingWOs.size > 0) {
    const front = pool.filter(wo => !collapsingWOs.has(wo));
    const coll  = pool.filter(wo =>  collapsingWOs.has(wo));
    if (coll.length > 0) pool = [...front, ...coll];
  }

  return pool;
}

// ─── Main TransferCenter ──────────────────────────────────────────────────────

export default function DownloadCenter({ results, onReset, blockedWOs = new Set(), newWorkorders = [] }) {
  const { acoustic, iterable, cut, allWorkorders } = results;
  // 0 = off, 1 = Tomorrow Mode, 2 = 2-Day Mode
  const [dayMode, setDayMode] = useState(0);
  // Fresh content mix: % of tomorrow slots filled from emerging/lower-ranked WOs
  const [freshPct, setFreshPct] = useState(0.25);

  // ── Prior-sheet rotation: load yesterday's generated sheets from localStorage ─
  // Parsed once on mount ([] deps) so the same prior-day data is used for the
  // entire session; the new sheets are saved to localStorage after generation.
  const priorSheets = useMemo(() => {
    try {
      return {
        iterable: parsePriorIterableSheet(localStorage.getItem('esp_prior_iterable') || ''),
        verve:    parsePriorVerveSheet(localStorage.getItem('esp_prior_verve') || ''),
      };
    } catch {
      return { iterable: null, verve: null };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build workorder pools ──────────────────────────────────────────────────
  //
  // All deployable (non-CUT) workorders sorted by score (already are).
  // SLF workorders → Acoustic SEND ALL slots only.
  // Regular (non-SLF, non-NL) workorders → split between Acoustic and Iterable
  //   so the two ESPs never share the same workorder.
  //
  const { acousticRegular, slfWorkorders, acousticFilled, acousticUsedCount, iterableRegular, iterableFilled, verveRegular, verveFilled, blockbusterReport } =
    useMemo(() => {
      const deployable = allWorkorders.filter(wo => wo.tier !== 'CUT');

      // WOs whose day3 volume collapsed to < 35% of day1 — deprioritised in tomorrow slots
      const collapsingSet = new Set(allWorkorders.filter(w => w.isCollapsing).map(w => w.workorder));

      // Dollar weighting for slot allocation — expected gross drives how many
      // sends a piece gets, and blockbusters get uncapped, heavy volume so the
      // home-run tail is rebuilt rather than flattened.
      const weightOf = new Map(allWorkorders.map(w => [w.workorder, w.expectedGross || 0]));
      const blockbusterSet = new Set(allWorkorders.filter(w => w.isBlockbuster).map(w => w.workorder));

      const slf     = deployable.filter(wo => wo.isSLF).map(wo => wo.workorder);
      const regular = deployable
        .filter(wo =>
          !wo.isSLF &&
          !/^NL/i.test(wo.workorder) &&
          !/^AG/i.test(wo.workorder) &&
          !/^PR/i.test(wo.workorder) &&
          !/^RC/i.test(wo.workorder) &&
          !blockedWOs.has(wo.workorder)
        )
        .map(wo => wo.workorder);

      // Build tomorrow pool for Acoustic — collapsing WOs pushed to back
      const acousticTmrPool = buildTomorrowPool(regular, allWorkorders, freshPct, dayMode, { collapsingWOs: collapsingSet });

      // 1. Fill Acoustic, then rebalance: every deployable piece appears at least
      //    once, and the leftover slots are spread across the top pieces so strong
      //    creative repeats a few times.
      const aFilled = fillAcousticTemplate(regular, { dayMode, tomorrowPool: acousticTmrPool });
      rebalanceSheet(aFilled.rows, aFilled.headerIndices, regular, { crOffs: [1, 7], maxRepeat: REPEAT_MAX, weightOf, blockbusterSet, blockbusterCap: BLOCKBUSTER_MAX });
      aFilled.csvString = Papa.unparse(aFilled.rows);

      // 2. Collect every unique non-SLF workorder actually placed in Acoustic Creative rows.
      //    Only look at col > 8 — cols 0-8 contain dates and row-type labels, not workorders.
      const acousticUsed = new Set();
      aFilled.headerIndices.forEach(hi => {
        const creativeRow = aFilled.rows[hi + 1] || [];
        for (let col = 9; col < creativeRow.length; col++) {
          const v = (creativeRow[col] || '').trim();
          if (v && !/^SLF/i.test(v) && !/^NL/i.test(v)) acousticUsed.add(v);
        }
      });

      // Eligible CUT = at least 1 donation (totalDonations) AND net positive (totalRaise > 0),
      //    non-SLF, non-NL, non-AG, non-PR. Lower-priority gap-fill appended to all three ESP pools.
      const eligibleCut = cut
        .filter(wo =>
          !wo.isSLF &&
          !/^NL/i.test(wo.workorder) &&
          !/^AG/i.test(wo.workorder) &&
          !/^PR/i.test(wo.workorder) &&
          !/^RC/i.test(wo.workorder) &&
          !blockedWOs.has(wo.workorder)
        )
        .filter(wo => wo.totalDonations >= 1 && wo.totalRaise > 0)
        .map(wo => wo.workorder);

      // 3. Iterable gets the full ranked pool — Eligible CUT appended as gap-fill.
      const iterablePool = [...regular, ...eligibleCut];

      // Build tomorrow pool for Iterable (shared pool — no acoustic-rotation step needed)
      const iterableTmrPool = dayMode > 0
        ? buildTomorrowPool(iterablePool, allWorkorders, freshPct, dayMode, { collapsingWOs: collapsingSet })
        : iterablePool;

      const iFilled = fillIterableTemplate(iterablePool, { dayMode, tomorrowPool: iterableTmrPool, priorSheet: priorSheets.iterable });

      // 4. Verve also gets the full pool — prior-sheet rotation + per-template gap rules
      //    keep the same workorder from landing in the same time-slot column two days in a row.
      const vervePool = [...regular, ...eligibleCut];
      const verveTmrPool = buildTomorrowPool(vervePool, allWorkorders, freshPct, dayMode, { collapsingWOs: collapsingSet });
      const vFilled = fillVerveTemplate(vervePool, { dayMode, tomorrowPool: verveTmrPool, priorSheet: priorSheets.verve });

      // ── New Work Orders: fill Verve clearCols first, then Iterable clearCols ──
      // A shared 80-min gap tracker ensures the same WO isn't sent within 80 min
      // across both ESPs.  Verve has priority (filled first).
      // Both ESPs: new workorders fill NEW/RECENT ACTIVE slots first, then the
      // full ranked pool fills whatever's left so the sheets are always totally
      // full with good creative (today + tomorrow when in tomorrow mode).
      if (newWorkorders.length > 0 || vervePool.length > 0 || iterablePool.length > 0) {
        const sharedNewWOTracker = new Map();
        fillNewWOsIntoVerveRows(vFilled.rows, vFilled.headerIndices, newWorkorders, sharedNewWOTracker, vervePool, dayMode);
        // Only ~50% of Iterable's NEW/RECENT ACTIVE slots are reserved for truly
        // new content; the rest are treated as normal and get ranked creative.
        fillNewWOsIntoIterableRows(iFilled.rows, iFilled.headerIndices, newWorkorders, sharedNewWOTracker, iterablePool, dayMode, 0.5);
        // Rebalance Iterable the same way (coverage + top-piece repeats), and
        // let eligible-CUT gap-fillers be repurposed to cover real deployable pieces.
        rebalanceSheet(iFilled.rows, iFilled.headerIndices, regular, { crOffs: [1, 8], maxRepeat: REPEAT_MAX, weightOf, blockbusterSet, blockbusterCap: BLOCKBUSTER_MAX, reclaim: eligibleCut });
        vFilled.csvString = Papa.unparse(vFilled.rows);
        iFilled.csvString = Papa.unparse(iFilled.rows);
      }

      // ── Vanished-tail diagnostic ────────────────────────────────────────────
      // Revenue historically came from a few blockbuster deployments.  Surface
      // the biggest 30-day gross earners and how hard they're being sent now, so
      // it's obvious if the home-run tail is being suppressed (CUT, blocked, or
      // barely deployed) rather than genuinely gone.
      const countIn = (rows, hi0, offs, wo) => {
        let n = 0;
        for (const hi of hi0) for (const off of offs) { const cr = rows[hi + off] || []; for (let c = 9; c < cr.length; c++) if ((cr[c] || '').trim() === wo) n++; }
        return n;
      };
      const blockbusterReport = allWorkorders
        .filter(w => (w.hist30Gross || 0) >= 500)
        .sort((a, b) => (b.hist30Gross || 0) - (a.hist30Gross || 0))
        .slice(0, 30)
        .map(w => {
          const blocked = blockedWOs.has(w.workorder);
          const aSends = blocked ? 0 : countIn(aFilled.rows, aFilled.headerIndices, [1, 7], w.workorder);
          const iSends = blocked ? 0 : countIn(iFilled.rows, iFilled.headerIndices, [1, 8], w.workorder);
          const concern = blocked ? 'blocked' : w.tier === 'CUT' ? 'cut' : (aSends + iSends) === 0 ? 'not deployed' : null;
          return { workorder: w.workorder, hist30Gross: w.hist30Gross, tier: w.tier, isBlockbuster: !!w.isBlockbuster, aSends, iSends, concern };
        });

      return {
        acousticRegular:   regular,
        slfWorkorders:     slf,
        acousticFilled:    aFilled,
        acousticUsedCount: acousticUsed.size,
        iterableRegular:   iterablePool,
        iterableFilled:    iFilled,
        verveRegular:      vervePool,
        verveFilled:       vFilled,
        blockbusterReport,
      };
    }, [allWorkorders.map(w => w.workorder + w.tier + (w.isUnderSent ? '1' : '0') + (w.isCollapsing ? 'c' : '')).join(','), dayMode, freshPct, [...blockedWOs].sort().join(','), newWorkorders.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save generated sheets to localStorage so the next session can avoid
  //    repeating the same workorder in the same time-slot column ────────────────
  useEffect(() => {
    if (!iterableFilled?.csvString || !verveFilled?.csvString) return;
    try {
      localStorage.setItem('esp_prior_iterable', iterableFilled.csvString);
      localStorage.setItem('esp_prior_verve',    verveFilled.csvString);
    } catch { /* quota exceeded or private browsing — silently skip */ }
  }, [iterableFilled?.csvString, verveFilled?.csvString]);

  // Unique non-SLF workorders actually placed in Acoustic's creative rows
  const acousticUniqueCount = acousticUsedCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-lg">Transfer to Deployment Sheets</h2>
              <p className="text-indigo-100 text-sm mt-1">
                Top-ranked workorders scheduled across all ESPs — strongest creative reaches every audience
              </p>
            </div>
            <button
              onClick={onReset}
              className="text-indigo-100 hover:text-white text-sm font-medium border border-indigo-400 hover:border-white px-4 py-2 rounded-lg transition-colors"
            >
              New Analysis
            </button>
          </div>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          <div className="px-6 py-4 text-center">
            <div className="text-2xl font-bold text-green-600">{acoustic.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">TOP TIER</div>
          </div>
          <div className="px-6 py-4 text-center">
            <div className="text-2xl font-bold text-amber-500">{iterable.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">SECOND TIER</div>
          </div>
          <div className="px-6 py-4 text-center">
            <div className="text-2xl font-bold text-red-400">{cut.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">CUT</div>
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400 leading-relaxed flex-1">
            Top workorders are scheduled on every ESP — the strongest creative reaches Acoustic, Iterable, and Verve audiences simultaneously. Click <strong className="text-gray-600">Open & Copy Grid</strong> to view and copy each filled sheet.
          </p>
          <div className="flex-shrink-0 flex items-center rounded-xl border border-gray-200 overflow-hidden text-sm font-semibold">
            {[
              { label: 'Today', value: 0 },
              { label: '🌙 Tomorrow', value: 1 },
              { label: '📅 2-Day', value: 2 },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setDayMode(value)}
                className={`px-3 py-2 transition-all border-r border-gray-200 last:border-r-0
                  ${dayMode === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {dayMode === 1 && (
          <div className="px-6 pb-4 space-y-2">
            <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 leading-relaxed">
              <strong>Tomorrow Mode</strong> — Tomorrow rows pre-filled with workorders rotated to the opposite half of the day.
            </p>
            <FreshMixSlider freshPct={freshPct} onChange={setFreshPct} dayMode={dayMode} />
          </div>
        )}
        {dayMode === 2 && (
          <div className="px-6 pb-4 space-y-2">
            <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 leading-relaxed">
              <strong>2-Day Mode</strong> — Rotated twice as far from tomorrow's sheet. Use to pre-schedule two days ahead without overlapping Tomorrow Mode sends.
            </p>
            <FreshMixSlider freshPct={freshPct} onChange={setFreshPct} dayMode={dayMode} />
          </div>
        )}
      </div>

      {/* Home-run tail diagnostic */}
      {blockbusterReport && blockbusterReport.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-gray-800">🎯 Home-run tail — top 30-day gross earners</h3>
              <p className="text-xs text-gray-400 mt-0.5">Send volume now tracks expected dollars. Red = a big earner that isn't deploying (cut, blocked, or suppressed).</p>
            </div>
            {(() => { const c = blockbusterReport.filter(r => r.concern).length; return (
              <span className={`text-xs font-semibold px-2 py-1 rounded ${c ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {c ? `${c} not deploying` : 'all deploying ✓'}
              </span>
            ); })()}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-50">
                <tr><th className="text-left px-4 py-2 font-medium">Workorder</th><th className="text-right px-3 py-2 font-medium">30-day gross</th><th className="text-center px-3 py-2 font-medium">Tier</th><th className="text-center px-3 py-2 font-medium">Acoustic ×</th><th className="text-center px-3 py-2 font-medium">Iterable ×</th></tr>
              </thead>
              <tbody>
                {blockbusterReport.map(r => (
                  <tr key={r.workorder} className={`border-b border-gray-50 ${r.concern ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-1.5 font-mono font-semibold text-gray-700">{r.workorder}{r.isBlockbuster && <span className="ml-1 text-[9px] text-amber-500">★</span>}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">${Math.round(r.hist30Gross).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-center text-gray-500">{r.concern ? <span className="text-red-600 font-semibold">{r.concern}</span> : r.tier.replace('_TIER', '')}</td>
                    <td className="px-3 py-1.5 text-center font-semibold text-green-700">{r.aSends}</td>
                    <td className="px-3 py-1.5 text-center font-semibold text-amber-600">{r.iSends}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ESP Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AcousticTransferCard
          filled={acousticFilled}
          regularWorkorders={acousticRegular}
          uniqueCount={acousticUniqueCount}
        />
        <IterableTransferCard
          filled={iterableFilled}
          regularWorkorders={iterableRegular}
        />
        <VerveTransferCard
          filled={verveFilled}
          regularWorkorders={verveRegular}
        />
      </div>
    </div>
  );
}
