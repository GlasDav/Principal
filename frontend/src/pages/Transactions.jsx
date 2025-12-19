import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getBuckets, getSettings, getGoals } from '../services/api';
import { Trash2, Search, Filter, Pencil, Split } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import SplitTransactionModal from '../components/SplitTransactionModal';

export default function Transactions() {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // URL Params
    const bucketIdParam = searchParams.get("bucket_id");
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    const [search, setSearch] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [splitModalOpen, setSplitModalOpen] = useState(false);
    const [transactionToSplit, setTransactionToSplit] = useState(null);

    // Fetch Transactions
    const { data: transactions = [], isLoading } = useQuery({
        queryKey: ['transactions', bucketIdParam, monthParam, yearParam],
        queryFn: async () => {
            const params = {};
            if (bucketIdParam) params.bucket_id = bucketIdParam;
            if (monthParam) params.month = monthParam;
            if (yearParam) params.year = yearParam;

            // Updated to use shared api client
            const res = await api.get('/transactions/', { params });
            return res.data;
        }
    });

    // Fetch Buckets
    const { data: buckets = [] } = useQuery({
        queryKey: ['buckets'],
        queryFn: getBuckets
    });

    // Fetch User Settings
    const { data: userSettings } = useQuery({
        queryKey: ['userSettings'],
        queryFn: getSettings
    });


    // Fetch Goals
    const { data: goals = [] } = useQuery({
        queryKey: ['goals'],
        queryFn: getGoals
    });

    // Update Transaction
    const updateMutation = useMutation({
        mutationFn: async ({ id, bucket_id, description, spender, goal_id }) => {
            const payload = {};
            if (bucket_id !== undefined) payload.bucket_id = bucket_id;
            if (description !== undefined) payload.description = description;
            if (spender !== undefined) payload.spender = spender;
            if (goal_id !== undefined) payload.goal_id = goal_id;

            await api.put(`/transactions/${id}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['transactions']);
        }
    });

    // Batch Delete
    const deleteBatchMutation = useMutation({
        mutationFn: async (ids) => {
            // Updated to use shared api client - implicitly sends Auth headers
            await api.post('/transactions/batch-delete', ids);
        },
        onSuccess: () => {
            setSelectedIds(new Set());
            queryClient.invalidateQueries(['transactions']);
        },
        onError: (err) => {
            alert(`Failed to delete: ${err.message}`);
        }
    });



    // Selection Handlers
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredTxns.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredTxns.map(t => t.id)));
        }
    };

    const toggleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const filteredTxns = transactions.filter(t =>
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        (t.bucket?.name || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-8" >
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Transactions</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Manage your complete transaction history.</p>
                </div>
                <div className="flex items-center gap-4">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={() => {
                                if (window.confirm(`Delete ${selectedIds.size} transactions?`)) {
                                    deleteBatchMutation.mutate(Array.from(selectedIds));
                                }
                            }}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition flex items-center gap-2"
                        >
                            <Trash2 size={16} />
                            Delete ({selectedIds.size})
                        </button>
                    )}
                    {bucketIdParam && (
                        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-sm font-medium">
                            <Filter size={14} />
                            <span>Filtered View</span>
                            <button
                                onClick={() => setSearchParams({})}
                                className="hover:text-red-500 ml-1"
                            >
                                ×
                            </button>
                        </div>
                    )}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </header>

            {/* Split Modal */}
            <SplitTransactionModal
                isOpen={splitModalOpen}
                onClose={() => setSplitModalOpen(false)
                }
                transaction={transactionToSplit}
                onSplitSuccess={() => {
                    queryClient.invalidateQueries(['transactions']);
                }}
            />

            < div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden" >
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="p-4 w-12">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={filteredTxns.length > 0 && selectedIds.size === filteredTxns.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400">Date</th>
                            <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400">Description</th>
                            <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400">Category</th>
                            <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400">Goal</th>
                            <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400">Who?</th>
                            <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {isLoading ? (
                            <tr><td colSpan="6" className="p-8 text-center text-slate-500">Loading...</td></tr>
                        ) : filteredTxns.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-slate-500">No transactions found.</td></tr>
                        ) : (
                            filteredTxns.map((txn) => (
                                <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition group">
                                    <td className="p-4">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={selectedIds.has(txn.id)}
                                            onChange={() => toggleSelect(txn.id)}
                                        />
                                    </td>
                                    <td className="p-4 text-sm text-slate-800 dark:text-slate-200 font-mono">
                                        {new Date(txn.date).toLocaleDateString('en-AU')}
                                    </td>
                                    <td className="p-4 text-sm text-slate-700 dark:text-slate-300 group/cell">
                                        {editingId === txn.id ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                defaultValue={txn.description}
                                                onBlur={(e) => {
                                                    updateMutation.mutate({ id: txn.id, description: e.target.value });
                                                    setEditingId(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                                className="w-full bg-slate-50 dark:bg-slate-700 border-0 rounded px-2 py-1 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setEditingId(txn.id)} title={`Original: ${txn.raw_description}`}>
                                                    <span className="font-medium text-slate-900 dark:text-white">{txn.description}</span>
                                                    <Pencil size={14} className="text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                                                </div>

                                                {/* Split Action */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setTransactionToSplit(txn); setSplitModalOpen(true); }}
                                                    className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-400 hover:text-indigo-500 transition"
                                                    title="Split Transaction"
                                                >
                                                    <Split size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <select
                                            className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-600 rounded px-2 py-1 text-sm text-slate-900 dark:text-white border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                            value={txn.bucket_id || ""}
                                            onChange={(e) => updateMutation.mutate({ id: txn.id, bucket_id: parseInt(e.target.value) })}
                                        >
                                            <option value="">Uncategorized</option>
                                            {buckets.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        <select
                                            className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-600 rounded px-2 py-1 text-sm text-slate-900 dark:text-white border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                            value={txn.goal_id || ""}
                                            onChange={(e) => updateMutation.mutate({ id: txn.id, goal_id: e.target.value ? parseInt(e.target.value) : null })}
                                        >
                                            <option value="">-</option>
                                            {goals.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        <select
                                            className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-600 rounded px-2 py-1 text-sm text-slate-900 dark:text-white border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                            value={txn.spender || "Joint"}
                                            onChange={(e) => updateMutation.mutate({ id: txn.id, spender: e.target.value })}
                                        >
                                            <option value="Joint">Joint</option>
                                            <option value="User A">{userSettings?.name_a || "User A"}</option>
                                            <option value="User B">{userSettings?.name_b || "User B"}</option>
                                        </select>
                                    </td>
                                    <td className={`p-4 text-sm font-semibold text-right ${txn.amount < 0 ? 'text-slate-900 dark:text-white' : 'text-green-600'}`}>
                                        {txn.amount.toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div >
        </div >
    );
}
