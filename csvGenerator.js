import Papa from 'papaparse';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const ESP_CAPACITY = {
  Acoustic: 32,
  Iterable: 60,
  Verve: 42,
};

// Fixed slot counts for NL / New / Warming columns
const NL_SLOTS = 3;
const NEW_SLOTS = 3;
const WARMING_SLOTS = 3;
const GAP_ROWS = 14;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dateLabel(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

/**
 * Build one list block: name row + today row + tomorrow row + GAP_ROWS blank rows.
 * headers: array of slot column names (not including the 'List' column)
 * todayValues: array of values aligned to headers
 * tomorrowValues: array of values aligned to headers
 */
function buildListBlock(listName, todayValues, tomorrowValues, headers) {
  const makeRow = (label, values) => {
    const row = { List: label };
    headers.forEach((h, i) => { row[h] = values[i] !== undefined ? values[i] : ''; });
    return row;
  };
  const blankRow = () => makeRow('', headers.map(() => ''));

  return [
    makeRow(listName, headers.map(() => '')),          // list name row — no workorders
    makeRow(dateLabel(0), todayValues),                // Today row — filled
    makeRow(dateLabel(1), tomorrowValues),             // Tomorrow row — blank workorders, NL preserved
    ...Array.from({ length: GAP_ROWS }, blankRow),     // gap rows
  ];
}

/**
 * Acoustic: all slots equal value — fill with all workorders descending by score.
 */
function generateAcousticGrid(workorders, numLists) {
  const headers = workorders.map((_, i) => `Slot_${i + 1}`);
  const todayValues = workorders.map(wo => wo.workorder);
  const tomorrowValues = workorders.map(() => '');

  const rows = [];
  for (let i = 1; i <= numLists; i++) {
    rows.push(...buildListBlock(`List_${i}`, todayValues, tomorrowValues, headers));
  }
  return { headers: ['List', ...headers], rows };
}

/**
 * Iterable: typed slots — Gangbusters (best) → Rising/Top Performer → NL (permanent) → New (blank).
 * Verve adds Warming slots (also blank).
 * workorders should already be sorted descending by score.
 */
function generateIterableGrid(workorders, numLists, includeWarming = false) {
  const n = workorders.length;
  // Top 40% go to Gangbusters, rest to Rising/Top Performer
  const gbCount = n > 0 ? Math.max(1, Math.ceil(n * 0.4)) : 0;
  const rpCount = n - gbCount;

  const gbWorkorders = workorders.slice(0, gbCount);
  const rpWorkorders = workorders.slice(gbCount);

  const headers = [
    ...gbWorkorders.map((_, i) => `Gangbusters_${i + 1}`),
    ...rpWorkorders.map((_, i) => `Rising_TP_${i + 1}`),
    ...Array.from({ length: NL_SLOTS }, (_, i) => `NL_${i + 1}`),
    ...Array.from({ length: NEW_SLOTS }, (_, i) => `New_${i + 1}`),
    ...(includeWarming ? Array.from({ length: WARMING_SLOTS }, (_, i) => `Warming_${i + 1}`) : []),
  ];

  // Today: workorders in GB then RP slots; NL = "NL"; New/Warming = ""
  const todayValues = [
    ...gbWorkorders.map(wo => wo.workorder),
    ...rpWorkorders.map(wo => wo.workorder),
    ...Array(NL_SLOTS).fill('NL'),
    ...Array(NEW_SLOTS).fill(''),
    ...(includeWarming ? Array(WARMING_SLOTS).fill('') : []),
  ];

  // Tomorrow: workorder slots blank; NL still "NL" (permanent); New/Warming still ""
  const tomorrowValues = [
    ...Array(gbCount).fill(''),
    ...Array(rpCount).fill(''),
    ...Array(NL_SLOTS).fill('NL'),
    ...Array(NEW_SLOTS).fill(''),
    ...(includeWarming ? Array(WARMING_SLOTS).fill('') : []),
  ];

  const rows = [];
  for (let i = 1; i <= numLists; i++) {
    rows.push(...buildListBlock(`List_${i}`, todayValues, tomorrowValues, headers));
  }
  return { headers: ['List', ...headers], rows };
}

function toCsv({ headers, rows }) {
  return Papa.unparse({ fields: headers, data: rows });
}

/**
 * Generate deployment summary CSV (one row per workorder — for analysis reference).
 */
function generateSummary(workorders) {
  const rows = workorders.map((wo, idx) => ({
    Rank: idx + 1,
    Workorder: wo.workorder,
    Organization: wo.organization,
    Score: wo.score,
    Latest_Donations: wo.latestDonations,
    Latest_Net_Raise: wo.latestRaise,
    Efficiency: wo.efficiency,
    Efficiency_Trend: wo.trend,
    Total_Donations_3day: wo.totalDonations,
    Total_Raise_3day: wo.totalRaise,
    Status: wo.status,
  }));
  return Papa.unparse(rows);
}

/**
 * Generate all output CSVs. Returns { filename: csvString, ... } plus structured grid data.
 */
export function generateAllCSVs(allocation) {
  const date = todayStr();
  const files = {};
  const grids = {};

  // --- Acoustic ---
  const acousticGrid = generateAcousticGrid(allocation.acoustic, ESP_CAPACITY.Acoustic);
  const acousticCsv = toCsv(acousticGrid);
  files[`acoustic_deployment_grid_${date}.csv`] = acousticCsv;
  grids.acoustic = acousticGrid;

  // Acoustic summary
  files[`acoustic_deployment_${date}.csv`] = generateSummary(allocation.acoustic);

  // --- Iterable ---
  const iterableGrid = generateIterableGrid(allocation.iterable, ESP_CAPACITY.Iterable, false);
  const iterableCsv = toCsv(iterableGrid);
  files[`iterable_deployment_grid_${date}.csv`] = iterableCsv;
  grids.iterable = iterableGrid;

  // Iterable summary
  files[`iterable_deployment_${date}.csv`] = generateSummary(allocation.iterable);

  // --- Verve (structure only, no workorders allocated) ---
  const verveGrid = generateIterableGrid([], ESP_CAPACITY.Verve, true);
  const verveCsv = toCsv(verveGrid);
  files[`verve_deployment_grid_${date}.csv`] = verveCsv;
  grids.verve = verveGrid;

  // --- Cut workorders ---
  files[`workorders_to_cut_${date}.csv`] = Papa.unparse(
    allocation.cut.map(wo => ({
      Workorder: wo.workorder,
      Organization: wo.organization,
      Score: wo.score,
      Latest_Donations: wo.latestDonations,
      Latest_Net_Raise: wo.latestRaise,
      Reason: wo.cutReason,
    }))
  );

  return { files, grids };
}

/**
 * Convert a grid { headers, rows } to tab-separated values for pasting into Excel/Sheets.
 */
export function gridToTsv({ headers, rows }) {
  const lines = [headers.join('\t')];
  rows.forEach(row => {
    lines.push(headers.map(h => row[h] ?? '').join('\t'));
  });
  return lines.join('\n');
}

/**
 * Download a single CSV file.
 */
export function downloadCSV(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename);
}

/**
 * Download all CSVs as a ZIP.
 */
export async function downloadAllAsZip(files) {
  const zip = new JSZip();
  Object.entries(files).forEach(([filename, content]) => {
    zip.file(filename, content);
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `deployment_sheets_${todayStr()}.zip`);
}
