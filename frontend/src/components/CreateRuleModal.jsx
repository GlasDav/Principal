import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, BookPlus, Loader2, Eye, AlertCircle } from 'lucide-react';
import { createRule } from '../services/api';

// API call for preview
const previewRule = async ({ keywords, min_amount, max_amount }) => {
    const token = localStorage.getItem('access_token');
    const response = await fetch('/settings/rules/preview', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ keywords, min_amount, max_amount })
    });
    if (!response.ok) throw new Error('Preview failed');
    return response.json();
};

/**
 * Modal to create a Smart Rule from a transaction.
 * Pre-populates keyword from transaction description.
 * Includes preview of matching transactions.
 */
export default function CreateRuleModal({ isOpen, onClose, transaction, buckets }) {
    const queryClient = useQueryClient();
    const [keyword, setKeyword] = useState(transaction?.description || '');
    const [bucketId, setBucketId] = useState(transaction?.bucket_id || '');
    const [priority, setPriority] = useState(0);
    const [error, setError] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    // Reset form when transaction changes
    useEffect(() => {
        if (transaction) {
            setKeyword(transaction.description || '');
            setBucketId(transaction.bucket_id || '');
            setPriority(0);
            setError('');
            setShowPreview(false);
        }
    }, [transaction]);

    // Preview query - only runs when showPreview is true
    const previewQuery = useQuery({
        queryKey: ['rulePreview', keyword],
        queryFn: () => previewRule({ keywords: keyword.trim().toLowerCase() }),
        enabled: showPreview && keyword.trim().length > 0,
        staleTime: 30000,
    });

    const createRuleMutation = useMutation({
        mutationFn: createRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            onClose();
        },
        onError: (err) => {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Failed to create rule');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!keyword.trim() || !bucketId) {
            setError('Please enter a keyword and select a category');
            return;
        }
        createRuleMutation.mutate({
            keywords: keyword.trim().toLowerCase(),
            bucket_id: parseInt(bucketId),
            priority: parseInt(priority) || 0
        });
    };

    const handlePreview = () => {
        if (keyword.trim()) {
            setShowPreview(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <BookPlus className="text-indigo-500" size={20} />
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Smart Rule</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4 flex-1 overflow-y-auto">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Keyword to match
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => { setKeyword(e.target.value); setShowPreview(false); }}
                                placeholder="e.g. woolworths, netflix, uber"
                                className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <button
                                type="button"
                                onClick={handlePreview}
                                disabled={!keyword.trim()}
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition flex items-center gap-1 disabled:opacity-50"
                                title="Preview matching transactions"
                            >
                                <Eye size={16} />
                                Preview
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Future transactions containing this keyword will auto-categorize
                        </p>
                    </div>

                    {/* Preview Results */}
                    {showPreview && (
                        <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 bg-slate-50 dark:bg-slate-700/50">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle size={16} className="text-indigo-500" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Preview: Matching Transactions
                                </span>
                            </div>
                            {previewQuery.isLoading && (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Loader2 className="animate-spin" size={14} />
                                    Loading preview...
                                </div>
                            )}
                            {previewQuery.isError && (
                                <p className="text-sm text-red-500">Failed to load preview</p>
                            )}
                            {previewQuery.isSuccess && (
                                <div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                        <strong>{previewQuery.data.matching_count}</strong> existing transactions would match this rule
                                    </p>
                                    {previewQuery.data.transactions?.length > 0 && (
                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                            {previewQuery.data.transactions.slice(0, 5).map((t, i) => (
                                                <div key={i} className="text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                                                    <span className="truncate flex-1">{t.description}</span>
                                                    <span className="ml-2 font-medium">${Math.abs(t.amount).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {previewQuery.data.matching_count > 5 && (
                                                <p className="text-xs text-slate-400 italic">
                                                    ...and {previewQuery.data.matching_count - 5} more
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Assign to category
                        </label>
                        <select
                            value={bucketId}
                            onChange={(e) => setBucketId(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="">Select a category...</option>
                            {buckets?.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Priority (optional)
                        </label>
                        <input
                            type="number"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            placeholder="0"
                            className="w-24 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Higher priority rules are applied first
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createRuleMutation.isPending}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {createRuleMutation.isPending ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <BookPlus size={16} />
                                    Create Rule
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

