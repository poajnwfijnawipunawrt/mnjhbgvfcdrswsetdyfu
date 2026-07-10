import React, { useState, useCallback } from 'react';

function CopyableWorkorder({ workorder, isTop, isSLF }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(workorder);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [workorder]);

  return (
    <span className="inline-flex items-center gap-1 group">
      <button
        onClick={copy}
        title="Click to copy"
        className={`font-mono font-semibold text-xs px-1.5 py-0.5 rounded transition-all
          ${copied
            ? 'bg-green-100 text-green-700'
            : isTop
              ? 'text-blue-700 hover:bg-blue-100'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
      >
        {copied ? '✓ Copied' : workorder}
      </button>
      {isSLF && !copied && (
        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1 rounded" title="SLF workorder — raise figures multiplied ×100">
          ×100
        </span>
      )}
    </span>
  );
}

const TIER_CONFIG = {
  TOP_TIER: {
    label: 'TOP TIER',
    esp: 'Acoustic',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
  },
  SECOND_TIER: {
    label: 'SECOND TIER',
    esp: 'Iterable',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-400',
  },
  CUT: {
    label: 'CUT',
    esp: 'None',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-600',
    dot: 'bg-red-400',
  },
};

function TrendCell({ trend }) {
  const color = trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-gray-400';
  const arrow = trend > 0 ? '▲' : trend < 0 ? '▼' : '—';
  return (
    <span className={`font-mono text-xs ${color}`}>
      {arrow} {Math.abs(trend).toFixed(2)}
    </span>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 65 ? 'bg-green-100 text-green-700'
    : score >= 35 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold font-mono ${color}`}>
      {score}
    </span>
  );
}

function WorkorderTable({ workorders, tier, showAll, onToggleShowAll, highlightTop = 0 }) {
  const config = TIER_CONFIG[tier];
  const displayed = showAll ? workorders : workorders.slice(0, 20);

  if (workorders.length === 0) {
    return <p className="text-gray-400 text-sm py-4 text-center">No workorders in this tier.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">#</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Workorder</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Organization</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Score</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Donations</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Net Raise</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Efficiency</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Trend</th>
              {tier === 'CUT' && (
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Reason</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayed.map((wo, idx) => {
              const isTop = idx < highlightTop;
              return (
                <tr key={wo.workorder} className={`hover:bg-gray-50 transition-colors ${isTop ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-3 py-2 text-gray-400 text-xs font-mono">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <CopyableWorkorder workorder={wo.workorder} isTop={isTop} isSLF={wo.isSLF} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-xs max-w-[180px] truncate">{wo.organization}</td>
                  <td className="px-3 py-2"><ScoreBadge score={wo.score} /></td>
                  <td className="px-3 py-2 text-gray-700 font-mono text-xs">{wo.latestDonations.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-700 font-mono text-xs">${wo.latestRaise.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    <span className="text-gray-700">${wo.efficiency.toFixed(2)}</span>
                    {wo.confidenceFactor < 1 && (
                      <span className="ml-1 text-[10px] text-amber-500 font-semibold" title={`Low-volume discount: ${Math.round(wo.confidenceFactor * 100)}% confidence (${wo.latestDonations} donations)`}>
                        ×{wo.confidenceFactor.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <TrendCell trend={wo.trend} />
                      {wo.isPlateaued && (
                        <span
                          className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1 py-0.5 rounded"
                          title="Plateau detected — flat efficiency with high volume (−10 pts). Audience may be saturating."
                        >
                          PLATEAU
                        </span>
                      )}
                    </div>
                  </td>
                  {tier === 'CUT' && (
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[200px]">{wo.cutReason}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {workorders.length > 20 && (
        <button
          onClick={onToggleShowAll}
          className="mt-3 text-sm text-blue-500 hover:text-blue-700 font-medium"
        >
          {showAll ? `Show less ▲` : `Show all ${workorders.length} workorders ▼`}
        </button>
      )}
    </div>
  );
}

// ─── Committee Health panel ──────────────────────────────────────────────────
//
// Rolls up workorders by political committee (NRCC, NRSC, RNC).  Shows count,
// donations, boost activity, and proven-performer count per committee.  Click
// a row to filter the WorkorderTable below to that committee.
function CommitteeHealthPanel({ allWorkorders, activeFilter, onFilter }) {
  const COMMITTEES = ['NRCC', 'NRSC', 'RNC'];

  const rollup = COMMITTEES.map(c => {
    const rows = allWorkorders.filter(w => w.committee === c);
    const donations = rows.reduce((s, w) => s + (w.latestDonations || 0), 0);
    const boosted   = rows.filter(w => (w.committeeBoost || 0) > 0).length;
    const proven    = rows.filter(w => w.isProvenPerformer).length;
    return { code: c, count: rows.length, donations, boosted, proven };
  });

  const otherCount     = allWorkorders.filter(w => !w.committee).length;
  const otherDonations = allWorkorders.filter(w => !w.committee)
    .reduce((s, w) => s + (w.latestDonations || 0), 0);

  const filterKey = (key) => activeFilter?.type === 'committee' && activeFilter.value === key;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-sm text-indigo-800">Committee Health</h3>
        <p className="text-[11px] text-indigo-400">NRCC, NRSC, RNC = highest-leverage donation programs · click to filter</p>
      </div>
      <div className="divide-y divide-gray-50">
        {rollup.map(({ code, count, donations, boosted, proven }) => {
          const isActive = filterKey(code);
          return (
            <button
              key={code}
              onClick={() => onFilter(isActive ? null : { type: 'committee', value: code })}
              className={`w-full px-5 py-2.5 flex items-center justify-between text-sm transition-colors
                ${isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3">
                <span className={`font-bold font-mono w-12 text-left ${count > 0 ? 'text-indigo-700' : 'text-gray-300'}`}>
                  {code}
                </span>
                <span className="text-gray-600">{count} WO{count !== 1 ? 's' : ''}</span>
                <span className="text-gray-400">·</span>
                <span className="font-mono text-gray-700">{donations.toLocaleString()} donations</span>
              </div>
              <div className="flex items-center gap-2">
                {boosted > 0 && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded" title="Workorders that received the committee scoring boost">
                    +{boosted} boosted
                  </span>
                )}
                {proven > 0 && (
                  <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded" title="Workorders force-promoted to TOP_TIER on 30-day historical evidence (≥50 donations or ≥$1k net raise)">
                    {proven} proven
                  </span>
                )}
              </div>
            </button>
          );
        })}
        <div className="px-5 py-2.5 flex items-center justify-between text-sm bg-gray-50/40">
          <div className="flex items-center gap-3">
            <span className="font-bold font-mono w-12 text-left text-gray-400">Other</span>
            <span className="text-gray-500">{otherCount} WOs</span>
            <span className="text-gray-300">·</span>
            <span className="font-mono text-gray-500">{otherDonations.toLocaleString()} donations</span>
          </div>
          <span className="text-[11px] text-gray-400">no committee · scoring untouched</span>
        </div>
      </div>
    </div>
  );
}

// ─── Vendor Breakdown panel ──────────────────────────────────────────────────
//
// Diagnostic only — rolls up workorders by vendor agency (Frontline, Active
// Engagement, etc.).  No scoring impact; useful for spotting concentration risk
// (e.g. "Frontline is 35% of channel volume" — Path-to-1k finding).
function VendorBreakdownPanel({ allWorkorders, activeFilter, onFilter }) {
  const byVendor = new Map();
  for (const w of allWorkorders) {
    const code = w.vendor?.code || 'OTHER';
    const name = w.vendor?.name || 'Other';
    if (!byVendor.has(code)) byVendor.set(code, { code, name, count: 0, donations: 0 });
    const e = byVendor.get(code);
    e.count += 1;
    e.donations += (w.latestDonations || 0);
  }
  const rows = [...byVendor.values()].sort((a, b) => b.donations - a.donations);
  const totalDonations = rows.reduce((s, r) => s + r.donations, 0);

  const filterKey = (key) => activeFilter?.type === 'vendor' && activeFilter.value === key;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-r from-purple-50 to-fuchsia-50 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-sm text-purple-800">Vendor Breakdown</h3>
        <p className="text-[11px] text-purple-400">Diagnostic only · concentration awareness · click to filter</p>
      </div>
      <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
        {rows.map(({ code, name, count, donations }) => {
          const pct = totalDonations > 0 ? Math.round((donations / totalDonations) * 100) : 0;
          const isActive = filterKey(code);
          const concentrationFlag = pct >= 30;
          return (
            <button
              key={code}
              onClick={() => onFilter(isActive ? null : { type: 'vendor', value: code })}
              className={`w-full px-5 py-2 flex items-center justify-between text-sm transition-colors
                ${isActive ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-bold font-mono text-purple-700 w-14 text-left">{code}</span>
                <span className="text-gray-600 truncate">{name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs">{count} WO{count !== 1 ? 's' : ''}</span>
                <span className="font-mono text-gray-700 text-xs w-20 text-right">{donations.toLocaleString()} dn</span>
                <span className={`text-[10px] font-bold w-10 text-right ${concentrationFlag ? 'text-orange-600' : 'text-gray-400'}`}
                      title={concentrationFlag ? 'Concentration risk: ≥30% of channel volume' : ''}>
                  {pct}%{concentrationFlag ? ' ⚠' : ''}
                </span>
              </div>
            </button>
          );
        })}
        {rows.length === 0 && (
          <p className="text-gray-400 text-sm py-4 text-center">No vendor data.</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ results, onReset }) {
  const [activeTab, setActiveTab] = useState('TOP_TIER');
  const [showAll, setShowAll] = useState({ TOP_TIER: true, SECOND_TIER: false, CUT: false });
  // Cross-cut filter applied to the WorkorderTable below — clicking a committee
  // or vendor row filters; clicking the same row again clears.
  const [filter, setFilter] = useState(null); // { type: 'committee'|'vendor', value: 'NRCC' } | null

  const { acoustic, iterable, cut, allWorkorders } = results;

  // Apply the cross-cut filter to each tier's rows before they reach the table
  const applyFilter = (rows) => {
    if (!filter) return rows;
    if (filter.type === 'committee') return rows.filter(w => w.committee === filter.value);
    if (filter.type === 'vendor')    return rows.filter(w => (w.vendor?.code || 'OTHER') === filter.value);
    return rows;
  };

  const totalDonations = allWorkorders
    .filter(wo => wo.tier !== 'CUT')
    .reduce((sum, wo) => sum + wo.latestDonations, 0);
  const totalRaise = allWorkorders
    .filter(wo => wo.tier !== 'CUT')
    .reduce((sum, wo) => sum + wo.latestRaise, 0);
  const avgEfficiency = totalDonations > 0 ? totalRaise / totalDonations : 0;

  const filteredAcoustic = applyFilter(acoustic);
  const filteredIterable = applyFilter(iterable);
  const filteredCut      = applyFilter(cut);

  const tabs = [
    { key: 'TOP_TIER',    label: 'TOP TIER',    count: filteredAcoustic.length, color: 'text-green-600' },
    { key: 'SECOND_TIER', label: 'SECOND TIER', count: filteredIterable.length, color: 'text-amber-600' },
    { key: 'CUT',         label: 'CUT',         count: filteredCut.length,      color: 'text-red-500' },
  ];

  const tabData = { TOP_TIER: filteredAcoustic, SECOND_TIER: filteredIterable, CUT: filteredCut };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-lg">Analysis Complete</h2>
              <p className="text-green-100 text-sm mt-1">{allWorkorders.length} workorders analyzed</p>
            </div>
            <button
              onClick={onReset}
              className="text-green-100 hover:text-white text-sm font-medium border border-green-400 hover:border-white px-4 py-2 rounded-lg transition-colors"
            >
              Start New Analysis
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100">
            <div className="text-2xl font-bold text-green-700">{acoustic.length}</div>
            <div className="text-xs text-green-600 font-medium mt-1">TOP TIER</div>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
            <div className="text-2xl font-bold text-amber-700">{iterable.length}</div>
            <div className="text-xs text-amber-600 font-medium mt-1">SECOND TIER</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
            <div className="text-2xl font-bold text-red-600">{cut.length}</div>
            <div className="text-xs text-red-500 font-medium mt-1">CUT</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="text-lg font-bold text-blue-700">${avgEfficiency.toFixed(2)}</div>
            <div className="text-xs text-blue-600 font-medium mt-1">Avg Efficiency</div>
          </div>
        </div>

        <div className="px-6 pb-5 grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-gray-50 pt-4">
          <div>
            <span className="text-xs text-gray-400">Projected Donations</span>
            <div className="font-bold text-gray-800 font-mono">{totalDonations.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-xs text-gray-400">Projected Raise</span>
            <div className="font-bold text-gray-800 font-mono">${totalRaise.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div>
            <span className="text-xs text-gray-400">Deployable</span>
            <div className="font-bold text-gray-800">{acoustic.length + iterable.length} workorders</div>
          </div>
        </div>
      </div>

      {/* Committee Health + Vendor Breakdown — side-by-side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CommitteeHealthPanel allWorkorders={allWorkorders} activeFilter={filter} onFilter={setFilter} />
        <VendorBreakdownPanel allWorkorders={allWorkorders} activeFilter={filter} onFilter={setFilter} />
      </div>

      {/* Active filter indicator */}
      {filter && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            Filtering by <span className="font-bold font-mono">{filter.value}</span>
            <span className="text-blue-400 ml-1">({filter.type})</span>
          </span>
          <button
            onClick={() => setFilter(null)}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold border border-blue-300 hover:border-blue-500 px-3 py-1 rounded-lg transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Tier Tables */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-4 text-sm font-semibold transition-colors relative
                ${activeTab === tab.key ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span className={tab.color}>{tab.label}</span>
              <span className="ml-2 text-xs font-normal text-gray-400">({tab.count})</span>
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tabs.map(tab => activeTab === tab.key && (
            <WorkorderTable
              key={tab.key}
              workorders={tabData[tab.key]}
              tier={tab.key}
              showAll={showAll[tab.key]}
              onToggleShowAll={() => setShowAll(prev => ({ ...prev, [tab.key]: !prev[tab.key] }))}
              highlightTop={tab.key === 'TOP_TIER' ? 5 : 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
