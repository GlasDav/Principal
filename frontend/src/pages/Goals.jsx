import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target as TargetIcon, Plus as PlusIcon, Pencil as PencilIcon, CheckCircle as CheckCircleIcon, TrendingUp as TrendingUpIcon, Building as BuildingIcon, Wallet as WalletIcon, Trash2 as TrashIcon, Calendar as CalendarIcon, Flame as FlameIcon, LineChart as LineChartIcon } from 'lucide-react';
import Button from '../components/ui/Button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import api, { getGoals, createGoal, updateGoal, deleteGoal, getBucketsTree } from '../services/api';
import { Dialog } from '@headlessui/react';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount || 0);
};

// ... (GoalModal component remains unchanged) ...
const GoalModal = ({ isOpen, onClose, goal, accounts, onSave }) => {
    const isEdit = !!goal;
    const [mode, setMode] = useState(goal?.linked_account_id ? 'linked' : 'manual'); // 'linked' | 'manual'

    const [formData, setFormData] = useState({
        name: goal?.name || '',
        target_amount: goal?.target_amount || '',
        target_date: goal?.target_date || '',
        linked_account_id: goal?.linked_account_id || ''
    });

    // Filter accounts: Only Assets
    const safeAccounts = Array.isArray(accounts) ? accounts : [];
    const availableAccounts = safeAccounts.filter(a => a.type === 'Asset');

    const handleSubmit = (e) => {
        e.preventDefault();

        let payload = {
            name: formData.name,
            target_amount: parseFloat(formData.target_amount),
            target_date: formData.target_date || null,
            linked_account_id: mode === 'linked' && formData.linked_account_id ? parseInt(formData.linked_account_id) : null
        };

        // Auto-name if linked and no name provided
        if (mode === 'linked' && !payload.name) {
            const acc = accounts.find(a => a.id === payload.linked_account_id);
            if (acc) payload.name = acc.name;
        }

        onSave(payload);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6">
                    <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                        {isEdit ? "Edit Goal" : "New Goal"}
                    </Dialog.Title>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Mode Selection */}
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg mb-4">
                            <button
                                type="button"
                                onClick={() => setMode('linked')}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${mode === 'linked' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                            >
                                Link to Account
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('manual')}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${mode === 'manual' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                            >
                                Manual Tracking
                            </button>
                        </div>

                        {mode === 'linked' ? (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Link to Account</label>
                                <select
                                    value={formData.linked_account_id}
                                    onChange={e => setFormData({ ...formData, linked_account_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    required={mode === 'linked'}
                                >
                                    <option value="">Select an Account...</option>
                                    {availableAccounts.map(a => (
                                        <option key={a.id} value={a.id}>{a.name} ({a.category}) - ${a.balance?.toLocaleString() || 0}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Goal progress will match this account's balance.</p>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Goal Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Vacation Fund"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    required={mode === 'manual'}
                                />
                                <p className="text-xs text-slate-500 mt-1">Track this goal by assigning specific transactions to it.</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.target_amount}
                                        onChange={e => setFormData({ ...formData, target_amount: e.target.value })}
                                        className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Date</label>
                                <input
                                    type="date"
                                    value={formData.target_date}
                                    onChange={e => setFormData({ ...formData, target_date: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                                Cancel
                            </button>
                            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm">
                                Save Goal
                            </button>
                        </div>
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

// --- NEW COMPONENT: Goal Details with Chart ---
const GoalDetailsModal = ({ isOpen, onClose, goal }) => {
    // 1. Fetch History
    const { data: history = [], isLoading } = useQuery({
        queryKey: ['goal_history', goal?.id],
        queryFn: async () => {
            if (!goal?.id) return [];
            const res = await api.get(`/goals/${goal.id}/history`);
            return res.data;
        },
        enabled: !!goal?.id
    });

    // 2. Compute Projections
    const projection = useMemo(() => {
        if (!history || history.length < 2) return null;

        // Sort history just in case
        const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Use last 90 days for trend (or all if less than 90 days)
        const now = new Date();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(now.getDate() - 90);

        let recentPoints = sorted.filter(p => new Date(p.date) >= ninetyDaysAgo);
        if (recentPoints.length < 2) recentPoints = sorted; // Fallback to all data if not enough recent data

        const first = recentPoints[0];
        const last = recentPoints[recentPoints.length - 1];

        // Calculate daily rate
        const daysDiff = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 0) return null;

        const growth = last.amount - first.amount;
        // Avoid projecting negative growth for "savings" goals unless we want to warn them
        const dailyRate = growth / daysDiff;

        // Remaining
        const remaining = goal.target_amount - last.amount;
        if (remaining <= 0) return { status: 'COMPLETED', date: new Date() }; // Already done

        if (dailyRate <= 0) return { status: 'STAGNANT', date: null };

        const daysToFinish = remaining / dailyRate;
        const completionDate = new Date();
        completionDate.setDate(completionDate.getDate() + daysToFinish);

        return {
            status: 'ON_TRACK',
            date: completionDate,
            dailyRate
        };
    }, [history, goal]);

    if (!isOpen || !goal) return null;

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-5xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
                            <div>
                                <Dialog.Title className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                    {goal.name}
                                    {goal.current_amount >= goal.target_amount && <CheckCircle className="text-green-500" size={24} />}
                                </Dialog.Title>
                                <p className="text-slate-500 dark:text-slate-400 mt-1">
                                    ${goal.current_amount.toLocaleString()} of ${goal.target_amount.toLocaleString()} Goal
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition">
                                <span className="sr-only">Close</span>
                                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-8">

                            {/* 1. Projection Card */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Completion Estimate</h4>
                                    {projection?.status === 'COMPLETED' ? (
                                        <div className="text-green-600 font-bold">Goal Completed! 🎉</div>
                                    ) : projection?.status === 'ON_TRACK' ? (
                                        <div>
                                            <div className="text-xl font-bold text-slate-900 dark:text-white">
                                                {projection.date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                                            </div>
                                            <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                                <TrendingUpIcon size={12} />
                                                Saving ~${(projection.dailyRate * 30).toFixed(0)}/mo
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-slate-400 italic">Not enough growth data yet</div>
                                    )}
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Date</h4>
                                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                                        {goal.target_date ? new Date(goal.target_date).toLocaleDateString('en-AU') : "No deadline"}
                                    </div>
                                    {goal.target_date && projection?.date && projection.status === 'ON_TRACK' && (
                                        <div className={`text-xs mt-1 ${projection.date <= new Date(goal.target_date) ? 'text-green-600' : 'text-amber-500'}`}>
                                            {projection.date <= new Date(goal.target_date) ? "On track to finish early" : "Behind schedule"}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remaining</h4>
                                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                                        ${Math.max(0, goal.target_amount - goal.current_amount).toLocaleString()}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {((goal.current_amount / goal.target_amount) * 100).toFixed(1)}% Funded
                                    </div>
                                </div>
                            </div>

                            {/* 2. Chart */}
                            <div className="h-80 w-full">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Progress History</h4>
                                {isLoading ? (
                                    <div className="h-full flex items-center justify-center text-slate-400">Loading history...</div>
                                ) : history.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={history}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(val) => new Date(val).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                                                stroke="#94a3b8"
                                                fontSize={12}
                                                tickMargin={10}
                                            />
                                            <YAxis
                                                tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                                                stroke="#94a3b8"
                                                fontSize={12}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                                formatter={(val) => [`$${val.toLocaleString()}`, 'Balance']}
                                                labelFormatter={(l) => new Date(l).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            />
                                            <ReferenceLine y={goal.target_amount} label="Target" stroke="#10b981" strokeDasharray="3 3" />
                                            <Line
                                                type="monotone"
                                                dataKey="amount"
                                                stroke="#6366f1"
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                        No history data available yet
                                    </div>
                                )}
                            </div>
                        </div>
                    </Dialog.Panel>
                </div>
            </div>
        </Dialog>
    );
};

export default function Goals() {
    const queryClient = useQueryClient();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);
    const [selectedGoal, setSelectedGoal] = useState(null); // For Detail View
    const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);

    // Fetch Category Goals
    const { data: categoryGoals = [] } = useQuery({
        queryKey: ['category_goals'],
        queryFn: async () => {
            const res = await api.get('/goals/category');
            return res.data;
        }
    });

    const createCategoryGoalMutation = useMutation({
        mutationFn: (newGoal) => api.post('/goals/category', newGoal),
        onSuccess: () => {
            queryClient.invalidateQueries(['category_goals']);
            setCategoryModalOpen(false);
        }
    });

    // Fetch Goals
    const { data: goalsRaw = [], isLoading: goalsLoading } = useQuery({
        queryKey: ['goals'],
        queryFn: getGoals
    });

    // Fetch Accounts for linking dropdown
    const { data: accountsRaw = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await api.get('/net-worth/accounts')).data
    });

    const goals = Array.isArray(goalsRaw) ? goalsRaw : [];
    const accounts = Array.isArray(accountsRaw) ? accountsRaw : [];

    // Mutations
    const createMutation = useMutation({
        mutationFn: createGoal,
        onSuccess: () => {
            queryClient.invalidateQueries(['goals']);
            setModalOpen(false);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }) => updateGoal({ id, ...payload }),
        onSuccess: () => {
            queryClient.invalidateQueries(['goals']);
            setModalOpen(false);
            setEditingGoal(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteGoal,
        onSuccess: () => {
            queryClient.invalidateQueries(['goals']);
        }
    });

    const handleSave = (payload) => {
        if (editingGoal) {
            updateMutation.mutate({ id: editingGoal.id, payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    if (goalsLoading) return <div className="p-8 text-center text-slate-500">Loading Goals...</div>;

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Goals</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Track your savings and spending habits</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => setCategoryModalOpen(true)}
                        icon={PlusIcon}
                    >
                        New Habit
                    </Button>
                    <Button
                        onClick={() => { setEditingGoal(null); setModalOpen(true); }}
                        icon={PlusIcon}
                        className="shadow-lg shadow-indigo-500/30"
                    >
                        New Savings Goal
                    </Button>
                </div>
            </div>

            {/* Spending Habits Section */}
            {categoryGoals.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <FlameIcon className="text-orange-500" size={24} />
                        Spending Habits
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categoryGoals.map(goal => (
                            <div key={goal.id} className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                            {/* Icons mapping would be ideal, fallback for now */}
                                            <FlameIcon size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 dark:text-white">{goal.bucket_name}</h3>
                                            <p className="text-xs text-slate-500">Target: {formatCurrency(goal.target_amount)}/mo</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1 text-orange-500 font-bold bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full text-xs border border-orange-100 dark:border-orange-800">
                                            <FlameIcon size={12} fill="currentColor" />
                                            {goal.streak_months} Month Streak
                                        </div>
                                    </div>
                                </div>

                                {/* Current Month Status */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">This Month</span>
                                        <span className={`font-medium ${goal.current_month_status === 'Failed' ? 'text-red-500' : 'text-emerald-500'
                                            }`}>
                                            {formatCurrency(goal.current_month_spend)}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${goal.current_month_status === 'Failed' ? 'bg-red-500' : 'bg-emerald-500'
                                                }`}
                                            style={{ width: `${Math.min(100, (goal.current_month_spend / goal.target_amount) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-center text-slate-400 mt-1">
                                        {goal.current_month_status === 'Failed'
                                            ? `Over budget by ${formatCurrency(goal.current_month_spend - goal.target_amount)}`
                                            : `${formatCurrency(goal.target_amount - goal.current_month_spend)} remaining`
                                        }
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Savings Goals Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Savings Goals</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {goals.length === 0 ? (
                        <div className="col-span-full text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <TargetIcon size={32} />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No goals yet</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-4">Create your first goal to start tracking your progress</p>
                            <button
                                onClick={() => setModalOpen(true)}
                                className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                            >
                                Create a goal
                            </button>
                        </div>
                    ) : (
                        goals.map(goal => {
                            const progress = Math.min(100, Math.max(0, (goal.current_amount / goal.target_amount) * 100));
                            const isCompleted = progress >= 100;
                            const daysLeft = goal.target_date
                                ? Math.ceil((new Date(goal.target_date) - new Date()) / (1000 * 60 * 60 * 24))
                                : null;

                            return (
                                <div
                                    key={goal.id}
                                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-between relative group cursor-pointer hover:shadow-md transition-shadow"
                                    onClick={() => setSelectedGoal(goal)}
                                >
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEditingGoal(goal); setModalOpen(true); }}
                                            className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                                        >
                                            <PencilIcon size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(goal.id); }}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                                        >
                                            <TrashIcon size={16} />
                                        </button>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCompleted
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                                }`}>
                                                {isCompleted ? <CheckCircleIcon size={24} /> : <TargetIcon size={24} />}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900 dark:text-white text-lg">{goal.name}</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Target: {formatCurrency(goal.target_amount)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm font-medium">
                                                <span className="text-slate-700 dark:text-slate-300">{formatCurrency(goal.current_amount)}</span>
                                                <span className="text-slate-500">{Math.round(progress)}%</span>
                                            </div>
                                            <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'
                                                        }`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                        {daysLeft !== null && !isCompleted ? (
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                                <CalendarIcon size={14} />
                                                {daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400">No deadline</div>
                                        )}
                                        <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                            <LineChartIcon size={12} />
                                            View Details
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <GoalModal
                isOpen={isModalOpen}
                onClose={() => { setModalOpen(false); setEditingGoal(null); }}
                goal={editingGoal}
                accounts={accounts}
                onSave={handleSave}
            />

            <GoalDetailsModal
                isOpen={!!selectedGoal}
                onClose={() => setSelectedGoal(null)}
                goal={selectedGoal}
            />

            <CategoryGoalModal
                isOpen={isCategoryModalOpen}
                onClose={() => setCategoryModalOpen(false)}
                accounts={accounts} // Not strictly needed but keeping prop signature simple? No, need buckets actually.
                // We need buckets here. Goals.jsx currently fetches accounts and goals but not buckets?
                // Let's check imports/state. We might need to fetch buckets.
                onSave={(data) => createCategoryGoalMutation.mutate(data)}
            />
        </div>
    );
}

// Simple Category Goal Modal
function CategoryGoalModal({ isOpen, onClose, onSave }) {
    const [bucketId, setBucketId] = useState('');
    const [targetAmount, setTargetAmount] = useState('');

    // Fetch buckets tree for grouped dropdown
    const { data: buckets = [] } = useQuery({
        queryKey: ['bucketsTree'],
        queryFn: getBucketsTree,
        enabled: isOpen
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            bucket_id: parseInt(bucketId),
            target_amount: targetAmount ? parseFloat(targetAmount) : null
        });
        setBucketId('');
        setTargetAmount('');
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6">
                    <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                        New Habit Goal
                    </Dialog.Title>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Category
                            </label>
                            <select
                                value={bucketId}
                                onChange={(e) => setBucketId(e.target.value)}
                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                required
                            >
                                <option value="">Select a category...</option>
                                {buckets.map(group => {
                                    // Filter out Income and Transfers for spending habits
                                    if (group.group === 'Income' || group.is_transfer) return null;

                                    if (group.children && group.children.length > 0) {
                                        return (
                                            <optgroup key={group.id} label={group.name} className="font-semibold text-slate-900 dark:text-slate-100">
                                                {group.children
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map(child => (
                                                        <option key={child.id} value={child.id} className="text-slate-700 dark:text-slate-300">
                                                            {child.name}
                                                        </option>
                                                    ))}
                                            </optgroup>
                                        );
                                    }

                                    // Standalone categories
                                    return (
                                        <option key={group.id} value={group.id} className="text-slate-700 dark:text-slate-300">
                                            {group.name}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Monthly Limit (Optional)
                            </label>
                            <input
                                type="number"
                                value={targetAmount}
                                onChange={(e) => setTargetAmount(e.target.value)}
                                placeholder="Leave empty to use Budget Limit"
                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!bucketId}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Start Habit
                            </button>
                        </div>
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
