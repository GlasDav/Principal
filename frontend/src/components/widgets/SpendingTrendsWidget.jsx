import React from 'react';
import { LineChart } from 'lucide-react';
import { ComposedChart, Bar, Line, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import MultiSelectCategoryFilter from '../MultiSelectCategoryFilter';

/**
 * SpendingTrendsWidget - Historical spending chart with multi-select category filter
 * Now uses the same grouping/sorting as the Reports page filter
 */
export default function SpendingTrendsWidget({
    trendHistory,
    trendOption,
    onTrendOptionChange,
    categories: categoriesProp = [],
    selectedBuckets = [],
    onSelectedBucketsChange
}) {
    // Defensive: ensure categories is always an array to prevent .map() crashes
    const categories = Array.isArray(categoriesProp) ? categoriesProp : [];

    // Handle preset selection (Total, Non-Discretionary, Discretionary)
    const handlePresetChange = (e) => {
        const value = e.target.value;
        onTrendOptionChange(value);
        // Clear bucket selection when changing presets
        if (value !== 'bucket') {
            onSelectedBucketsChange([]);
        }
    };

    // Determine if we're in category filter mode
    const isFilterMode = trendOption === 'bucket' || selectedBuckets.length > 0;

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <LineChart size={20} className="text-indigo-500" />
                    Spending Trends
                </h2>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Preset Dropdown */}
                    <select
                        className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none cursor-pointer"
                        value={isFilterMode ? 'bucket' : trendOption}
                        onChange={handlePresetChange}
                    >
                        <option value="Total">Total Budget</option>
                        <option value="Non-Discretionary">Non-Discretionary (Needs)</option>
                        <option value="Discretionary">Discretionary (Wants)</option>
                        <option value="bucket">Filter by Categories...</option>
                    </select>

                    {/* Multi-Select Category Filter (appears when 'Filter by Categories' is selected) */}
                    {isFilterMode && (
                        <div className="w-64">
                            <MultiSelectCategoryFilter
                                categories={categories}
                                selectedIds={selectedBuckets}
                                onChange={(ids) => {
                                    onSelectedBucketsChange(ids);
                                    // Ensure trendOption is set to 'bucket' when categories are selected
                                    if (ids.length > 0 && trendOption !== 'bucket') {
                                        onTrendOptionChange('bucket');
                                    }
                                }}
                                placeholder="Select categories..."
                            />
                        </div>
                    )}
                </div>
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
