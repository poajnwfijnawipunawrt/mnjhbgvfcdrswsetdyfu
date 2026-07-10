import React, { useState, useRef, useEffect } from 'react';
import FileUpload from './FileUpload';
import Dashboard from './Dashboard';
import DownloadCenter from './DownloadCenter';
import { mergeWorkorderData, analyzeWorkorders } from './scoring';
import { generateAllCSVs } from './csvGenerator';

// ─── Block list persistence ───────────────────────────────────────────────────
const BLOCK_STORAGE_KEY = 'email_optimizer_blocked_wos';
const HARDCODED_BLOCKED = [
  'AE1730', 'EP0656', 'EP0667', 'EP0683', 'EP0684', 'EP0745', 'EPO684',
  'FL25277', 'FL28011', 'FL28038', 'FL28173', 'FL28241', 'FL28362', 'FL28469',
  'FL28534', 'FL28535', 'FL28698', 'FL28864', 'FL28865', 'FL28914', 'FL29116',
  'FL29178', 'FL29179', 'FL29182', 'FL29374', 'FL29460', 'FL29501', 'FL29537',
  'FL29538', 'FL29594', 'FL29737', 'FL29776', 'FL29826', 'FL29985', 'FL30004',
  'FL30105', 'FL30106', 'FL30232', 'FL30330', 'FL30481', 'FL30485', 'FL30563',
  'FL30570', 'FL30579', 'FL30592', 'FL30609', 'FL30807', 'FL30855', 'FL30922',
  'PC0391', 'PR00249', 'RNC0140', 'RS3231', 'RS3235', 'RS3252', 'RS3253',
  'RS3254', 'RS3301', 'RS3311', 'RS3327', 'RS3328', 'RS3339', 'RS3340',
  'RS3341', 'RS3344', 'RS3345', 'RS3496', 'RS3551', 'RS3697', 'RS3721',
  'TV11326', 'TV11437', 'TV11476', 'TV11486',
];

function loadBlockedWOs() {
  try {
    const stored = localStorage.getItem(BLOCK_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Merge stored list with hardcoded defaults so repo additions
        // are always picked up even on existing browsers
        return new Set([...HARDCODED_BLOCKED, ...parsed]);
      }
    }
  } catch {}
  return new Set(HARDCODED_BLOCKED);
}

function saveBlockedWOs(set) {
  try {
    localStorage.setItem(BLOCK_STORAGE_KEY, JSON.stringify([...set]));
  } catch {}
}

// ─── Block WO Modal ───────────────────────────────────────────────────────────
function BlockWOModal({ blockedWOs, onAdd, onRemove, onClose }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAdd = () => {
    const codes = input
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    if (codes.length === 0) return;

    const invalid = codes.filter(c => !/^[A-Z0-9]+$/i.test(c));
    if (invalid.length > 0) {
      setError(`Invalid code${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')} — letters and numbers only.`);
      return;
    }

    const alreadyBlocked = codes.filter(c => blockedWOs.has(c));
    const toAdd = codes.filter(c => !blockedWOs.has(c));

    if (toAdd.length === 0) {
      setError(`Already blocked: ${alreadyBlocked.join(', ')}`);
      return;
    }

    toAdd.forEach(c => onAdd(c));
    setInput('');

    if (alreadyBlocked.length > 0) {
      setError(`Added ${toAdd.length}. Already blocked: ${alreadyBlocked.join(', ')}`);
    } else {
      setError('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') onClose();
  };

  const sorted = [...blockedWOs].sort();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Blocked Workorders</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Blocked WOs never appear on any deployment sheet. Saved between sessions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none mt-0.5"
          >
            ×
          </button>
        </div>

        {/* Add input */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="FL30482, RS3020, TV11161, ..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent font-mono"
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              Block
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">Separate multiple codes with commas</p>
          {error && (
            <p className={`text-xs mt-1 ${error.startsWith('Added') ? 'text-amber-500' : 'text-red-500'}`}>{error}</p>
          )}
        </div>

        {/* List */}
        <div className="px-6 pb-2 max-h-60 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No workorders blocked yet.</p>
          ) : (
            <div className="space-y-1">
              {sorted.map(wo => (
                <div key={wo} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 group">
                  <span className="font-mono text-sm font-semibold text-gray-700">{wo}</span>
                  <button
                    onClick={() => onRemove(wo)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none opacity-0 group-hover:opacity-100"
                    title="Unblock"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            <span className="font-semibold text-gray-500">Also blocked by rule:</span> All workorders starting with <span className="font-mono font-semibold">AG</span>, <span className="font-mono font-semibold">PR</span>, or <span className="font-mono font-semibold">RC</span> are permanently excluded from all sheets.
          </p>
        </div>
      </div>
    </div>
  );
}

const STEPS = {
  UPLOAD: 'upload',
  ANALYZING: 'analyzing',
  DASHBOARD: 'dashboard',
  DOWNLOAD: 'download',
};

function StepIndicator({ currentStep }) {
  const steps = [
    { key: STEPS.UPLOAD, label: 'Upload', num: 1 },
    { key: STEPS.DASHBOARD, label: 'Analysis', num: 2 },
    { key: STEPS.DOWNLOAD, label: 'Transfer', num: 3 },
  ];

  const order = [STEPS.UPLOAD, STEPS.DASHBOARD, STEPS.DOWNLOAD];
  const currentIdx = order.indexOf(currentStep === STEPS.ANALYZING ? STEPS.DASHBOARD : currentStep);

  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {isDone ? '✓' : step.num}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${isActive ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${idx < currentIdx ? 'bg-green-300' : 'bg-gray-100'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [results, setResults] = useState(null);
  const [csvFiles, setCsvFiles] = useState(null);
  const [blockedWOs, setBlockedWOs] = useState(() => loadBlockedWOs());
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [newWorkorders, setNewWorkorders] = useState([]);

  const handleAddBlock = (code) => {
    setBlockedWOs(prev => {
      const next = new Set([...prev, code]);
      saveBlockedWOs(next);
      return next;
    });
  };

  const handleRemoveBlock = (code) => {
    setBlockedWOs(prev => {
      const next = new Set(prev);
      next.delete(code);
      saveBlockedWOs(next);
      return next;
    });
  };

  const handleAnalyze = (day1Rows, day2Rows, day3Rows, downDays = {}, deployHistory = new Map(), parsedNewWOs = [], history30Rows = []) => {
    setNewWorkorders(parsedNewWOs);
    setStep(STEPS.ANALYZING);

    // Run synchronously but defer to allow spinner to render
    setTimeout(() => {
      const merged = mergeWorkorderData(day1Rows, day2Rows, day3Rows);
      const analyzed = analyzeWorkorders(merged, downDays, deployHistory, history30Rows);

      const acoustic = analyzed.filter(wo => wo.tier === 'TOP_TIER');
      const iterable = analyzed.filter(wo => wo.tier === 'SECOND_TIER');
      const cut = analyzed.filter(wo => wo.tier === 'CUT');

      const allocation = { acoustic, iterable, verve: [], cut };
      const { files, grids } = generateAllCSVs(allocation);

      setResults({ acoustic, iterable, cut, allWorkorders: analyzed });
      setCsvFiles({ files, grids });
      setStep(STEPS.DASHBOARD);
    }, 50);
  };

  const handleReset = () => {
    setResults(null);
    setCsvFiles(null);
    setNewWorkorders([]);
    setStep(STEPS.UPLOAD);
  };

  const handleGoDownload = () => setStep(STEPS.DOWNLOAD);

  return (
    <div className="min-h-screen bg-slate-50">
      {showBlockModal && (
        <BlockWOModal
          blockedWOs={blockedWOs}
          onAdd={handleAddBlock}
          onRemove={handleRemoveBlock}
          onClose={() => setShowBlockModal(false)}
        />
      )}
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              EO
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-base leading-tight">Email Deployment Optimizer</h1>
              <p className="text-xs text-gray-400">Acoustic • Iterable • Verve</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Block WO — always visible */}
            <button
              onClick={() => setShowBlockModal(true)}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-lg transition-colors border border-red-200 flex items-center gap-1.5"
              title={`${blockedWOs.size} workorder${blockedWOs.size !== 1 ? 's' : ''} blocked`}
            >
              <span>🚫</span>
              <span className="hidden sm:inline">Block WO</span>
              {blockedWOs.size > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {blockedWOs.size}
                </span>
              )}
            </button>

            {step === STEPS.DASHBOARD && (
              <button
                onClick={handleGoDownload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                Transfer Sheets →
              </button>
            )}
            {step === STEPS.DOWNLOAD && (
              <button
                onClick={() => setStep(STEPS.DASHBOARD)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
              >
                ← Back to Analysis
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {step !== STEPS.ANALYZING && (
          <StepIndicator currentStep={step} />
        )}

        {/* Upload Step */}
        {step === STEPS.UPLOAD && (
          <FileUpload onAnalyze={handleAnalyze} />
        )}

        {/* Analyzing Spinner */}
        {step === STEPS.ANALYZING && (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-gray-600 font-medium">Analyzing workorders...</p>
            <p className="text-sm text-gray-400">Calculating scores, tiers, and deployment sheets</p>
          </div>
        )}

        {/* Dashboard Step */}
        {step === STEPS.DASHBOARD && results && (
          <Dashboard results={results} onReset={handleReset} onDownload={handleGoDownload} />
        )}

        {/* Transfer Step */}
        {step === STEPS.DOWNLOAD && results && (
          <DownloadCenter results={results} onReset={handleReset} blockedWOs={blockedWOs} newWorkorders={newWorkorders} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-12 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-gray-400">
          <span>Email Deployment Optimizer — Frontline Strategies</span>
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
