import React from 'react';
import SankeyChart from '../SankeyChart';

/**
 * CashFlowWidget - Sankey diagram wrapper with exclude one-offs toggle
 */
export default function CashFlowWidget({ data, excludeOneOffs, onToggleExcludeOneOffs }) {
    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4 px-1">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Cash Flow Visualization</h2>
                <label className="flex items-center gap-3 cursor-pointer group">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        Exclude One-Offs
                    </span>
                    <div className="relative inline-flex items-center">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={excludeOneOffs}
                            onChange={(e) => onToggleExcludeOneOffs(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                    </div>
                </label>
            </div>
            <SankeyChart data={data} />
        </div>
    );
}
