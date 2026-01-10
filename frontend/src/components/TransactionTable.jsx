import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Loader2, Search, FileText, ChevronDown } from 'lucide-react';

export default function TransactionTable({ params = {} }) {
    const [page, setPage] = useState(0);
    const limit = 50;

    const { data, isLoading } = useQuery({
        queryKey: ['transactions', params, page],
        queryFn: async () => {
            const res = await api.get('/transactions', {
                params: {
                    ...params,
                    skip: page * limit,
                    limit: limit
                }
            });
            return res.data;
        }
    });

    const transactions = data?.items || [];
    const total = data?.total || 0;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-slate-500">Loading transactions...</p>
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="text-center py-20 px-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">No transactions found</h3>
                <p className="text-slate-500">No transactions match the selected filters for this period.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Spender</th>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {transactions.map((txn) => (
                            <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono">
                                    {new Date(txn.date).toLocaleDateString('en-AU')}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white truncate max-w-md">
                                    {txn.description}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        {txn.bucket?.name || 'Uncategorized'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                    {txn.spender}
                                </td>
                                <td className={`px-4 py-3 text-sm font-bold text-right ${txn.amount < 0 ? 'text-slate-900 dark:text-white' : 'text-emerald-500'}`}>
                                    {formatCurrency(txn.amount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Placeholder */}
            {total > limit && (
                <div className="flex justify-between items-center px-2">
                    <p className="text-xs text-slate-500">Showing {transactions.length} of {total} transactions</p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 disabled:opacity-50 text-slate-600"
                        >
                            Previous
                        </button>
                        <button
                            disabled={(page + 1) * limit >= total}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 disabled:opacity-50 text-slate-600"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
