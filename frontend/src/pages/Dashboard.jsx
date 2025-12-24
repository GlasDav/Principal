import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { getMembers } from '../services/api';
import {
    CheckCircle, AlertCircle, TrendingUp, TrendingDown, ChevronRight, LineChart, RefreshCw, Wallet, Utensils, ShoppingBag
} from 'lucide-react';
import { ComposedChart, Bar, Line, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { ICON_MAP, DEFAULT_ICON } from '../utils/icons';
import SankeyChart from '../components/SankeyChart';


// Icon Map consolidated in utils/icons.js

export default function Dashboard() {
    // Date Range State
    const [rangeType, setRangeType] = useState("This Month");
    const [spenderMode, setSpenderMode] = useState("Combined");
    const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
    const [trendOption, setTrendOption] = useState("Total");

    // Helper to calculate dates
    const getDateRange = (type) => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of current month

        if (type === "Last 3 Months") {
            start.setMonth(now.getMonth() - 2);
        } else if (type === "Last 6 Months") {
            start.setMonth(now.getMonth() - 5);
        } else if (type === "Year to Date") {
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

    const { data: dashboardData, isLoading } = useQuery({
        queryKey: ['dashboard', start, end, spenderMode],
        queryFn: async () => {
            const res = await api.get(`/analytics/dashboard`, {
                params: {
                    start_date: start,
                    end_date: end,
                    spender: spenderMode
                }
            });
            return res.data;
        }
    });

    const { data: userSettings } = useQuery({
        queryKey: ['userSettings'],
        queryFn: async () => (await api.get('/settings/user')).data
    });

    // Fetch Household Members
    const { data: members = [] } = useQuery({
        queryKey: ['members'],
        queryFn: getMembers
    });

    // Formatting

    const { data: netWorthHistory } = useQuery({
        queryKey: ['netWorthHistory'],
        queryFn: async () => (await api.get('/net-worth/history')).data
    });

    const netWorth = netWorthHistory && netWorthHistory.length > 0
        ? netWorthHistory[netWorthHistory.length - 1].net_worth
        : 0;

    // Spending Trends Data
    const { data: trendHistory = [] } = useQuery({
        queryKey: ['trendHistory', start, end, trendOption],
        queryFn: async () => {
            const params = { start_date: start, end_date: end };
            if (trendOption === "Non-Discretionary") params.group = "Non-Discretionary";
            else if (trendOption === "Discretionary") params.group = "Discretionary";
            else if (trendOption.startsWith("bucket:")) params.bucket_id = trendOption.split(":")[1];

            return (await api.get('/analytics/history', { params })).data;
        }
    });

    // Sankey Data
    const { data: sankeyData } = useQuery({
        queryKey: ['sankey', start, end, spenderMode],
        queryFn: async () => {
            const res = await api.get(`/analytics/sankey`, {
                params: {
                    start_date: start,
                    end_date: end,
                    spender: spenderMode
                }
            });
            return res.data;
        }
    });


    if (isLoading) return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;
    if (!dashboardData) return <div className="p-8 text-center text-red-500">Error loading data. Please check connection.</div>;

    if (isLoading) return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;
    if (!dashboardData) return <div className="p-8 text-center text-red-500">Error loading data. Please check connection.</div>;

    const { buckets, totals } = dashboardData;

    // Formatting
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="max-w-7xl mx-auto p-8 space-y-8">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                </div>
                <div className="relative z-10">
                    <p className="text-indigo-200 text-sm font-medium mb-1">
                        {new Date().getHours() < 12 ? '☀️ Good morning' : new Date().getHours() < 18 ? '🌤️ Good afternoon' : '🌙 Good evening'}
                    </p>
                    <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
                    <p className="text-indigo-100/80">
                        Here's an overview of your finances for {rangeType === "Custom" ? `${start} to ${end}` : rangeType.toLowerCase()}
                    </p>
                </div>
            </div>

            <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Financial Overview</h2>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Date Range Selector */}
                    <select
                        value={rangeType}
                        onChange={(e) => setRangeType(e.target.value)}
                        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none cursor-pointer"
                    >
                        <option>This Month</option>
                        <option>Last 3 Months</option>
                        <option>Last 6 Months</option>
                        <option>Year to Date</option>
                        <option>Last Year</option>
                        <option>Custom</option>
                    </select>

                    {/* Custom Date Inputs */}
                    {rangeType === "Custom" && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                            />
                        </div>
                    )}

                    {/* Spender Mode Toggle */}
                    <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex items-center">
                        <button
                            onClick={() => setSpenderMode('Combined')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${spenderMode === 'Combined'
                                ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            Combined
                        </button>
                        {members.map((member) => (
                            <button
                                key={member.id}
                                onClick={() => setSpenderMode(member.name)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${spenderMode === member.name
                                    ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: member.color }}></span>
                                {member.name}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Income</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totals.income)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Expenses</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(totals.expenses)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Savings</p>
                    <p className={`text-2xl font-bold mt-1 ${totals.net_savings >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatCurrency(totals.net_savings)}
                    </p>
                </div>
                {/* Net Worth Card (New) */}
                <Link to="/net-worth" className="bg-gradient-to-br from-indigo-500 to-violet-600 p-6 rounded-2xl shadow-sm text-white hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-indigo-100 flex items-center gap-2">
                            <Wallet size={16} /> Net Worth
                        </p>
                        <p className="text-2xl font-bold mt-1">
                            {formatCurrency(netWorth)}
                        </p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-20 transform rotate-12 group-hover:scale-110 transition-transform">
                        <Wallet size={80} />
                    </div>
                </Link>
            </div>

            {/* Sankey Diagram */}
            <div className="mb-8">
                <SankeyChart data={sankeyData} />
            </div>

            {/* Spending Trends Section */}
            < div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700" >
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <LineChart size={20} className="text-indigo-500" />
                        Spending Trends
                    </h2>
                    <select
                        className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none cursor-pointer min-w-[200px]"
                        value={trendOption}
                        onChange={(e) => setTrendOption(e.target.value)}
                    >
                        <option value="Total">Total Budget</option>
                        <option value="Non-Discretionary">Non-Discretionary (Needs)</option>
                        <option value="Discretionary">Discretionary (Wants)</option>
                        <optgroup label="Buckets">
                            {buckets.map(b => (
                                <option key={b.id} value={`bucket:${b.id}`}>{b.name}</option>
                            ))}
                        </optgroup>
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
            </div >

            {/* Budget Grid */}
            {/* Needs Section */}
            <section>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><Utensils size={18} /></span>
                    Non-Discretionary (Needs)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {buckets.filter(b => b.group === "Non-Discretionary").map((bucket) => {
                        const Icon = ICON_MAP[bucket.icon] || Wallet;
                        const percent = Math.min(bucket.percent, 100);
                        let barColor = "bg-emerald-500";
                        if (bucket.percent > 90) barColor = "bg-amber-500";
                        if (bucket.percent > 100) barColor = "bg-red-500";

                        return (
                            <Link
                                to={`/transactions?bucket_id=${bucket.id}&start_date=${start}&end_date=${end}`}
                                key={bucket.id}
                                className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
                                            <Icon size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white">{bucket.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                {bucket.is_over ? "Over Budget" : `${formatCurrency(bucket.remaining)} left`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-sm font-bold ${bucket.is_over ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {Math.round(bucket.percent)}%
                                    </div>
                                </div>
                                <div className="relative h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percent}%` }} />
                                </div>
                                <div className="flex justify-between mt-3 text-sm">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">{formatCurrency(bucket.spent)}</span>
                                    <span className="text-slate-400 dark:text-slate-500">Of {formatCurrency(bucket.limit)}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* Wants Section */}
            <section>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <span className="p-1.5 bg-pink-100 text-pink-600 rounded-lg"><ShoppingBag size={18} /></span>
                    Discretionary (Wants)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {buckets.filter(b => (b.group || "Discretionary") === "Discretionary").map((bucket) => {
                        const Icon = ICON_MAP[bucket.icon] || Wallet;
                        const percent = Math.min(bucket.percent, 100);
                        let barColor = "bg-emerald-500";
                        if (bucket.percent > 90) barColor = "bg-amber-500";
                        if (bucket.percent > 100) barColor = "bg-red-500";

                        return (
                            <Link
                                to={`/transactions?bucket_id=${bucket.id}&start_date=${start}&end_date=${end}`}
                                key={bucket.id}
                                className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
                                            <Icon size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                {bucket.name}
                                                {bucket.is_rollover && <RefreshCw size={12} className="text-indigo-500" title="Rollover Fund" />}
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                {bucket.is_over ? "Over Budget" : `${formatCurrency(bucket.remaining)} left`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-sm font-bold ${bucket.is_over ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {Math.round(bucket.percent)}%
                                    </div>
                                </div>
                                <div className="relative h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percent}%` }} />
                                </div>
                                <div className="flex justify-between mt-3 text-sm">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">{formatCurrency(bucket.spent)}</span>
                                    <span className="text-slate-400 dark:text-slate-500">Of {formatCurrency(bucket.limit)}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>
        </div >
    );
}
