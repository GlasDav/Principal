import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { refreshHoldingPrices, getInvestmentHistory } from '../services/api'; // Use standardized API
import {
    TrendingUp, TrendingDown, Plus, DollarSign,
    Landmark, CreditCard, Wallet, LineChart, RefreshCw
} from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CheckInModal from '../components/CheckInModal';
import AccountDetailsModal from '../components/AccountDetailsModal';
import ConnectBank from '../components/ConnectBank';

export default function NetWorth() {
    const queryClient = useQueryClient();
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [chartMode, setChartMode] = useState('net_worth'); // 'net_worth' | 'investments'

    // --- Data Fetching ---
    const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await api.get('/net-worth/accounts')).data
    });

    const { data: history = [], isLoading: loadingHistory } = useQuery({
        queryKey: ['netWorthHistory'],
        queryFn: async () => (await api.get('/net-worth/history')).data
    });

    const { data: investmentHistory = [], isLoading: loadingInvHistory } = useQuery({
        queryKey: ['investmentHistory'],
        queryFn: getInvestmentHistory
    });

    // --- Mutations ---
    const createAccountMutation = useMutation({
        mutationFn: async (newAccount) => {
            await api.post('/net-worth/accounts', newAccount);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['accounts']);
            setIsAddAccountOpen(false);
        }
    });

    const refreshPricesMutation = useMutation({
        mutationFn: refreshHoldingPrices,
        onSuccess: (data) => {
            queryClient.invalidateQueries(['netWorthHistory']);
            queryClient.invalidateQueries(['investmentHistory']);
            queryClient.invalidateQueries(['holdings']);

            if (data.updated_count > 0) {
                alert(`Updated ${data.updated_count} holdings.`);
            } else {
                alert("No holdings to update or all up to date.");
            }
        },
        onError: (err) => {
            alert("Failed to refresh prices. check console.");
            console.error(err);
        }
    });

    // --- Derived State ---
    const latestSnapshot = history.length > 0 ? history[history.length - 1] : null;
    const currentNetWorth = latestSnapshot ? latestSnapshot.net_worth : 0;
    const prevNetWorth = history.length > 1 ? history[history.length - 2].net_worth : 0;
    const change = currentNetWorth - prevNetWorth;
    const changePercent = prevNetWorth !== 0 ? (change / Math.abs(prevNetWorth)) * 100 : 0;

    // --- Add Account Form (Inline) ---
    const [newAccountName, setNewAccountName] = useState("");
    const [newAccountType, setNewAccountType] = useState("Asset");
    const [newAccountCategory, setNewAccountCategory] = useState("Cash");

    const handleAddAccount = (e) => {
        e.preventDefault();
        createAccountMutation.mutate({
            name: newAccountName,
            type: newAccountType,
            category: newAccountCategory
        });
        setNewAccountName("");
    };

    // --- Allocation Data ---
    const allocationData = useMemo(() => {
        if (!latestSnapshot || !latestSnapshot.balances) return [];
        const map = {};
        latestSnapshot.balances.forEach(b => {
            const acc = accounts.find(a => a.id === b.account_id);
            if (acc && acc.type === 'Asset' && b.balance > 0) {
                map[acc.category] = (map[acc.category] || 0) + b.balance;
            }
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [latestSnapshot, accounts]);

    const ALLOCATION_COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B'];

    // Chart Data Config
    const chartData = chartMode === 'net_worth' ? history : investmentHistory;
    const chartDataKey = chartMode === 'net_worth' ? 'net_worth' : 'value';
    const chartColor = chartMode === 'net_worth' ? '#6366f1' : '#8b5cf6'; // Indigo vs Violet

    return (
        <div className="max-w-7xl mx-auto p-8 space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Net Worth</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Track your assets and liabilities over time.</p>
                </div>
                <div>
                    <button
                        onClick={() => refreshPricesMutation.mutate()}
                        disabled={refreshPricesMutation.isPending}
                        className="mr-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2.5 rounded-xl font-medium shadow-sm flex items-center gap-2 transition disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={refreshPricesMutation.isPending ? "animate-spin" : ""} />
                        {refreshPricesMutation.isPending ? "Updating..." : "Refresh Values"}
                    </button>
                    <ConnectBank />
                    <button
                        onClick={() => setIsCheckInOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm flex items-center gap-2 transition"
                    >
                        <Plus size={20} />
                        Monthly Check-in
                    </button>
                </div>
            </header >

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Worth</p>
                    <div className="flex items-end gap-3 mt-1">
                        <span className="text-3xl font-bold text-slate-900 dark:text-white">
                            ${currentNetWorth.toLocaleString()}
                        </span>
                        {history.length > 1 && (
                            <span className={`text-sm font-medium mb-1 px-2 py-0.5 rounded-full flex items-center gap-1 ${change >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {Math.abs(changePercent).toFixed(1)}%
                            </span>
                        )}
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Assets</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">
                        ${(latestSnapshot?.total_assets || 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Liabilities</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">
                        ${(latestSnapshot?.total_liabilities || 0).toLocaleString()}
                    </p>
                </div>
            </div >

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Chart & History */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-96">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <LineChart size={20} className="text-indigo-500" />
                                History
                            </h3>
                            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                                <button
                                    onClick={() => setChartMode('net_worth')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${chartMode === 'net_worth' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    Net Worth
                                </button>
                                <button
                                    onClick={() => setChartMode('investments')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${chartMode === 'investments' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    Investments
                                </button>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorNw" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(str) => new Date(str).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })}
                                    stroke="#94A3B8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#94A3B8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `$${val / 1000}k`}
                                />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700 shadow-xl rounded-xl">
                                                    <p className="text-sm font-medium text-slate-500 mb-2">{new Date(label).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</p>
                                                    <div className="space-y-1">
                                                        <p className="text-lg font-bold text-indigo-600 flex justify-between gap-8">
                                                            <span>{chartMode === 'net_worth' ? 'Net Worth' : 'Value'}</span>
                                                            <span>${data[chartDataKey].toLocaleString()}</span>
                                                        </p>
                                                        {chartMode === 'net_worth' && (
                                                            <>
                                                                <div className="h-px bg-slate-100 dark:bg-slate-700 my-2" />
                                                                <p className="text-sm text-emerald-600 flex justify-between gap-8">
                                                                    <span>Assets</span>
                                                                    <span>+${data.total_assets.toLocaleString()}</span>
                                                                </p>
                                                                <p className="text-sm text-red-500 flex justify-between gap-8">
                                                                    <span>Liabilities</span>
                                                                    <span>-${data.total_liabilities.toLocaleString()}</span>
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey={chartDataKey}
                                    stroke={chartColor}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorNw)"
                                    activeDot={{ r: 6, fill: chartColor, stroke: "#fff", strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div >

                {/* Allocation Chart */}
                < div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-96" >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Wallet size={20} className="text-emerald-500" />
                            Asset Allocation
                        </h3>
                    </div>
                    {
                        allocationData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={allocationData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {allocationData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(val) => `$${val.toLocaleString()}`}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="middle" align="right" layout="vertical" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                No asset data available
                            </div>
                        )
                    }
                </div>
            </div>

            {/* Right Col: Accounts List */}
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Accounts</h3>
                    <button
                        onClick={() => setIsAddAccountOpen(!isAddAccountOpen)}
                        className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
                    >
                        {isAddAccountOpen ? 'Cancel' : '+ Add Account'}
                    </button>
                </div>

                {
                    isAddAccountOpen && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <form onSubmit={handleAddAccount} className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Account Name (e.g. Chase)"
                                    required
                                    className="w-full rounded-lg border-0 py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500"
                                    value={newAccountName}
                                    onChange={(e) => setNewAccountName(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 rounded-lg border-0 py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500"
                                        value={newAccountType}
                                        onChange={(e) => setNewAccountType(e.target.value)}
                                    >
                                        <option value="Asset">Asset</option>
                                        <option value="Liability">Liability</option>
                                    </select>
                                    <select
                                        className="flex-1 rounded-lg border-0 py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500"
                                        value={newAccountCategory}
                                        onChange={(e) => setNewAccountCategory(e.target.value)}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Investment">Investment</option>
                                        <option value="Real Estate">Real Estate</option>
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Loan">Loan</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700">Save Account</button>
                            </form>
                        </div>
                    )
                }

                <div className="space-y-4">
                    {loadingAccounts ? (
                        <div className="text-center text-slate-500 py-8">Loading accounts...</div>
                    ) : (
                        <>
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Assets
                                </h4>
                                <div className="space-y-2">
                                    {accounts.filter(a => a.type === 'Asset').map(account => (
                                        <div key={account.id} onClick={() => { setSelectedAccount(account); setIsDetailsOpen(true); }} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-100 transition-colors flex items-center justify-between group cursor-pointer hover:shadow-md">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                                                    <Wallet size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{account.name}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{account.category}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {accounts.filter(a => a.type === 'Asset').length === 0 && <p className="text-sm text-slate-400 italic pl-2">No assets yet.</p>}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    Liabilities
                                </h4>
                                <div className="space-y-2">
                                    {accounts.filter(a => a.type === 'Liability').map(account => (
                                        <div key={account.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-red-100 transition-colors flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg group-hover:bg-red-100 transition-colors">
                                                    <CreditCard size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{account.name}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{account.category}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {accounts.filter(a => a.type === 'Liability').length === 0 && <p className="text-sm text-slate-400 italic pl-2">No liabilities yet.</p>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <CheckInModal
                isOpen={isCheckInOpen}
                onClose={() => setIsCheckInOpen(false)}
                accounts={accounts}
                onSuccess={() => queryClient.invalidateQueries(['netWorthHistory'])}
            />

            <AccountDetailsModal
                isOpen={isDetailsOpen}
                onClose={() => { setIsDetailsOpen(false); setSelectedAccount(null); }}
                account={selectedAccount}
            />
        </div>
    );
}
