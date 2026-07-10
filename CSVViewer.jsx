import React, { useState, useCallback, useRef } from 'react';
import { gridToTsv, downloadCSV } from './csvGenerator';

/**
 * Color-code rows by their type based on the 'List' column value.
 * - List name row: bold gray background
 * - Today's row (date): green tint
 * - Tomorrow's row: blue tint
 * - Empty/gap rows: white
 */
function rowStyle(listValue) {
  if (!listValue) return { bg: '', text: 'text-gray-300' };
  // Date pattern: M/D/YY
  const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2}$/;
  if (!datePattern.test(listValue)) {
    // List name row
    return { bg: 'bg-gray-100', text: 'text-gray-700 font-semibold', isListName: true };
  }
  // Determine today vs tomorrow by index: today comes before tomorrow
  return null; // handled by caller with index tracking
}

/**
 * Slot type label from column header for color-coding columns.
 */
function slotColor(header) {
  if (header === 'List') return 'bg-gray-50 text-gray-500 font-medium';
  if (header.startsWith('Gangbusters')) return 'bg-green-50 text-green-800';
  if (header.startsWith('Rising')) return 'bg-blue-50 text-blue-800';
  if (header.startsWith('NL')) return 'bg-purple-50 text-purple-700';
  if (header.startsWith('New')) return 'bg-amber-50 text-amber-700';
  if (header.startsWith('Warming')) return 'bg-orange-50 text-orange-700';
  if (header.startsWith('Slot')) return 'bg-gray-50 text-gray-700';
  return 'bg-gray-50 text-gray-600';
}

function slotHeaderColor(header) {
  if (header === 'List') return 'bg-gray-100 text-gray-500';
  if (header.startsWith('Gangbusters')) return 'bg-green-100 text-green-700 font-semibold';
  if (header.startsWith('Rising')) return 'bg-blue-100 text-blue-700 font-semibold';
  if (header.startsWith('NL')) return 'bg-purple-100 text-purple-700 font-semibold';
  if (header.startsWith('New')) return 'bg-amber-100 text-amber-700 font-semibold';
  if (header.startsWith('Warming')) return 'bg-orange-100 text-orange-700 font-semibold';
  return 'bg-gray-100 text-gray-600';
}

export default function CSVViewer({ grid, espName, filename, csvString, onClose }) {
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const tableRef = useRef(null);

  const { headers, rows } = grid;

  const handleCopyTsv = useCallback(async () => {
    const tsv = gridToTsv(grid);
    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [grid]);

  const handleDownload = () => downloadCSV(filename, csvString);

  // Determine row types for coloring
  // Each "block" = list name row + today row + tomorrow row + 14 gap rows = 17 rows
  const BLOCK_SIZE = 17;
  function getRowType(rowIdx) {
    const posInBlock = rowIdx % BLOCK_SIZE;
    if (posInBlock === 0) return 'listname';
    if (posInBlock === 1) return 'today';
    if (posInBlock === 2) return 'tomorrow';
    return 'gap';
  }

  // Only show the first few blocks by default for performance; reveal all on demand
  const MAX_ROWS_DEFAULT = BLOCK_SIZE * 3; // first 3 lists
  const displayRows = showFull ? rows : rows.slice(0, MAX_ROWS_DEFAULT);

  // Extract today's template row (first block's today row = index 1)
  const todayTemplateRow = rows[1];
  const todayWorkorderCells = todayTemplateRow
    ? headers.filter(h => h !== 'List' && !h.startsWith('NL') && !h.startsWith('New') && !h.startsWith('Warming'))
        .map(h => ({ slot: h, value: todayTemplateRow[h] || '' }))
        .filter(c => c.value)
    : [];

  const nlCells = todayTemplateRow
    ? headers.filter(h => h.startsWith('NL')).map(h => ({ slot: h, value: todayTemplateRow[h] || '' }))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900/80 backdrop-blur-sm">
      {/* Modal */}
      <div className="flex flex-col bg-white w-full h-full max-h-screen overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{espName} Deployment Grid</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{filename}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyTsv}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${copied ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {copied ? '✓ Copied!' : 'Copy All (TSV for Excel/Sheets)'}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
            >
              Save as CSV
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all text-xl font-light"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Today's Template Summary */}
        {todayWorkorderCells.length > 0 && (
          <div className="flex-shrink-0 px-6 py-3 bg-green-50 border-b border-green-100">
            <p className="text-xs font-semibold text-green-700 mb-2">TODAY'S ROW TEMPLATE — paste into each list's today row</p>
            <div className="flex flex-wrap gap-2">
              {todayWorkorderCells.map(({ slot, value }) => {
                const isGB = slot.startsWith('Gangbusters');
                const isRP = slot.startsWith('Rising');
                return (
                  <div key={slot} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono
                    ${isGB ? 'bg-green-200 text-green-800' : isRP ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                    <span className="opacity-60 text-[10px]">{slot.replace(/_\d+$/, '')}</span>
                    <span className="font-bold">{value}</span>
                  </div>
                );
              })}
              {nlCells.map(({ slot, value }) => (
                <div key={slot} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono bg-purple-100 text-purple-700">
                  <span className="opacity-60 text-[10px]">NL</span>
                  <span className="font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex-shrink-0 flex items-center gap-4 px-6 py-2 bg-gray-50 border-b border-gray-100 text-xs">
          <span className="text-gray-400 font-medium">Row types:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block"/><span className="text-gray-500">List Name</span></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-100 inline-block"/><span className="text-gray-500">Today</span></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-50 inline-block"/><span className="text-gray-500">Tomorrow (blank)</span></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-white border border-gray-100 inline-block"/><span className="text-gray-500">Gap</span></span>
          {espName !== 'Acoustic' && (
            <>
              <span className="ml-2 text-gray-400 font-medium">Slots:</span>
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">GB = Gangbusters</span>
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">RP = Rising/Top</span>
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">NL = Newsletter</span>
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">New = blank</span>
            </>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto" ref={tableRef}>
          <table className="w-full text-xs border-collapse font-mono">
            <thead className="sticky top-0 z-10">
              <tr>
                {headers.map(h => (
                  <th key={h} className={`px-2 py-2 text-left text-[10px] whitespace-nowrap border-b border-gray-200 ${slotHeaderColor(h)}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, rowIdx) => {
                const type = getRowType(rowIdx);
                const rowBg = type === 'listname' ? 'bg-gray-100'
                  : type === 'today' ? 'bg-green-50'
                  : type === 'tomorrow' ? 'bg-blue-50/40'
                  : '';
                return (
                  <tr key={rowIdx} className={`${rowBg} border-b border-gray-50`}>
                    {headers.map(h => {
                      const val = row[h] ?? '';
                      const isEmpty = val === '';
                      return (
                        <td key={h}
                          className={`px-2 py-1 whitespace-nowrap border-r border-gray-50 ${isEmpty ? 'text-gray-200' : slotColor(h)}`}>
                          {val || (type === 'gap' ? '' : '—')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!showFull && rows.length > MAX_ROWS_DEFAULT && (
            <div className="p-4 text-center border-t border-gray-100">
              <button
                onClick={() => setShowFull(true)}
                className="text-sm text-blue-500 hover:text-blue-700 font-medium"
              >
                Show all {rows.length} rows ({Math.floor(rows.length / 17)} lists) ▼
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
