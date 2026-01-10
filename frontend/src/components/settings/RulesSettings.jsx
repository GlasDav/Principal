import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../services/api';
import RulesSection from '../RulesSection';
import { Lightbulb, Plus, Loader2, X, Edit2, Sparkles, History } from 'lucide-react';
import { API_BASE_URL } from '../../config';

const API_URL = API_BASE_URL;

// Fetch rule suggestions
const getRuleSuggestions = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/settings/rules/suggestions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch suggestions');
    return response.json();
};

const dismissSuggestion = async (keyword) => {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/settings/rules/suggestions/dismiss`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keyword })
    });
};

const dismissAllSuggestions = async (keywords) => {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/settings/rules/suggestions/dismiss-all`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keywords })
    });
};

const bulkCreateRules = async (rules) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/settings/rules/bulk-create`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(rules)
    });
    if (!res.ok) throw new Error('Failed to create rules');
    return res.json();
};

// Recursive category options renderer
const renderCategoryOptions = (nodes, level = 0) => {
    if (!nodes) return null;
    return nodes.map(node => (
        <React.Fragment key={node.id}>
            <option value={node.id}>
                {level > 0 ? '— '.repeat(level) : ''}{node.name}
            </option>
            {node.children && renderCategoryOptions(node.children, level + 1)}
        </React.Fragment>
    ));
};

// Edit Suggestion Modal Component
function EditSuggestionModal({ suggestion, buckets, treeBuckets, members, onClose, onSave, isPending }) {
    const [keywords, setKeywords] = useState(suggestion.keywords);
    const [bucketId, setBucketId] = useState(suggestion.suggested_bucket_id || '');
    const [priority, setPriority] = useState(10);
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [applyTags, setApplyTags] = useState('');
    const [markForReview, setMarkForReview] = useState(false);
    const [assignTo, setAssignTo] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!keywords.trim() || !bucketId) return;

        onSave({
            keywords: keywords.trim(),
            bucket_id: parseInt(bucketId),
            priority: 1000,
            min_amount: minAmount ? parseFloat(minAmount) : null,
            max_amount: maxAmount ? parseFloat(maxAmount) : null,
            apply_tags: applyTags.trim() || null,
            mark_for_review: markForReview,
            assign_to: assignTo || null
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card dark:bg-card-dark rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark">
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">Edit & Create Rule</h3>
                    <button onClick={onClose} className="p-1 hover:bg-surface dark:hover:bg-surface-dark rounded">
                        <X size={20} className="text-text-muted" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Suggestion info */}
                    <div className="bg-accent-warning/10 rounded-lg p-3 text-sm text-accent-warning">
                        <p className="font-medium">{suggestion.reason}</p>
                        <p className="text-xs mt-1 flex items-center gap-1">
                            {suggestion.source === 'categorized' ? (
                                <><History size={12} /> Based on your categorizations</>
                            ) : (
                                <><Sparkles size={12} /> Based on uncategorized patterns</>
                            )}
                        </p>
                    </div>

                    {/* Keywords */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">Keywords</label>
                        <input
                            type="text"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            placeholder="e.g. woolworths, uber"
                            className="w-full px-3 py-2 text-sm border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary outline-none"
                        />
                        <p className="text-xs text-text-muted mt-1">Edit to clean up or combine keywords</p>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">Category</label>
                        <select
                            value={bucketId}
                            onChange={(e) => setBucketId(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary outline-none"
                        >
                            <option value="">Select Category...</option>
                            {renderCategoryOptions(treeBuckets)}
                        </select>
                    </div>

                    {/* Amount Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">Min Amount $</label>
                            <input
                                type="number"
                                step="0.01"
                                value={minAmount}
                                onChange={(e) => setMinAmount(e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 text-sm border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">Max Amount $</label>
                            <input
                                type="number"
                                step="0.01"
                                value={maxAmount}
                                onChange={(e) => setMaxAmount(e.target.value)}
                                placeholder="∞"
                                className="w-full px-3 py-2 text-sm border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary outline-none"
                            />
                        </div>
                    </div>

                    {/* Priority & Tags */}
                    <div className="grid grid-cols-1 gap-4">

                        <div>
                            <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">Apply Tags</label>
                            <input
                                type="text"
                                value={applyTags}
                                onChange={(e) => setApplyTags(e.target.value)}
                                placeholder="e.g. Tax-Deductible"
                                className="w-full px-3 py-2 text-sm border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary outline-none"
                            />
                        </div>
                    </div>

                    {/* Assign To & Mark for Review */}
                    <div className="flex items-center gap-4">
                        {members.length > 0 && (
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">Assign To</label>
                                <select
                                    value={assignTo}
                                    onChange={(e) => setAssignTo(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary outline-none"
                                >
                                    <option value="">Unchanged</option>
                                    <option value="Joint">Joint</option>
                                    {members.map(m => (
                                        <option key={m.id} value={m.name}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pt-6">
                            <input
                                type="checkbox"
                                id="modalMarkForReview"
                                checked={markForReview}
                                onChange={(e) => setMarkForReview(e.target.checked)}
                                className="w-4 h-4 text-primary bg-input border-input rounded focus:ring-primary"
                            />
                            <label htmlFor="modalMarkForReview" className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Mark for Review
                            </label>
                        </div>
                    </div>

                    {/* Sample Transactions */}
                    {suggestion.sample_transactions?.length > 0 && (
                        <div className="pt-2">
                            <p className="text-xs font-medium text-text-muted mb-2">Sample Matches:</p>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                                {suggestion.sample_transactions.map((t, i) => (
                                    <div key={i} className="text-xs text-text-muted flex justify-between bg-surface dark:bg-surface-dark px-2 py-1 rounded">
                                        <span className="truncate">{t.description}</span>
                                        <span className="font-medium ml-2">${Math.abs(t.amount).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-border dark:border-border-dark">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-surface hover:bg-surface-hover dark:bg-surface-dark dark:hover:bg-surface-hover text-text-primary dark:text-text-primary-dark text-sm font-medium rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!keywords.trim() || !bucketId || isPending}
                            className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            Create Rule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function RulesSettings() {
    const queryClient = useQueryClient();
    const [editingSuggestion, setEditingSuggestion] = useState(null);

    // Queries
    const { data: userSettings, isLoading: sL } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
    const { data: buckets = [], isLoading: bL } = useQuery({ queryKey: ['buckets'], queryFn: api.getBucketsTree });
    const { data: allTags = [], isLoading: tL } = useQuery({ queryKey: ['tags'], queryFn: api.getTags });
    const { data: members = [], isLoading: mL } = useQuery({ queryKey: ['members'], queryFn: api.getMembers });
    const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
        queryKey: ['ruleSuggestions'],
        queryFn: getRuleSuggestions,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false
    });

    const isLoading = sL || bL || tL || mL;

    // Flatten logic
    const flatBuckets = useMemo(() => {
        const flatten = (nodes) => {
            let res = [];
            if (!nodes) return res;
            nodes.forEach(node => {
                res.push(node);
                if (node.children && node.children.length > 0) {
                    res = res.concat(flatten(node.children));
                }
            });
            return res;
        };
        return flatten(buckets);
    }, [buckets]);

    // Create rule mutation for accepting suggestions
    const createRuleMutation = useMutation({
        mutationFn: api.createRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            queryClient.invalidateQueries({ queryKey: ['ruleSuggestions'] });
            setEditingSuggestion(null);
        }
    });

    // Dismiss mutation
    const dismissMutation = useMutation({
        mutationFn: dismissSuggestion,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ruleSuggestions'] })
    });

    // Dismiss All mutation
    const dismissAllMutation = useMutation({
        mutationFn: dismissAllSuggestions,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ruleSuggestions'] })
    });

    // Bulk Create mutation
    const bulkCreateMutation = useMutation({
        mutationFn: bulkCreateRules,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            queryClient.invalidateQueries({ queryKey: ['ruleSuggestions'] });
            alert(`Successfully added ${data.created_count} rules.`);
        }
    });

    // Handlers
    const handleAddAll = () => {
        const validSuggestions = suggestions.filter(s => s.suggested_bucket_id);
        if (validSuggestions.length === 0) return;

        if (!window.confirm(`Add ${validSuggestions.length} rules?`)) return;

        const rulesPayload = validSuggestions.map(s => ({
            keywords: s.keywords,
            bucket_id: s.suggested_bucket_id,
            priority: 0,
            min_amount: null,
            max_amount: null,
            apply_tags: null,
            mark_for_review: false,
            assign_to: null
        }));
        bulkCreateMutation.mutate(rulesPayload);
    };

    const handleDismissAll = () => {
        if (!window.confirm("Dismiss all suggestions? They won't appear again.")) return;
        const keywords = suggestions.map(s => s.keywords);
        dismissAllMutation.mutate(keywords);
    };

    if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    const suggestions = suggestionsData?.suggestions || [];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-text-primary dark:text-text-primary-dark">Smart Rules</h3>
                <p className="text-sm text-text-muted mt-1">
                    Automatically categorize transactions based on keywords. Rules are applied when you click "Run Rules Now" or during import.
                </p>
            </div>

            <RulesSection buckets={flatBuckets} treeBuckets={buckets} members={members} />

            {/* Suggested Rules Section - Below Defined Rules */}
            {suggestions.length > 0 && (
                <div className="bg-gradient-to-r from-accent-warning/5 to-accent-warning/10 rounded-xl border border-accent-warning/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Lightbulb size={18} className="text-accent-warning" />
                            <h4 className="font-medium text-text-primary dark:text-text-primary-dark">Suggested Rules</h4>
                            <span className="text-xs bg-accent-warning/20 text-text-primary dark:text-text-primary-dark px-2 py-0.5 rounded-full">{suggestions.length}</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleDismissAll}
                                disabled={dismissAllMutation.isPending}
                                className="text-xs px-2 py-1 bg-surface/50 dark:bg-black/20 hover:bg-accent-error/10 text-text-muted hover:text-accent-error rounded transition"
                            >
                                Dismiss All
                            </button>
                            <button
                                onClick={handleAddAll}
                                disabled={bulkCreateMutation.isPending}
                                className="text-xs px-2 py-1 bg-surface/50 dark:bg-black/20 hover:bg-accent-success/10 text-primary hover:text-accent-success rounded transition font-medium"
                            >
                                Add All
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-accent-warning mb-3">
                        Based on patterns in your transactions. Click to edit, or Add All to fast-track.
                    </p>
                    <div className="space-y-2">
                        {suggestions.map((suggestion, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-card dark:bg-card-dark rounded-lg p-3 border border-border dark:border-border-dark">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-medium text-text-primary dark:text-text-primary-dark">{suggestion.keywords}</span>
                                        <span className="text-text-muted">→</span>
                                        <span className="text-sm text-primary">{suggestion.suggested_category}</span>
                                        {suggestion.source === 'categorized' && (
                                            <span className="text-xs bg-accent-success/10 text-accent-success px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <History size={10} /> Your pattern
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-text-muted mt-1">{suggestion.reason}</p>
                                </div>
                                <button
                                    onClick={() => setEditingSuggestion(suggestion)}
                                    className="ml-4 flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-medium rounded-lg transition"
                                >
                                    <Edit2 size={14} />
                                    Edit & Add
                                </button>
                                <button
                                    onClick={() => dismissMutation.mutate(suggestion.keywords)}
                                    title="Dismiss suggestion"
                                    className="ml-2 p-1.5 hover:bg-surface dark:hover:bg-surface-dark text-text-muted hover:text-accent-error rounded transition"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {suggestionsLoading && (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing transaction patterns...
                </div>
            )}

            {/* Edit Suggestion Modal */}
            {editingSuggestion && (
                <EditSuggestionModal
                    suggestion={editingSuggestion}
                    buckets={flatBuckets}
                    treeBuckets={buckets}
                    members={members}
                    onClose={() => setEditingSuggestion(null)}
                    onSave={(ruleData) => createRuleMutation.mutate(ruleData)}
                    isPending={createRuleMutation.isPending}
                />
            )}
        </div>
    );
}
