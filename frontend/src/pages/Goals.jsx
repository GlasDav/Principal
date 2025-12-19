import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, Pencil, CheckCircle, TrendingUp, Building, Wallet, Trash2 } from 'lucide-react';
import api, { getGoals, createGoal, updateGoal, deleteGoal } from '../services/api';
import { Dialog } from '@headlessui/react';

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
    const availableAccounts = accounts.filter(a => a.type === 'Asset');

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

export default function Goals() {
    const queryClient = useQueryClient();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);

    // Fetch Goals
    const { data: goals = [], isLoading: goalsLoading } = useQuery({
        queryKey: ['goals'],
        queryFn: getGoals
    });

    // Fetch Accounts for linking dropdown
    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await api.get('/net-worth/accounts')).data
    });

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
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Target className="text-indigo-600" />
                        Savings Goals
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        Track progress towards your financial objectives.
                    </p>
                </div>
                <button
                    onClick={() => { setEditingGoal(null); setModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm"
                >
                    <Plus size={20} />
                    New Goal
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {goals.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                        <Target size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Goals Yet</h3>
                        <p className="max-w-md mx-auto mt-2 mb-6">Create a goal to track savings for a vacation, emergency fund, or big purchase.</p>
                        <button
                            onClick={() => { setEditingGoal(null); setModalOpen(true); }}
                            className="text-indigo-600 font-medium hover:underline"
                        >
                            Create your first goal
                        </button>
                    </div>
                ) : (
                    goals.map(goal => {
                        const progress = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
                        const isCompleted = progress >= 100;
                        const isLinked = !!goal.linked_account_id;

                        return (
                            <div key={goal.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-between relative group">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button
                                        onClick={() => deleteMutation.mutate(goal.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => { setEditingGoal(goal); setModalOpen(true); }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                </div>

                                <div>
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className={`p-3 rounded-xl ${isCompleted ? 'bg-green-100 text-green-600' : 'bg-indigo-50 text-indigo-600'} dark:bg-slate-700 dark:text-white`}>
                                            {isLinked ? <Building size={24} /> : <Wallet size={24} />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">{goal.name}</h3>
                                            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider flex items-center gap-1">
                                                {isLinked ? "Account Goal" : "Manual Goal"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mb-2 flex justify-between items-end">
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                            ${goal.current_amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </div>
                                        <div className="text-sm font-medium text-slate-500 mb-1">
                                            of ${goal.target_amount.toLocaleString()}
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-green-500' : 'bg-indigo-600'}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="mt-2 flex justify-between items-center">
                                        <span className="text-xs text-slate-400">{goal.target_date ? `Deadline: ${new Date(goal.target_date).toLocaleDateString('en-AU')}` : "No deadline"}</span>
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                            {progress.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <GoalModal
                isOpen={isModalOpen}
                onClose={() => { setModalOpen(false); setEditingGoal(null); }}
                goal={editingGoal}
                accounts={accounts}
                onSave={handleSave}
            />
        </div>
    );
}
