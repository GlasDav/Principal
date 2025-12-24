import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { getMembers } from '../services/api';
import { Download, RefreshCw, Filter, Calendar as CalendarIcon, PieChart, BarChart2 } from 'lucide-react';
import { ComposedChart, Bar, Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend, PieChart as RePieChart, Pie, Cell } from 'recharts';
import { CategorySelect } from '../components/CategoryTree';


const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Reports() {
    // State
    const [rangeType, setRangeType] = useState("This Month");
    const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
    const [spenderFilter, setSpenderFilter] = useState("Combined");
    const [categoryFilter, setCategoryFilter] = useState(null);

    // Helper to calculate dates
    const getDateRange = (type) => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        if (type === "Last 3 Months") {
            start.setMonth(now.getMonth() - 2);
        } else if (type === "Last 6 Months") {
            start.setMonth(now.getMonth() - 5);
        } else if (type === "This Year") {
            start.setMonth(0);
        } else if (type === "Last Year") {
            start.setFullYear(now.getFullYear() - 1, 0, 1);
            end.setFullYear(now.getFullYear() - 1, 11, 31);
        } else if (type === "Custom") {
            return { start: customStart, end: customEnd };
        }

        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    };

    const { start, end } = getDateRange(rangeType);

    // Fetch User Settings
    const { data: userSettings } = useQuery({
        queryKey: ['userSettings'],
        queryFn: async () => (await api.get('/settings/user')).data
    });

    // Fetch Categories Tree for Filter
    const { data: categories = [] } = useQuery({
        queryKey: ['bucketsTree'],
        queryFn: api.getBucketsTree
    });

    // Fetch Household Members
    const { data: members = [] } = useQuery({
        queryKey: ['members'],
        queryFn: getMembers
    });

    // Fetch Dashboard Data (Summary Cards)
    const { data: dashboardData, isLoading: loadingSummary } = useQuery({
        queryKey: ['reports_summary', start, end, spenderFilter],
        queryFn: async () => {
            const res = await api.get(`/analytics/dashboard`, {
                params: { start_date: start, end_date: end, spender: spenderFilter }
            });
            return res.data;
        }
    });

    // Fetch History Data (Chart)
    const { data: historyData = [], isLoading: loadingHistory } = useQuery({
        queryKey: ['reports_history', start, end, spenderFilter, categoryFilter],
        queryFn: async () => {
            const res = await api.get(`/analytics/history`, {
                params: {
                    start_date: start,
                    end_date: end,
                    bucket_id: categoryFilter
                }
            });
            return res.data;
        }
    });

    // Cash Flow Projection
    const { data: forecastResult } = useQuery({
        queryKey: ['cashFlowForecast'],
        queryFn: async () => (await api.get('/analytics/forecast?days=90')).data
    });
    const cashFlowData = forecastResult?.forecast || [];
    const minBalance = forecastResult?.min_projected_balance;
    const dailyBurn = forecastResult?.daily_burn_rate;

    // Fetch Transactions for Export (Raw Data)
    const handleExport = async () => {
        try {
            const res = await api.get('/transactions/', {
                params: {
                    limit: 10000,
                    start_date: start,
                    end_date: end,
                    spender: spenderFilter !== 'Combined' ? spenderFilter : undefined
                }
            });

            const transactions = res.data.items;
            if (!transactions || transactions.length === 0) {
                alert("No transactions to export for this period.");
                return;
            }

            // Convert to CSV
            const headers = ["Date", "Description", "Amount", "Category", "Spender", "Verified"];
            const csvRows = [headers.join(',')];

            transactions.forEach(t => {
                const row = [
                    t.date,
                    `"${t.description.replace(/"/g, '""')}"`, // Escape quotes
                    t.amount,
                    t.bucket?.name || "Uncategorized",
                    t.spender,
                    t.is_verified ? "Yes" : "No"
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transactions_${start}_to_${end}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            console.error("Export failed", err);
            alert("Failed to export transactions");
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    if (loadingSummary) return <div className="p-8 text-center text-slate-500">Loading Reports...</div>;

    const { totals, buckets } = dashboardData || { totals: { income: 0, expenses: 0, net_savings: 0 }, buckets: [] };

    // Prepare Pie Chart Data (Expenses by Group)
    const groupData = buckets.reduce((acc, bucket) => {
        const group = bucket.group || "Uncategorized";
        if (group === "Income" || group === "Transfer") return acc;
        if (!acc[group]) acc[group] = 0;
        acc[group] += bucket.spent;
        return acc;
    }, {});

    // Add unallocated expenses if needed (total expenses - bucket expenses)
    // For now straightforward approach
    const pieChartData = Object.keys(groupData).map(key => ({ name: key, value: groupData[key] }));

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reports & Analysis</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Deep dive into your spending habits and financial health.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                        <Download size={18} />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Filters:</span>
                </div>

                {/* Date Range */}
                <select
                    value={rangeType}
                    onChange={(e) => setRangeType(e.target.value)}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option>This Month</option>
                    <option>Last 3 Months</option>
                    <option>Last 6 Months</option>
                    <option>This Year</option>
                    <option>Last Year</option>
                    <option>Custom</option>
                </select>

                {rangeType === "Custom" && (
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-sm dark:text-white outline-none"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-sm dark:text-white outline-none"
                        />
                    </div>
                )}

                {/* Spender Filter */}
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                    <button
                        onClick={() => setSpenderFilter('Combined')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${spenderFilter === 'Combined' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Combined
                    </button>
                    {members.map(member => (
                        <button
                            key={member.id}
                            onClick={() => setSpenderFilter(member.name)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${spenderFilter === member.name ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: member.color }}></span>
                            {member.name}
                        </button>
                    ))}
                </div>

                {/* Category Filter */}
                <div className="w-64">
                    <CategorySelect
                        categories={categories}
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        placeholder="Filter by Category"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Income</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">{formatCurrency(totals.income)}</p>
                    <p className="text-xs text-slate-400 mt-1">For selected period</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Expenses</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{formatCurrency(totals.expenses)}</p>
                    <p className="text-xs text-slate-400 mt-1">Excludes transfers</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Savings</p>
                    <p className={`text-3xl font-bold mt-2 ${totals.net_savings >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatCurrency(totals.net_savings)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        Savings Rate: {totals.income > 0 ? Math.round((totals.net_savings / totals.income) * 100) : 0}%
                    </p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Trend Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <BarChart2 size={20} className="text-indigo-500" />
                        Spending History
                    </h2>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(val) => [`$${val.toLocaleString()}`, ""]}
                                />
                                <Legend />
                                <Bar dataKey="spent" name="Spent" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                <Line type="monotone" dataKey="limit" name="Budget Limit" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution Pie Chart */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <PieChart size={20} className="text-indigo-500" />
                        Expenses by Group
                    </h2>
                    <div className="h-64 w-full flex justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(val) => formatCurrency(val)}
                                    contentStyle={{ borderRadius: '8px', border: 'none' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </RePieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Legend/List */}
                    <div className="mt-4 space-y-3">
                        {pieChartData.sort((a, b) => b.value - a.value).map((item, index) => (
                            <div key={item.name} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                                </div>
                                <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(item.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cash Flow Forecast */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Cash Flow Forecast (90 Days)</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Projected balance based on subscriptions and daily burn rate.</p>
                    </div>
                    {(minBalance !== undefined) && (
                        <div className="flex gap-4">
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Daily Burn</p>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(dailyBurn)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Min Projected</p>
                                <p className={`text-sm font-semibold ${minBalance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatCurrency(minBalance)}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={cashFlowData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis
                                dataKey="date"
                                stroke="#94A3B8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            />
                            <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(val) => [`$${val.toLocaleString()}`, "Projected Balance"]}
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                            />
                            <Line type="monotone" dataKey="balance" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div >
    );
}
