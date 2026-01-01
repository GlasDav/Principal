import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../services/api';
import RulesSection from '../RulesSection';
import { Lightbulb, Plus, Loader2 } from 'lucide-react';
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

export default function RulesSettings() {
    const queryClient = useQueryClient();

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
        }
    });

    if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

    const suggestions = suggestionsData?.suggestions || [];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-slate-800 dark:text-white">Smart Rules</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Automatically categorize transactions based on keywords. Rules are applied when you click "Run Rules Now" or during import.
                </p>
            </div>

            {/* Suggested Rules Section */}
            {suggestions.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl border border-amber-200 dark:border-amber-700 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Lightbulb size={18} className="text-amber-600 dark:text-amber-400" />
                        <h4 className="font-medium text-amber-800 dark:text-amber-300">Suggested Rules</h4>
                        <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">{suggestions.length}</span>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                        Based on patterns in your uncategorized transactions
                    </p>
                    <div className="space-y-2">
                        {suggestions.map((suggestion, idx) => {
                            const bucket = flatBuckets.find(b => b.name.toLowerCase() === suggestion.suggested_category.toLowerCase());
                            return (
                                <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg p-3 border border-amber-100 dark:border-slate-700">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200">{suggestion.keywords}</span>
                                            <span className="text-slate-400">→</span>
                                            <span className="text-sm text-indigo-600 dark:text-indigo-400">{suggestion.suggested_category}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{suggestion.reason}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (bucket) {
                                                createRuleMutation.mutate({
                                                    keywords: suggestion.keywords,
                                                    bucket_id: bucket.id,
                                                    priority: 0
                                                });
                                            }
                                        }}
                                        disabled={!bucket || createRuleMutation.isPending}
                                        className="ml-4 flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={bucket ? "Create this rule" : "Category not found"}
                                    >
                                        <Plus size={14} />
                                        Add Rule
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {suggestionsLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing transaction patterns...
                </div>
            )}

            <RulesSection buckets={flatBuckets} />
        </div>
    );
}
