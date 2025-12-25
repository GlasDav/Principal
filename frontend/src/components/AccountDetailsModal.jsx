import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Save, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import HoldingsTable from './HoldingsTable';

/**
 * AccountDetailsModal - Shows details for an account.
 * For Investment accounts, displays the HoldingsTable component.
 * For other accounts, allows editing specific details.
 */
const AccountDetailsModal = ({ isOpen, onClose, account }) => {
    const queryClient = useQueryClient();
    const isInvestment = account?.category === 'Investment';

    // Local state for editing
    const [name, setName] = useState('');
    const [balance, setBalance] = useState('');

    useEffect(() => {
        if (account) {
            setName(account.name || '');
            // For investment accounts, balance is derived, so we might not want to edit it directly here?
            // Actually, for manual accounts it is useful.
            setBalance(account.balance?.toString() || '0');
        }
    }, [account]);

    const updateAccountMutation = useMutation({
        mutationFn: async (data) => {
            await api.put(`/net-worth/accounts/${account.id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['accounts']);
            queryClient.invalidateQueries(['netWorthHistory']);
            onClose();
        }
    });

    const deleteAccountMutation = useMutation({
        mutationFn: async () => {
            await api.delete(`/net-worth/accounts/${account.id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['accounts']);
            queryClient.invalidateQueries(['netWorthHistory']);
            onClose();
        }
    });

    const handleSave = () => {
        updateAccountMutation.mutate({
            name,
            type: account.type, // Required by schema
            category: account.category, // Required by schema
            is_active: account.is_active !== undefined ? account.is_active : true,
            balance: parseFloat(balance) || 0
        });
    };

    const handleDelete = () => {
        if (confirm(`Are you sure you want to delete "${account.name}"? This action cannot be undone.`)) {
            deleteAccountMutation.mutate();
        }
    };

    if (!isOpen || !account) return null;

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start">
                        <div>
                            <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white">
                                {account.name}
                            </Dialog.Title>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{account.category} Details</p>
                        </div>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-6">
                        {!isInvestment ? (
                            <div className="max-w-lg mx-auto space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Account Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Balance ($)</label>
                                    <input
                                        type="number"
                                        value={balance}
                                        onChange={(e) => setBalance(e.target.value)}
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="pt-4 flex items-center justify-between">
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleteAccountMutation.isPending}
                                        className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                    >
                                        <Trash2 size={16} />
                                        Delete Account
                                    </button>

                                    <button
                                        onClick={handleSave}
                                        disabled={updateAccountMutation.isPending}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2 transition disabled:opacity-50"
                                    >
                                        <Save size={18} />
                                        {updateAccountMutation.isPending ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <HoldingsTable accountId={account.id} />
                        )}
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

export default AccountDetailsModal;
