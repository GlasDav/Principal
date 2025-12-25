import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { getMembers, getUpcomingBills } from '../services/api';

// Widget imports
import SummaryCardsWidget from '../components/widgets/SummaryCardsWidget';
import UpcomingBillsWidget from '../components/widgets/UpcomingBillsWidget';
import CashFlowWidget from '../components/widgets/CashFlowWidget';
import SpendingTrendsWidget from '../components/widgets/SpendingTrendsWidget';
import BudgetProgressWidget from '../components/widgets/BudgetProgressWidget';
import GoalsWidget from '../components/widgets/GoalsWidget';
import NetWorthWidget from '../components/widgets/NetWorthWidget';

export default function Dashboard() {
    // Date Range State
    const [rangeType, setRangeType] = useState("This Month");
    const [spenderMode, setSpenderMode] = useState("Combined");
    const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
    const [trendOption, setTrendOption] = useState("Total");
    const [excludeOneOffs, setExcludeOneOffs] = useState(false);

    // Helper to calculate dates
    const getDateRange = (type) => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

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

    // --- Data Queries ---
    const { data: dashboardData, isLoading } = useQuery({
        queryKey: ['dashboard', start, end, spenderMode],
        queryFn: async () => {
            const res = await api.get(`/analytics/dashboard`, {
                params: { start_date: start, end_date: end, spender: spenderMode }
            });
            return res.data;
        }
    });

    const { data: members = [] } = useQuery({
        queryKey: ['members'],
        queryFn: getMembers
    });

    const { data: netWorthHistory = [] } = useQuery({
        queryKey: ['netWorthHistory'],
        queryFn: async () => (await api.get('/net-worth/history')).data
    });

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

    const { data: sankeyData } = useQuery({
        queryKey: ['sankey', start, end, spenderMode, excludeOneOffs],
        queryFn: async () => {
            const res = await api.get(`/analytics/sankey`, {
                params: { start_date: start, end_date: end, spender: spenderMode, exclude_one_offs: excludeOneOffs }
            });
            return res.data;
        }
    });

    const { data: upcomingBills = [] } = useQuery({
        queryKey: ['upcomingBills'],
        queryFn: () => getUpcomingBills(7),
        staleTime: 300000
    });

    // --- Loading / Error States ---
    if (isLoading) return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;
    if (!dashboardData) return <div className="p-8 text-center text-red-500">Error loading data. Please check connection.</div>;

    const { buckets, totals } = dashboardData;
    const netWorth = netWorthHistory.length > 0 ? netWorthHistory[netWorthHistory.length - 1].net_worth : 0;

    // Formatting helper
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

            {/* Filter Controls */}
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

            {/* Widget Grid */}
            <div className="space-y-8">
                {/* Row 1: Summary Cards */}
                <SummaryCardsWidget totals={totals} netWorth={netWorth} formatCurrency={formatCurrency} />

                {/* Row 2: Net Worth Chart + Goals + Upcoming Bills */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <NetWorthWidget history={netWorthHistory} formatCurrency={formatCurrency} />
                    <GoalsWidget formatCurrency={formatCurrency} />
                    <UpcomingBillsWidget bills={upcomingBills} formatCurrency={formatCurrency} />
                </div>

                {/* Row 3: Cash Flow (Sankey) */}
                <CashFlowWidget
                    data={sankeyData}
                    excludeOneOffs={excludeOneOffs}
                    onToggleExcludeOneOffs={setExcludeOneOffs}
                />

                {/* Row 4: Spending Trends */}
                <SpendingTrendsWidget
                    trendHistory={trendHistory}
                    trendOption={trendOption}
                    onTrendOptionChange={setTrendOption}
                    buckets={buckets}
                />

                {/* Row 5: Budget Progress (Needs + Wants) */}
                <BudgetProgressWidget
                    buckets={buckets}
                    formatCurrency={formatCurrency}
                    startDate={start}
                    endDate={end}
                />
            </div>
        </div>
    );
}
