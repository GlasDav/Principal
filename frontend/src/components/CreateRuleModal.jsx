import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, BookPlus, Loader2, Eye, AlertCircle } from 'lucide-react';
import { createRule } from '../services/api';
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

// API call for preview
const previewRule = async ({ keywords, min_amount, max_amount }) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/settings/rules/preview`, {
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
export default function CreateRuleModal({ isOpen, onClose, transaction, buckets, members = [] }) {
    const queryClient = useQueryClient();
    const [keyword, setKeyword] = useState(transaction?.description || '');
    const [bucketId, setBucketId] = useState(transaction?.bucket_id || '');
    const [priority, setPriority] = useState(0);
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [applyTags, setApplyTags] = useState('');
    const [markForReview, setMarkForReview] = useState(false);
    const [assignTo, setAssignTo] = useState('');  // Family member to assign
    const [error, setError] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    // Preview state (simplified)
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);

    // Reset form when transaction changes
    useEffect(() => {
        if (transaction) {
            setKeyword(transaction.description || '');
            setBucketId(transaction.bucket_id || '');
            setPriority(0);
            setMinAmount('');
            setMaxAmount('');
            setApplyTags('');
            setMarkForReview(false);
            setAssignTo(transaction.spender || '');
            setError('');
            setShowPreview(false);
            setPreviewData(null);
            setPreviewError(null);
        }
    }, [transaction]);

    const createRuleMutation = useMutation({
        mutationFn: createRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            onClose();
        },
        onError: (err) => {
            setError(err.message || 'Failed to create rule');
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
            priority: parseInt(priority) || 0,
            min_amount: minAmount ? parseFloat(minAmount) : null,
            max_amount: maxAmount ? parseFloat(maxAmount) : null,
            apply_tags: applyTags.trim() || null,
            mark_for_review: markForReview,
            assign_to: assignTo || null
        });
    };

    const handlePreview = async () => {
        if (!keyword.trim()) return;
        setShowPreview(true);
        setPreviewLoading(true);
        setPreviewError(null);
        try {
            const data = await previewRule({
                keywords: keyword,
                min_amount: minAmount ? parseFloat(minAmount) : null,
                max_amount: maxAmount ? parseFloat(maxAmount) : null
            });
            setPreviewData(data);
        } catch (err) {
            setPreviewError('Failed to load preview');
            console.error('Preview error:', err);
        } finally {
            setPreviewLoading(false);
        }
    };

    // ...

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
                            {previewLoading && (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Loader2 className="animate-spin" size={14} />
                                    Loading preview...
                                </div>
                            )}
                            {previewError && (
                                <p className="text-sm text-red-500">{previewError}</p>
                            )}
                            {previewData && (
                                <div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                        <strong>{previewData.match_count}</strong> existing transactions would match this rule
                                    </p>
                                    {previewData.sample_transactions?.length > 0 && (
                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                            {previewData.sample_transactions.slice(0, 5).map((t, i) => (
                                                <div key={i} className="text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                                                    <span className="truncate flex-1">{t.description}</span>
                                                    <span className="ml-2 font-medium">${Math.abs(t.amount).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {previewData.match_count > 5 && (
                                                <p className="text-xs text-slate-400 italic">
                                                    ...and {previewData.match_count - 5} more
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {previewData.match_count === 0 && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            No existing transactions match. This rule will apply to future imports.
                                        </p>
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

                    {/* Amount Range (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Amount range (optional)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={minAmount}
                                onChange={(e) => { setMinAmount(e.target.value); setShowPreview(false); }}
                                placeholder="Min"
                                step="0.01"
                                className="w-28 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <span className="text-slate-400">—</span>
                            <input
                                type="number"
                                value={maxAmount}
                                onChange={(e) => { setMaxAmount(e.target.value); setShowPreview(false); }}
                                placeholder="Max"
                                step="0.01"
                                className="w-28 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Apply Tags (optional)
                        </label>
                        <input
                            type="text"
                            value={applyTags}
                            onChange={(e) => setApplyTags(e.target.value)}
                            placeholder="e.g. Tax-Deductible, Reimbursement"
                            className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Comma separated tags to add to matched transactions
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="markForReview"
                            checked={markForReview}
                            onChange={(e) => setMarkForReview(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 bg-slate-100 border-slate-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                        />
                        <label htmlFor="markForReview" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Mark for Review
                        </label>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 ml-6 -mt-3">
                        Transactions will be categorized but not marked as verified
                    </p>

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

                    {members.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Assign to member (optional)
                            </label>
                            <select
                                value={assignTo}
                                onChange={(e) => setAssignTo(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="">Joint (default)</option>
                                {members.map(member => (
                                    <option key={member.id} value={member.name}>{member.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Matched transactions will be assigned to this member
                            </p>
                        </div>
                    )}

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
