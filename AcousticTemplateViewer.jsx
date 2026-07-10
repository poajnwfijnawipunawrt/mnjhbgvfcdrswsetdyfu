import React, { useState, useCallback, useMemo } from 'react';
import { rawRowsToTsv } from './templateFiller';
import { downloadCSV } from './csvGenerator';

/**
 * Full-screen viewer for the filled Acoustic template.
 *
 * Row colouring:
 *   - List-header row  (col[8] === "Time (PST)")  → dark-gray header
 *   - TODAY Creative row (headerIdx + 1)           → green
 *   - Query row         (headerIdx + 2)            → blue-gray (segment names)
 *   - All other rows                               → white / faint stripe
 *
 * Only columns 0–8 + segment columns are shown in the summary strip.
 * The full table is scrollable horizontally.
 */
export default function AcousticTemplateViewer({ rows, headerIndices, filename, csvString, onClose, title = 'Acoustic' }) {
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);

  // Build a set of special row indices for fast lookup
  const rowTypes = useMemo(() => {
    const map = new Map(); // idx → 'header' | 'creative' | 'query'
    headerIndices.forEach(h => {
      map.set(h, 'header');
      map.set(h + 1, 'creative');
      map.set(h + 2, 'query');
    });
    return map;
  }, [headerIndices]);

  // Compute max columns across all rows
  const colCount = useMemo(() => Math.max(...rows.map(r => r.length)), [rows]);

  // Default: show from row 0 to just past the first list block so the user
  // gets a useful preview without rendering hundreds of rows.
  const PREVIEW_ROWS = 15;
  const displayRows = showFull ? rows : rows.slice(0, PREVIEW_ROWS);

  const handleCopy = useCallback(async () => {
    const tsv = rawRowsToTsv(rows);
    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [rows]);

  const handleDownload = () => downloadCSV(filename, csvString);

  // Colour for a cell based on row type and column index
  function cellClass(type, col) {
    if (type === 'header') return 'bg-gray-200 text-gray-700 font-bold text-[10px]';
    if (type === 'creative') {
      if (col === 8) return 'bg-green-100 text-green-700 font-semibold text-[10px]';
      if (col > 8) return 'bg-green-50 text-green-800 font-mono text-[10px]';
      return 'bg-green-50 text-gray-500 text-[10px]';
    }
    if (type === 'query') {
      if (col > 8) return 'bg-blue-50 text-blue-700 font-semibold text-[10px]';
      return 'bg-blue-50 text-gray-400 text-[10px]';
    }
    return 'text-gray-500 text-[10px]';
  }

  function rowBg(type) {
    if (type === 'header') return 'bg-gray-200 border-b-2 border-gray-300';
    if (type === 'creative') return 'bg-green-50 border-b border-green-100';
    if (type === 'query') return 'bg-blue-50/60 border-b border-blue-100';
    return 'border-b border-gray-50';
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900/80 backdrop-blur-sm">
      <div className="flex flex-col bg-white w-full h-full max-h-screen overflow-hidden">

        {/* ── Header bar ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{title} Deployment Sheet — Filled</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{filename}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${copied ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {copied ? '✓ Copied!' : 'Copy All (TSV for Excel / Sheets)'}
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

        {/* ── Legend ── */}
        <div className="flex-shrink-0 flex items-center gap-4 px-6 py-2 bg-gray-50 border-b border-gray-100 text-xs">
          <span className="text-gray-400 font-medium">Row types:</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-gray-300 inline-block"/>
            <span className="text-gray-500">List Header</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-green-100 inline-block"/>
            <span className="text-gray-500">TODAY Creative (filled)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-blue-100 inline-block"/>
            <span className="text-gray-500">Query / Segment names</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-white border border-gray-100 inline-block"/>
            <span className="text-gray-500">Other (preserved)</span>
          </span>
          <span className="ml-4 text-gray-400">
            {headerIndices.length} lists · {rows.length} total rows · {colCount} columns
          </span>
        </div>

        {/* ── Scrollable table ── */}
        <div className="flex-1 overflow-auto">
          <table className="text-xs border-collapse font-mono" style={{ minWidth: 'max-content' }}>
            <tbody>
              {displayRows.map((row, rowIdx) => {
                const type = rowTypes.get(rowIdx) || 'other';
                return (
                  <tr key={rowIdx} className={rowBg(type)}>
                    {/* Row number gutter */}
                    <td className="px-1.5 py-1 text-gray-300 text-right border-r border-gray-100 select-none w-8">
                      {rowIdx + 1}
                    </td>
                    {Array.from({ length: colCount }, (_, col) => {
                      const val = row[col] ?? '';
                      // Query/segment rows: allow long labels like "FPDS_SEND 1"
                      // to size the column. Other rows stay nowrap.
                      const wrapClass = type === 'query'
                        ? 'whitespace-nowrap min-w-[70px]'
                        : 'whitespace-nowrap';
                      return (
                        <td
                          key={col}
                          className={`px-1.5 py-1 ${wrapClass} border-r border-gray-50 ${cellClass(type, col)}`}
                        >
                          {val || (type === 'creative' && col > 8 ? <span className="text-gray-200">—</span> : '')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!showFull && rows.length > PREVIEW_ROWS && (
            <div className="p-4 text-center border-t border-gray-100">
              <button
                onClick={() => setShowFull(true)}
                className="text-sm text-blue-500 hover:text-blue-700 font-medium"
              >
                Show all {rows.length} rows ({headerIndices.length} lists) ▼
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
