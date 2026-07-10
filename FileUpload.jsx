import React, { useRef, useState } from 'react';
import Papa from 'papaparse';

const REQUIRED_COLUMNS = ['Workorder', 'Organization', 'Donations', 'Gross Raise', 'Net Raise'];
const WORKORDER_REGEX = /^[A-Z]{2,4}\d{2,5}$/;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Parse raw text into a deduplicated list of valid workorder codes ─────────
function parseNewWOText(text) {
  const codes = text
    .split(/[\s,;|\n\r]+/)
    .map(s => s.trim().toUpperCase())
    .filter(s => WORKORDER_REGEX.test(s));
  return [...new Set(codes)];
}


// ─── Optional Past-30-Days history dropzone ───────────────────────────────────
function History30Dropzone({ fileState, onFile, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      onFile(null, ['File exceeds 10MB limit.'], [], null);
      return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const { errors, warnings, rows } = validateCSV(result);
        onFile(file.name, errors, warnings, rows);
      },
      error: () => {
        onFile(file.name, ['Unable to parse CSV file. Please check format.'], [], null);
      },
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const hasFile  = !!fileState?.name;
  const hasErrors = fileState?.errors?.length > 0;
  const hasRows  = fileState?.rows?.length > 0;

  return (
    <div className="border-t border-gray-100 px-6 pt-5 pb-2">
      <p className="text-sm font-semibold text-purple-700 flex items-center gap-2 mb-1">
        <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-600">H</span>
        Past 30 Days — Historical Boost
        <span className="text-[10px] font-normal bg-purple-100 text-purple-500 px-1.5 py-0.5 rounded-full">optional</span>
      </p>
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer
          ${dragging ? 'border-purple-400 bg-purple-50' : hasErrors ? 'border-red-300 bg-red-50' : hasRows ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/30'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !hasFile && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onInputChange} />
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg
            ${hasErrors ? 'bg-red-100' : hasRows ? 'bg-purple-100' : 'bg-gray-100'}`}>
            📅
          </div>
          <div className="flex-1 min-w-0">
            {hasFile ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-800 truncate">{fileState.name}</span>
                  {hasRows && !hasErrors && <span className="text-green-600 text-sm font-bold">✓</span>}
                  {hasErrors && <span className="text-red-500 text-sm font-bold">✗</span>}
                </div>
                {hasRows && !hasErrors && (
                  <p className="text-sm text-purple-600 mt-0.5">{fileState.rows.length} workorders loaded — historical boosts active</p>
                )}
                {hasErrors && fileState.errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-600 mt-0.5">{err}</p>
                ))}
              </>
            ) : (
              <>
                <p className="font-medium text-gray-600 text-sm">Upload 30-day aggregate CSV</p>
                <p className="text-xs text-gray-400 mt-0.5">Drag & drop or click to browse</p>
              </>
            )}
          </div>
          <div className="flex-shrink-0 flex gap-2">
            {hasFile ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="text-xs text-purple-500 hover:text-purple-700 font-medium px-2 py-1 rounded hover:bg-purple-50"
                >Replace</button>
                <button
                  onClick={(e) => { e.stopPropagation(); onClear(); }}
                  className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50"
                >✕</button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                className="text-xs text-purple-500 hover:text-purple-700 font-medium px-3 py-1.5 rounded-lg border border-purple-200 hover:border-purple-400 bg-white"
              >Choose File</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New Work Orders input panel ──────────────────────────────────────────────
function NewWorkOrdersPanel({ value, onChange }) {
  const parsed = parseNewWOText(value);

  return (
    <div className="border-t border-gray-100">
      <div className="px-6 py-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-blue-700 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">N</span>
            New Work Orders
          </p>
        </div>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g.  FL31000, TV11500, RS4001&#10;or paste one per line..."
          rows={4}
          className="w-full px-3 py-2.5 text-sm font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder-gray-300"
        />
        {parsed.length > 0 ? (
          <div className="flex items-start gap-2">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">✓</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-green-700">{parsed.length} workorder{parsed.length !== 1 ? 's' : ''} ready for NEW slots</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {parsed.slice(0, 12).map(wo => (
                  <span key={wo} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-mono text-[10px] font-semibold border border-blue-100">{wo}</span>
                ))}
                {parsed.length > 12 && (
                  <span className="px-1.5 py-0.5 text-gray-400 text-[10px]">+{parsed.length - 12} more</span>
                )}
              </div>
            </div>
          </div>
        ) : value.trim() ? (
          <p className="text-xs text-amber-500">No valid workorder codes detected. Format: 2–4 letters + 2–5 digits (e.g. FL31000)</p>
        ) : null}
      </div>
    </div>
  );
}

function validateCSV(parsed) {
  const errors = [];
  const warnings = [];

  if (!parsed || !parsed.data || parsed.data.length === 0) {
    return { errors: ['No data found in file.'], warnings, rows: [] };
  }

  const headers = parsed.meta.fields || [];
  const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`);
    return { errors, warnings, rows: [] };
  }

  const rows = parsed.data.filter(row => row.Workorder && String(row.Workorder).trim());

  rows.forEach((row, idx) => {
    const wo = String(row.Workorder).trim();
    if (!WORKORDER_REGEX.test(wo)) {
      warnings.push(`Row ${idx + 2}: Unusual workorder format "${wo}"`);
    }
  });

  if (rows.length === 0) {
    errors.push('No valid workorders found in file.');
  }

  return { errors, warnings, rows };
}

function DayDropzone({ dayLabel, daySubLabel, dayNum, fileState, onFile, onClear, isDown, onToggleDown }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      onFile(dayNum, null, ['File exceeds 10MB limit.'], [], null);
      return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const { errors, warnings, rows } = validateCSV(result);
        onFile(dayNum, file.name, errors, warnings, rows);
      },
      error: () => {
        onFile(dayNum, file.name, ['Unable to parse CSV file. Please check format.'], [], null);
      },
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const hasFile = !!fileState?.name;
  const hasErrors = fileState?.errors?.length > 0;
  const hasRows = fileState?.rows?.length > 0;

  return (
    <div
      className={`relative border-2 rounded-xl p-5 transition-all cursor-pointer
        ${dragging ? 'border-blue-400 bg-blue-50' : hasErrors ? 'border-red-300 bg-red-50' : hasRows ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !hasFile && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onInputChange} />

      <div className="flex items-start gap-4">
        {/* Day Badge */}
        <div className={`flex-shrink-0 w-14 rounded-lg px-1 py-2 flex flex-col items-center justify-center font-bold text-xs text-center leading-tight
          ${hasErrors ? 'bg-red-100 text-red-600' : hasRows ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'}`}>
          {dayLabel}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {hasFile ? (
            <>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-800 truncate">{fileState.name}</span>
                {hasRows && !hasErrors && (
                  <span className="text-green-600 text-sm font-bold">✓</span>
                )}
                {hasErrors && (
                  <span className="text-red-500 text-sm font-bold">✗</span>
                )}
              </div>
              {hasRows && !hasErrors && (
                <p className="text-sm text-green-600 mt-0.5">{fileState.rows.length} workorders loaded</p>
              )}
              {hasErrors && fileState.errors.map((err, i) => (
                <p key={i} className="text-sm text-red-600 mt-0.5">{err}</p>
              ))}
              {fileState.warnings?.length > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">{fileState.warnings.length} format warning(s)</p>
              )}
            </>
          ) : (
            <>
              <p className="font-medium text-gray-700 text-sm">Upload {dayLabel} CSV</p>
              <p className="text-xs text-gray-400 mt-0.5">{daySubLabel}</p>
              <p className="text-xs text-gray-300 mt-0.5">Drag & drop or click to browse</p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-2">
          {hasFile ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50"
              >
                Replace
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onClear(dayNum); }}
                className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg border border-blue-200 hover:border-blue-400 bg-white"
            >
              Choose File
            </button>
          )}
        </div>
      </div>

      {/* Down day toggle — shown once file is loaded */}
      {hasRows && !hasErrors && (
        <div className="mt-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <input
            id={`down-day-${dayNum}`}
            type="checkbox"
            checked={!!isDown}
            onChange={e => onToggleDown(dayNum, e.target.checked)}
            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
          />
          <label htmlFor={`down-day-${dayNum}`} className="text-xs text-amber-700 font-medium cursor-pointer select-none">
            Down day — low volume due to staffing, not workorder performance
          </label>
        </div>
      )}

      {/* Preview rows */}
      {hasRows && !hasErrors && fileState.rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {REQUIRED_COLUMNS.map(col => (
                  <th key={col} className="text-left px-2 py-1 text-gray-500 font-medium whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fileState.rows.slice(0, 3).map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {REQUIRED_COLUMNS.map(col => (
                    <td key={col} className="px-2 py-1 text-gray-700 whitespace-nowrap">{row[col]}</td>
                  ))}
                </tr>
              ))}
              {fileState.rows.length > 3 && (
                <tr className="border-t border-gray-100">
                  <td colSpan={5} className="px-2 py-1 text-gray-400">
                    ... and {fileState.rows.length - 3} more rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function FileUpload({ onAnalyze }) {
  const [files, setFiles] = useState({ 1: null, 2: null, 3: null });
  const [downDays, setDownDays] = useState({ 1: false, 2: false, 3: false });
  const [newWOText, setNewWOText] = useState('');
  const [history30File, setHistory30File] = useState(null);

  const handleFile = (dayNum, name, errors, warnings, rows) => {
    setFiles(prev => ({ ...prev, [dayNum]: { name, errors, warnings, rows } }));
    // Clear down-day flag if file is replaced
    setDownDays(prev => ({ ...prev, [dayNum]: false }));
  };

  const handleClear = (dayNum) => {
    setFiles(prev => ({ ...prev, [dayNum]: null }));
    setDownDays(prev => ({ ...prev, [dayNum]: false }));
  };

  const handleClearAll = () => {
    setFiles({ 1: null, 2: null, 3: null });
    setDownDays({ 1: false, 2: false, 3: false });
    setNewWOText('');
    setHistory30File(null);
  };

  const handleToggleDown = (dayNum, checked) => {
    setDownDays(prev => ({ ...prev, [dayNum]: checked }));
  };

  const allLoaded = [1, 2, 3].every(d => files[d]?.rows?.length > 0 && !files[d]?.errors?.length);
  const anyFile = Object.values(files).some(f => f !== null);

  const handleAnalyze = () => {
    if (!allLoaded) return;
    onAnalyze(
      files[1].rows, files[2].rows, files[3].rows,
      { day1Down: downDays[1], day2Down: downDays[2], day3Down: downDays[3] },
      new Map(), // deploy history no longer collected from UI
      parseNewWOText(newWOText),
      history30File?.rows || [],
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
          <h2 className="text-white font-bold text-lg">Upload Daily Performance Reports</h2>
          <p className="text-blue-100 text-sm mt-1">Upload 3 consecutive days of CSV performance data</p>
        </div>

        <div className="p-6 space-y-3">
          {[
            { num: 1, label: '3 Days Ago', sub: 'Oldest — used as trend baseline' },
            { num: 2, label: '2 Days Ago', sub: 'Middle day' },
            { num: 3, label: 'Yesterday',  sub: 'Most recent — current performance' },
          ].map(({ num, label, sub }) => (
            <DayDropzone
              key={num}
              dayLabel={label}
              daySubLabel={sub}
              dayNum={num}
              fileState={files[num]}
              onFile={handleFile}
              onClear={handleClear}
              isDown={downDays[num]}
              onToggleDown={handleToggleDown}
            />
          ))}
        </div>

        {/* ── 30-Day Historical Boost (optional) ── */}
        <History30Dropzone
          fileState={history30File}
          onFile={(name, errors, warnings, rows) => setHistory30File(name ? { name, errors, warnings, rows } : null)}
          onClear={() => setHistory30File(null)}
        />

        {/* ── New Work Orders ── */}
        <NewWorkOrdersPanel value={newWOText} onChange={setNewWOText} />

        <div className="px-6 pb-6 flex justify-between items-center">
          <button
            onClick={handleClearAll}
            disabled={!anyFile}
            className="text-sm text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!allLoaded}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all
              ${allLoaded
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg active:scale-95'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
          >
            Analyze & Generate
            <span className="text-base">→</span>
          </button>
        </div>
      </div>

      {/* Requirements hint */}
      <div className="mt-4 px-1">
        <p className="text-xs text-gray-400">
          Required CSV columns: <span className="font-mono text-gray-500">Workorder, Organization, Donations, Gross Raise, Net Raise</span>
        </p>
      </div>
    </div>
  );
}
