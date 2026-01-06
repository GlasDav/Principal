import React from 'react';
import { LineChart } from 'lucide-react';
import { ComposedChart, Bar, Line, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

/**
 * SpendingTrendsWidget - Historical spending chart with category filter
 */
export default function SpendingTrendsWidget({
    trendHistory,
    trendOption,
    onTrendOptionChange,
    buckets: bucketsProp = []
}) {
    // Defensive: ensure buckets is always an array to prevent .map() crashes
    const buckets = Array.isArray(bucketsProp) ? bucketsProp : [];

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <LineChart size={20} className="text-indigo-500" />
                    Spending Trends
                </h2>
                <select
                    className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none cursor-pointer min-w-[200px]"
                    value={trendOption}
                    onChange={(e) => onTrendOptionChange(e.target.value)}
                >
                    <option value="Total">Total Budget</option>
                    <option value="Non-Discretionary">Non-Discretionary (Needs)</option>
                    <option value="Discretionary">Discretionary (Wants)</option>

                    {buckets.filter(b => b.group === 'Non-Discretionary').length > 0 && (
                        <optgroup label="Non-Discretionary">
                            {buckets
                                .filter(b => b.group === 'Non-Discretionary')
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(b => (
                                    <option key={b.id} value={`bucket:${b.id}`}>{b.name}</option>
                                ))
                            }
                        </optgroup>
                    )}

                    {buckets.filter(b => b.group === 'Discretionary').length > 0 && (
                        <optgroup label="Discretionary">
                            {buckets
                                .filter(b => b.group === 'Discretionary')
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(b => (
                                    <option key={b.id} value={`bucket:${b.id}`}>{b.name}</option>
                                ))
                            }
                        </optgroup>
                    )}

                    {buckets.filter(b => b.group !== 'Non-Discretionary' && b.group !== 'Discretionary').length > 0 && (
                        <optgroup label="Other">
                            {buckets
                                .filter(b => b.group !== 'Non-Discretionary' && b.group !== 'Discretionary')
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(b => (
                                    <option key={b.id} value={`bucket:${b.id}`}>{b.name}</option>
                                ))
                            }
                        </optgroup>
                    )}
                </select>
            </div>

            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                            dataKey="label"
                            stroke="#94A3B8"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#94A3B8"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => `$${val}`}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(val) => [`$${val.toLocaleString()}`, ""]}
                        />
                        <Bar dataKey="spent" name="Spent" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        <Line type="monotone" dataKey="limit" name="Budget Limit" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
