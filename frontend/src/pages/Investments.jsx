import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    TrendingUp, TrendingDown, DollarSign, PieChart,
    RefreshCw, Plus, Filter, ArrowUpRight, ArrowDownRight,
    Briefcase, Activity
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';
import { SkeletonBox as Skeleton } from '../components/Skeleton';
import AddInvestmentModal from '../components/AddInvestmentModal';
import ImportInvestmentsModal from '../components/ImportInvestmentsModal';

export default function Investments() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // --- Queries ---

    const { data: portfolio, isLoading: loadingPortfolio } = useQuery({
        queryKey: ['investments-portfolio'],
        queryFn: async () => (await api.get('/investments/portfolio')).data
    });

    const { data: history = [], isLoading: loadingHistory } = useQuery({
        queryKey: ['investments-history'],
        queryFn: async () => (await api.get('/investments/history')).data
    });

    const { data: allocation, isLoading: loadingAllocation } = useQuery({
        queryKey: ['investments-allocation'],
        queryFn: async () => (await api.get('/investments/allocation')).data
    });

    const { data: holdings = [], isLoading: loadingHoldings } = useQuery({
        queryKey: ['investments-holdings'],
        queryFn: async () => (await api.get('/investments/holdings')).data
    });

    // --- Mutations ---

    const refreshPricesMutation = useMutation({
        mutationFn: async () => (await api.post('/net-worth/holdings/refresh-prices')).data,
        onMutate: () => setRefreshing(true),
        onSuccess: (data) => {
            queryClient.invalidateQueries(['investments-portfolio']);
            queryClient.invalidateQueries(['investments-allocation']);
            queryClient.invalidateQueries(['investments-holdings']);
            queryClient.invalidateQueries(['investments-history']);
            // Successfully updated holdings
        },
        onSettled: () => setRefreshing(false)
    });

    // --- Helpers ---

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: user?.currency_symbol?.replace('$', '') || 'AUD'
        }).format(val);
    };

    const formatPercent = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val / 100);
    };

    const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#6b7280'];

    // --- Render ---

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <AddInvestmentModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
            />
            <ImportInvestmentsModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Briefcase className="text-emerald-500" />
                        Investments
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Track your portfolio performance across all asset classes.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refreshPricesMutation.mutate()}
                        disabled={refreshing}
                        className={`flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${refreshing ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Updating Prices...' : 'Refresh Prices'}
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <ArrowDownRight size={16} /> {/* Using ArrowDownRight as 'Import' conceptual icon or UploadCloud if imported? Let's use UploadCloud in modal. Here, maybe generic? Or just text. */}
                        <span className="hidden sm:inline">Import CSV</span>
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        Add Investment
                    </button>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Value */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Portfolio Value</span>
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    {loadingPortfolio ? <Skeleton className="h-8 w-32" /> : (
                        <div className="space-y-1">
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(portfolio?.total_value || 0)}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Across {portfolio?.holding_count || 0} holdings
                            </p>
                        </div>
                    )}
                </div>

                {/* Total Return */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Return</span>
                        <div className={`p-2 rounded-lg ${(portfolio?.total_return || 0) >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                            {(portfolio?.total_return || 0) >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        </div>
                    </div>
                    {loadingPortfolio ? <Skeleton className="h-8 w-32" /> : (
                        <div className="space-y-1">
                            <h3 className={`text-3xl font-bold ${(portfolio?.total_return || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {((portfolio?.total_return || 0) >= 0 ? '+' : '')}{formatCurrency(portfolio?.total_return || 0)}
                            </h3>
                            <p className={`text-sm font-medium ${(portfolio?.total_return_percent || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {((portfolio?.total_return_percent || 0) >= 0 ? '+' : '')}{formatPercent(portfolio?.total_return_percent || 0)} all time
                            </p>
                        </div>
                    )}
                </div>

                {/* Allocation Summary (Mini) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Top Sectors</span>
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <PieChart size={20} />
                        </div>
                    </div>
                    {loadingAllocation ? <Skeleton className="h-20 w-full" /> : (
                        <div className="space-y-3 pt-2">
                            {(allocation?.by_sector || []).slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                        <span className="text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{item.name}</span>
                                    </div>
                                    <span className="font-medium text-slate-900 dark:text-white">{Math.round(item.percent)}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* History Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Portfolio Performance</h3>
                    <div className="h-[300px]">
                        {loadingHistory ? <div className="h-full flex items-center justify-center text-slate-400">Loading chart...</div> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={history}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        stroke="#94a3b8"
                                        tick={{ fontSize: 12 }}
                                        tickMargin={10}
                                    />
                                    <YAxis
                                        orientation="right"
                                        tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                        stroke="#94a3b8"
                                        tick={{ fontSize: 12 }}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        formatter={(val) => [formatCurrency(val), 'Value']}
                                        labelFormatter={(d) => new Date(d).toLocaleDateString()}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Asset Allocation */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Asset Allocation</h3>
                    <div className="flex-1 min-h-[300px] relative">
                        {loadingAllocation ? <div className="h-full flex items-center justify-center text-slate-400">Loading chart...</div> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={allocation?.by_type || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {(allocation?.by_type || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(val) => formatCurrency(val)}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        align="center"
                                        layout="horizontal"
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                                    />
                                </RePieChart>
                            </ResponsiveContainer>
                        )}
                        {/* Center Text */}
                        {!loadingAllocation && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                                <div className="text-center">
                                    <span className="block text-2xl font-bold text-slate-900 dark:text-white">
                                        {allocation?.by_type?.length || 0}
                                    </span>
                                    <span className="text-xs text-slate-500">Types</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Holdings Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Holdings</h3>
                    <div className="flex gap-2">
                        <button className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                            <Filter size={18} />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-medium">
                            <tr>
                                <th className="px-6 py-4">Asset</th>
                                <th className="px-6 py-4">Quantity</th>
                                <th className="px-6 py-4">Current Price</th>
                                <th className="px-6 py-4">Cost Basis</th>
                                <th className="px-6 py-4">Market Value</th>
                                <th className="px-6 py-4 text-right">Return</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {holdings.map((h) => {
                                const isPositive = h.total_return >= 0;
                                return (
                                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xs ring-2 ring-white dark:ring-slate-800">
                                                    {h.ticker?.slice(0, 1) || '?'}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-900 dark:text-white">{h.ticker}</div>
                                                    <div className="text-xs text-slate-500">{h.name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            {h.quantity?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium">
                                            {formatCurrency(h.price)}
                                            <span className="text-xs text-slate-400 ml-1 font-normal">({h.currency})</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            {formatCurrency(h.cost_basis)}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            {formatCurrency(h.value)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={`text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {isPositive ? '+' : ''}{formatCurrency(h.total_return)}
                                                </span>
                                                <div className={`flex items-center gap-0.5 text-xs ${isPositive ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-600 bg-red-50 dark:bg-red-900/20'} px-1.5 py-0.5 rounded-full mt-1`}>
                                                    {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                    {formatPercent(h.total_return_percent)}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {holdings.length === 0 && !loadingHoldings && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No investments found. Add your first holding to see it here!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
