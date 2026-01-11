import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export default function DebugNetWorth() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [repairResult, setRepairResult] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/net-worth/debug-data`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const executeRepair = async () => {
        setLoading(true);
        setError(null);
        setRepairResult(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/net-worth/recalculate-all`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
            const json = await res.json();
            setRepairResult(json);
            // Refresh data after repair
            fetchData();
        } catch (e) {
            setError("Repair Failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Net Worth Diagnostics</h1>
            <p className="mb-4 text-slate-600 dark:text-slate-400">
                This tool checks your historical snapshots for "Zero" balances vs "Missing" data.
                <br />
                If an account is listed in <strong>Zeros</strong>, it means the database explicitly has $0.
                <br />
                If it's in <strong>Missing</strong>, it means the snapshot has no record for that account (a Gap).
            </p>
            <div className="flex gap-4 mb-6">
                <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                    Refresh Data
                </button>
                <button
                    onClick={executeRepair}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                >
                    Run Smart Repair
                </button>
            </div>

            {repairResult && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg mb-4 border border-emerald-200 dark:border-emerald-800">
                    <strong>Success!</strong> Recalculated {repairResult.recalculated} snapshots and repaired {repairResult.repaired_entries} gaps.
                </div>
            )}

            {loading && <div className="text-slate-500">Processing...</div>}
            {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-4">Error: {error}</div>}

            {data && (
                <div className="overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Date</th>
                                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Net Worth</th>
                                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Records</th>
                                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Explicit Zeros ($0)</th>
                                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Missing Records (Gaps)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {data.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="p-4 text-slate-900 dark:text-white font-mono">{new Date(row.date).toLocaleDateString()}</td>
                                    <td className="p-4 text-slate-900 dark:text-white font-mono font-medium">${(row.net_worth || 0).toLocaleString()}</td>
                                    <td className="p-4 text-slate-500 dark:text-slate-400">{row.record_count}</td>
                                    <td className="p-4 text-amber-600 dark:text-amber-400 font-mono text-xs">{row.zeros_str || '-'}</td>
                                    <td className="p-4 text-red-600 dark:text-red-400 font-mono text-xs">{row.missing_str || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
