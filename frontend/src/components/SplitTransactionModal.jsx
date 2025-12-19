import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../services/api';

export default function SplitTransactionModal({ isOpen, onClose, transaction, onSplitSuccess }) {
    const [splits, setSplits] = useState([]);
    const [error, setError] = useState(null);

    // Load Buckets
    const { data: buckets = [] } = useQuery({
        queryKey: ['buckets'],
        queryFn: api.getBuckets
    });

    // Initialize splits when transaction opens
    useEffect(() => {
        if (transaction) {
            setSplits([
                { description: transaction.description, amount: transaction.amount, bucket_id: transaction.bucket_id || '' },
                { description: '', amount: 0, bucket_id: '' }
            ]);
            setError(null);
        }
    }, [transaction]);

    const handleAddRow = () => {
        setSplits([...splits, { description: '', amount: 0, bucket_id: '' }]);
    };

    const handleRemoveRow = (index) => {
        const newSplits = [...splits];
        newSplits.splice(index, 1);
        setSplits(newSplits);
    };

    const handleChange = (index, field, value) => {
        const newSplits = [...splits];
        newSplits[index][field] = value;
        setSplits(newSplits);
    };

    const totalSplit = splits.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const originalAmount = transaction ? transaction.amount : 0;
    const remaining = originalAmount - totalSplit;

    // Check if balanced (allow small float diff)
    const isBalanced = Math.abs(remaining) < 0.01;

    const handleSubmit = async () => {
        if (!isBalanced) {
            setError(`Total must match original amount ($${originalAmount.toFixed(2)}). Remaining: $${remaining.toFixed(2)}`);
            return;
        }

        try {
            await api.splitTransaction(transaction.id, splits);
            onSplitSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || "Failed to split transaction");
        }
    };

    if (!isOpen || !transaction) return null;

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <div>
                            <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">Split Transaction</Dialog.Title>
                            <p className="text-sm text-slate-500">Original: {transaction.description} (${originalAmount.toFixed(2)})</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-slate-500 px-2">
                            <div className="col-span-4">Description</div>
                            <div className="col-span-4">Category</div>
                            <div className="col-span-3">Amount</div>
                            <div className="col-span-1"></div>
                        </div>

                        {/* Rows */}
                        <div className="space-y-3">
                            {splits.map((split, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-4">
                                        <input
                                            type="text"
                                            value={split.description}
                                            onChange={(e) => handleChange(idx, 'description', e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm"
                                            placeholder="Description"
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <select
                                            value={split.bucket_id}
                                            onChange={(e) => handleChange(idx, 'bucket_id', e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm"
                                        >
                                            <option value="">Select Category...</option>
                                            {buckets.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={split.amount}
                                            onChange={(e) => handleChange(idx, 'amount', parseFloat(e.target.value))}
                                            className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm ${totalSplit !== originalAmount ? 'border-amber-300' : 'border-slate-200 dark:border-slate-600'}`}
                                        />
                                    </div>
                                    <div className="col-span-1 text-center">
                                        {splits.length > 2 && (
                                            <button onClick={() => handleRemoveRow(idx)} className="text-slate-400 hover:text-red-500">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button onClick={handleAddRow} className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 px-2 mt-2">
                            <Plus size={16} />
                            Add Split
                        </button>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-700/30 flex justify-between items-center">
                        <div className={`text-sm font-medium ${isBalanced ? 'text-green-600' : 'text-amber-600'} flex items-center gap-2`}>
                            {!isBalanced && <AlertCircle size={16} />}
                            {isBalanced ? "Balanced" : `Remaining: $${remaining.toFixed(2)}`}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition">
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!isBalanced}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition shadow-sm ${isBalanced ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 cursor-not-allowed'}`}
                            >
                                Split Transaction
                            </button>
                        </div>
                    </div>
                    {error && (
                        <div className="px-6 pb-4 text-sm text-red-500 text-center">
                            {error}
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
