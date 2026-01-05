import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { refreshHoldingPrices, getInvestmentHistory } from '../services/api'; // Use standardized API
import {
    TrendingUp, TrendingDown, Plus, DollarSign,
    Landmark, CreditCard, Wallet, LineChart, RefreshCw, X, Home, PiggyBank
} from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CheckInModal from '../components/CheckInModal';
import AccountDetailsModal from '../components/AccountDetailsModal';
import AddInvestmentModal from '../components/AddInvestmentModal';

const getCategoryIcon = (category, type) => {
    const c = (category || '').toLowerCase();
    if (c.includes('property') || c.includes('real estate') || c.includes('mortgage')) return Home;
    if (c.includes('investment')) return TrendingUp;
    if (c.includes('super')) return Landmark;  // Superannuation
    if (c.includes('loan')) return Landmark;
    if (c.includes('credit card')) return CreditCard;
    if (c.includes('savings')) return PiggyBank;
    return type === 'Asset' ? Wallet : CreditCard;
};

export default function NetWorth() {
    const queryClient = useQueryClient();
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [chartMode, setChartMode] = useState('net_worth'); // 'net_worth' | 'investments'
    const [showProjection, setShowProjection] = useState(false);
    const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);

    // Helper
    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

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

    // Projection Data
    const { data: projectionData = [] } = useQuery({
        queryKey: ['netWorthProjection'],
        queryFn: async () => (await api.get('/analytics/networth-projection?months=12')).data,
        enabled: showProjection // Only fetch if toggled? Or always fetch. Let's toggle fetch to save bandwidth or just fetch.
    });

    // --- Mutations ---

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
            // Successfully updated holdings
        },
        onError: (err) => {
            console.error("Failed to refresh prices:", err);
        }
    });

    // --- Auto-Refresh on Load ---
    React.useEffect(() => {
        refreshPricesMutation.mutate();
    }, []);

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
    // Category state is removed as per previous refactor, but we need the handle function

    const handleAddAccount = (e) => {
        e.preventDefault();
        // Auto-assign category based on type for simplicity
        const defaultCategory = newAccountType === 'Asset' ? 'Cash' : 'Loan';
        createAccountMutation.mutate({
            name: newAccountName,
            type: newAccountType,
            category: defaultCategory
        });
        setNewAccountName("");
    };

    // --- Allocation Data ---
    // Compute current balances for each account (from snapshot or holdings)
    const accountBalances = useMemo(() => {
        const balMap = {};
        // First, use snapshot balances as base
        if (latestSnapshot?.balances) {
            latestSnapshot.balances.forEach(b => {
                balMap[b.account_id] = b.balance;
            });
        }
        // For investment accounts, also consider holdings if available
        // (investment holdings are fetched separately, but for now we use account.balance)
        accounts.forEach(acc => {
            if (acc.balance !== undefined && acc.balance !== null) {
                balMap[acc.id] = acc.balance;
            }
        });
        return balMap;
    }, [latestSnapshot, accounts]);

    const allocationData = useMemo(() => {
        const map = {};
        accounts.forEach(acc => {
            if (acc.type === 'Asset') {
                const bal = accountBalances[acc.id] || 0;
                if (bal > 0) {
                    map[acc.category] = (map[acc.category] || 0) + bal;
                }
            }
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [accounts, accountBalances]);

    const ALLOCATION_COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B'];

    // Chart Data Config
    // Chart Data Config
    const chartData = useMemo(() => {
        if (chartMode === 'investments') return investmentHistory;

        let data = [...history];
        if (showProjection && projectionData.length > 0 && data.length > 0) {
            // Add connection point (last history point) to projection to ensure continuity
            const lastHistory = data[data.length - 1];

            // Map projection data to match structure
            const projectedPoints = projectionData.map(p => ({
                ...p,
                net_worth: undefined, // Clear normal net_worth so it doesn't render on main line if we use separate key?
                // Actually to make valid single line, we can use same key but different stroke? 
                // Recharts doesn't support changing stroke mid-line easily without custom content.
                // Better: Use separate key "projected_net_worth"
                projected_net_worth: p.net_worth
            }));

            // Add connection point
            projectedPoints.unshift({
                date: lastHistory.date,
                projected_net_worth: lastHistory.net_worth
            });

            // To make the main area stop at today, we leave 'net_worth' as is for history points.
            // For projected points, 'net_worth' is undefined.

            return [...data, ...projectedPoints.slice(1)]; // Append projection (skipping dup date? actually data structure differs)
            // Wait, Recharts needs consistent array.
            // History items: { date, net_worth, ... }
            // Projection items: { date, projected_net_worth, ... }
            // We need to merge them into a single array where:
            // History items have (net_worth, projected_net_worth=null)
            // Projection items have (net_worth=null, projected_net_worth=value)
            // Connection point (today) should have BOTH? No, connection is tricky.
            // Easier: 
            // 1. History items
            // 2. Projection items
        }
        return history;
    }, [chartMode, history, investmentHistory, showProjection, projectionData]);

    // For Recharts to draw two lines connected, the connection point must exist in both sequences?
    // Or we use two Area components.

    // We need a unified data array.
    const unifiedData = useMemo(() => {
        if (chartMode !== 'net_worth' || !showProjection) return chartData;

        const base = history.map(h => ({ ...h, is_projected: false }));
        if (projectionData.length === 0) return base;

        const proj = projectionData.map(p => ({ ...p, is_projected: true, projected_net_worth: p.net_worth, net_worth: undefined }));

        // Connect them: Add a point equal to last history point but with 'projected_net_worth' set
        if (base.length > 0) {
            const last = base[base.length - 1];
            const connection = {
                ...last,
                projected_net_worth: last.net_worth,
                // net_worth is already set, so this point has BOTH.
                // This ensures the first Area ends here and second starts/connects here?
            };
            // Replace last point?
            base[base.length - 1] = connection;
        }

        return [...base, ...proj];
    }, [chartMode, chartData, showProjection, history, projectionData]);

    const activeData = (chartMode === 'net_worth' && showProjection) ? unifiedData : chartData;
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
                            {formatCurrency(currentNetWorth)}
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
                        {formatCurrency(latestSnapshot?.total_assets || 0)}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Liabilities</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">
                        {formatCurrency(latestSnapshot?.total_liabilities || 0)}
                    </p>
                </div>
            </div >

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Chart & History */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-96 flex flex-col">
                        <div className="flex justify-between items-center mb-6 shrink-0">
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
                            {chartMode === 'net_worth' && (
                                <div className="flex items-center gap-2 ml-4">
                                    <label className="flex items-center cursor-pointer relative">
                                        <input type="checkbox" checked={showProjection} onChange={(e) => setShowProjection(e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                        <span className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-400">Projection</span>
                                    </label>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-h-0 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                                                                <span>{formatCurrency(data[chartDataKey])}</span>
                                                            </p>
                                                            {chartMode === 'net_worth' && (
                                                                <>
                                                                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-2" />
                                                                    <p className="text-sm text-emerald-600 flex justify-between gap-8">
                                                                        <span>Assets</span>
                                                                        <span>+{formatCurrency(data.total_assets)}</span>
                                                                    </p>
                                                                    <p className="text-sm text-red-500 flex justify-between gap-8">
                                                                        <span>Liabilities</span>
                                                                        <span>-{formatCurrency(data.total_liabilities)}</span>
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
                                        dataKey={chartMode === 'net_worth' ? 'net_worth' : 'value'}
                                        stroke={chartColor}
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorNw)"
                                    />
                                    {showProjection && chartMode === 'net_worth' && (
                                        <Area
                                            type="monotone"
                                            dataKey="projected_net_worth"
                                            stroke={chartColor}
                                            strokeWidth={3}
                                            strokeDasharray="5 5"
                                            fillOpacity={0.1}
                                            fill={chartColor}
                                            connectNulls={true} // Crucial to connect the dot
                                            activeDot={{ r: 6, fill: chartColor, stroke: "#fff", strokeWidth: 2 }}
                                        />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
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
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">New Account</h3>
                                <button onClick={() => setIsAddAccountOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                // For Investment category, open the AddInvestmentModal instead
                                if (newAccountCategory === 'Investment') {
                                    setIsAddAccountOpen(false);
                                    setIsInvestmentModalOpen(true);
                                    setNewAccountName("");
                                    return;
                                }
                                // For other categories, create the account normally
                                createAccountMutation.mutate({
                                    name: newAccountName,
                                    type: newAccountType,
                                    category: newAccountCategory
                                });
                                setNewAccountName("");
                            }} className="flex flex-col md:flex-row gap-4">
                                <div className="w-full md:w-96">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Account Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Chase Checkings"
                                        required={newAccountCategory !== 'Investment'}
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                    />
                                </div>
                                <div className="w-full md:w-28">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                    <select
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                        value={newAccountType}
                                        onChange={(e) => {
                                            setNewAccountType(e.target.value);
                                            // Reset category when type changes
                                            setNewAccountCategory(e.target.value === 'Asset' ? 'Cash' : 'Loan');
                                        }}
                                    >
                                        <option value="Asset">Asset</option>
                                        <option value="Liability">Liability</option>
                                    </select>
                                </div>
                                <div className="w-full md:w-48">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                                    <select
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                        value={newAccountCategory}
                                        onChange={(e) => setNewAccountCategory(e.target.value)}
                                    >
                                        {newAccountType === 'Asset' ? (
                                            <>
                                                <option value="Cash">Cash</option>
                                                <option value="Savings">Savings</option>
                                                <option value="Investment">Investment (Stocks)</option>
                                                <option value="Superannuation">Superannuation</option>
                                                <option value="Property">Property</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="Loan">Loan</option>
                                                <option value="Mortgage">Mortgage</option>
                                                <option value="Credit Card">Credit Card</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button type="submit" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-6 py-2 text-sm font-medium transition flex items-center gap-2 justify-center">
                                        <Plus size={18} />
                                        {newAccountCategory === 'Investment' ? 'Add Holdings' : 'Create'}
                                    </button>
                                </div>
                            </form>
                            {newAccountType === 'Asset' && newAccountCategory === 'Investment' && (
                                <p className="mt-3 text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg">
                                    💡 Click <strong>Add Holdings</strong> to search for and add stocks, ETFs, and track their prices!
                                </p>
                            )}
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
                                    {accounts.filter(a => a.type === 'Asset').map(account => {
                                        const Icon = getCategoryIcon(account.category, 'Asset');
                                        return (
                                            <div key={account.id} onClick={() => { setSelectedAccount(account); setIsDetailsOpen(true); }} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-100 transition-colors flex items-center justify-between group cursor-pointer hover:shadow-md">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                                                        <Icon size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{account.name}</p>
                                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{account.category}</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-semibold text-emerald-600">
                                                    {formatCurrency(accountBalances[account.id] || 0)}
                                                </p>
                                            </div>
                                        );
                                    })}
                                    {accounts.filter(a => a.type === 'Asset').length === 0 && <p className="text-sm text-slate-400 italic pl-2">No assets yet.</p>}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    Liabilities
                                </h4>
                                <div className="space-y-2">
                                    {accounts.filter(a => a.type === 'Liability').map(account => {
                                        const Icon = getCategoryIcon(account.category, 'Liability');
                                        return (
                                            <div key={account.id} onClick={() => { setSelectedAccount(account); setIsDetailsOpen(true); }} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-red-100 transition-colors flex items-center justify-between group cursor-pointer hover:shadow-md">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg group-hover:bg-red-100 transition-colors">
                                                        <Icon size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{account.name}</p>
                                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{account.category}</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-semibold text-red-500">
                                                    -{formatCurrency(accountBalances[account.id] || 0)}
                                                </p>
                                            </div>
                                        );
                                    })}
                                    {accounts.filter(a => a.type === 'Liability').length === 0 && <p className="text-sm text-slate-400 italic pl-2">No liabilities yet.</p>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div >

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

            <AddInvestmentModal
                isOpen={isInvestmentModalOpen}
                onClose={() => setIsInvestmentModalOpen(false)}
            />
        </div >
    );
}
