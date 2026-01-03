import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Tag as TagIcon, Trash2, Play, Eye, Loader2, GripVertical, AlertCircle } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as api from '../services/api';
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

// Direct fetch for preview (not in api.js yet)
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

const cleanKeywords = (str) => {
    if (!str) return "";
    return [...new Set(str.split(',').map(k => k.trim()).filter(k => k))].join(', ');
};

// Helper to render hierarchical category options
const renderCategoryOptions = (treeBuckets) => {
    if (!treeBuckets || treeBuckets.length === 0) return null;

    return treeBuckets.map(parent => {
        // Skip the Income parent category itself but show its children
        if (parent.name === 'Income' && parent.group === 'Income') {
            // Render children directly with Income label
            if (parent.children && parent.children.length > 0) {
                return (
                    <optgroup key={parent.id} label="Income">
                        {parent.children.sort((a, b) => a.name.localeCompare(b.name)).map(child => (
                            <option key={child.id} value={child.id}>{child.name}</option>
                        ))}
                    </optgroup>
                );
            }
            return null;
        }

        // For parents with children, render as optgroup
        if (parent.children && parent.children.length > 0) {
            return (
                <optgroup key={parent.id} label={parent.name}>
                    {parent.children.sort((a, b) => a.name.localeCompare(b.name)).map(child => (
                        <option key={child.id} value={child.id}>
                            {child.name}
                        </option>
                    ))}
                </optgroup>
            );
        }

        // For leaf categories (no children), render as plain option
        return <option key={parent.id} value={parent.id}>{parent.name}</option>;
    });
};

const RunRulesModal = ({ onClose, onConfirm, isPending }) => {
    const [overwrite, setOverwrite] = useState(false);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">Run Categorization Rules</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    This will apply your rules to existing transactions.
                </p>

                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            id="overwrite"
                            checked={overwrite}
                            onChange={(e) => setOverwrite(e.target.checked)}
                            className="mt-1 w-4 h-4 text-indigo-600 rounded"
                        />
                        <div>
                            <label htmlFor="overwrite" className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                                Overwrite verified transactions?
                            </label>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                If checked, this will <strong>overwrite manual categorizations</strong> if they match a rule. Use with caution.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(overwrite)}
                        disabled={isPending}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        Run Rules
                    </button>
                </div>
            </div>
        </div>
    );
};

const SortableRuleItem = (props) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: props.rule.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="touch-none">
            <RuleItem {...props} dragHandleProps={{ ...attributes, ...listeners }} />
        </div>
    );
};

const RuleItem = ({ rule, buckets, treeBuckets, members = [], updateRuleMutation, deleteRuleMutation, isSelected, onToggleSelect, dragHandleProps }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localKeywords, setLocalKeywords] = useState(rule.keywords);
    const [localBucketId, setLocalBucketId] = useState(rule.bucket_id);

    const [localMinAmount, setLocalMinAmount] = useState(rule.min_amount || '');
    const [localMaxAmount, setLocalMaxAmount] = useState(rule.max_amount || '');
    const [localApplyTags, setLocalApplyTags] = useState(rule.apply_tags || '');
    const [localMarkForReview, setLocalMarkForReview] = useState(rule.mark_for_review || false);
    const [localAssignTo, setLocalAssignTo] = useState(rule.assign_to || '');

    useEffect(() => {
        if (!isEditing) {
            setLocalKeywords(rule.keywords);
            setLocalBucketId(rule.bucket_id);

            setLocalMinAmount(rule.min_amount || '');
            setLocalMaxAmount(rule.max_amount || '');
            setLocalApplyTags(rule.apply_tags || '');
            setLocalMarkForReview(rule.mark_for_review || false);
            setLocalAssignTo(rule.assign_to || '');
        }
    }, [isEditing, rule]);

    const handleSave = () => {
        if (!localKeywords || !localBucketId) return;
        updateRuleMutation.mutate({
            id: rule.id,
            data: {
                keywords: cleanKeywords(localKeywords),
                bucket_id: parseInt(localBucketId),
                priority: rule.priority, // Keep existing priority/order
                min_amount: localMinAmount ? parseFloat(localMinAmount) : null,
                max_amount: localMaxAmount ? parseFloat(localMaxAmount) : null,
                apply_tags: localApplyTags.trim() || null,
                mark_for_review: localMarkForReview,
                assign_to: localAssignTo || null
            }
        });
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="p-4 bg-indigo-50 dark:bg-slate-900 border-b border-indigo-100 dark:border-slate-700 space-y-3">
                {/* Row 1: Keywords, Category, Priority */}
                <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1" />
                    <div className="col-span-5">
                        <input
                            className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-white"
                            value={localKeywords}
                            onChange={(e) => setLocalKeywords(e.target.value)}
                            placeholder="Keywords"
                        />
                    </div>
                    <div className="col-span-4">
                        <select
                            className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-white"
                            value={localBucketId || ""}
                            onChange={(e) => setLocalBucketId(e.target.value)}
                        >
                            <option value="">Select Category...</option>
                            {renderCategoryOptions(treeBuckets)}
                        </select>
                    </div>

                </div>
                {/* Row 2: Amount Range, Tags, Assign To, Mark for Review */}
                <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1" />
                    <div className="col-span-2 flex items-center gap-1">
                        <input
                            type="number"
                            step="0.01"
                            className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-white"
                            value={localMinAmount}
                            onChange={(e) => setLocalMinAmount(e.target.value)}
                            placeholder="Min $"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="number"
                            step="0.01"
                            className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-white"
                            value={localMaxAmount}
                            onChange={(e) => setLocalMaxAmount(e.target.value)}
                            placeholder="Max $"
                        />
                    </div>
                    <div className="col-span-3">
                        <input
                            className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-white"
                            value={localApplyTags}
                            onChange={(e) => setLocalApplyTags(e.target.value)}
                            placeholder="Apply Tags"
                        />
                    </div>
                    {members.length > 0 && (
                        <div className="col-span-2">
                            <select
                                className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-white"
                                value={localAssignTo}
                                onChange={(e) => setLocalAssignTo(e.target.value)}
                            >
                                <option value="">Unchanged</option>
                                <option value="Joint">Joint</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.name}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="col-span-2 flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={localMarkForReview}
                            onChange={(e) => setLocalMarkForReview(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <span className="text-xs text-slate-500">Review</span>
                    </div>
                    <div className={`${members.length > 0 ? 'col-span-2' : 'col-span-4'} flex justify-end gap-1`}>
                        <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-100 rounded">
                            <Save size={16} />
                        </button>
                        <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                            <TagIcon size={16} className="rotate-45" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition group border-l-2 border-transparent hover:border-indigo-500">
            <div className="col-span-1 flex items-center">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
            </div>
            <div className="col-span-5 truncate font-medium text-slate-800 dark:text-slate-200 text-sm group-hover:text-indigo-600 transition-colors cursor-pointer" title={rule.keywords} onClick={() => setIsEditing(true)}>
                {rule.keywords}
                {/* Show indicators for additional settings */}
                {(rule.min_amount || rule.max_amount) && (
                    <span className="ml-2 text-xs text-slate-400 font-normal">
                        ${rule.min_amount || 0}-${rule.max_amount || '∞'}
                    </span>
                )}
            </div>
            <div className="col-span-4 truncate text-sm text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-2">
                {buckets?.find(b => b.id === rule.bucket_id)?.name || "Unknown Bucket"}
                {rule.assign_to && (
                    <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">{rule.assign_to}</span>
                )}
                {rule.mark_for_review && (
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded">Review</span>
                )}
            </div>
            <div className="col-span-2 flex justify-end items-center gap-3">
                <span
                    className="text-slate-400 cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded touch-none"
                    {...dragHandleProps}
                >
                    <GripVertical size={16} />
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); deleteRuleMutation.mutate(rule.id); }}
                    className="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
};

export default function RulesSection({ buckets, treeBuckets, members = [] }) {
    const queryClient = useQueryClient();
    const [keyword, setKeyword] = useState("");
    const [bucketId, setBucketId] = useState("");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");
    const [applyTags, setApplyTags] = useState("");
    const [markForReview, setMarkForReview] = useState(false);
    const [assignTo, setAssignTo] = useState("");
    const [runResult, setRunResult] = useState(null);
    const [selectedRules, setSelectedRules] = useState(new Set());

    // Preview state
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);

    const { data: rules } = useQuery({
        queryKey: ['rules'],
        queryFn: api.getRules
    });

    const createRuleMutation = useMutation({
        mutationFn: api.createRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            setKeyword("");
            setBucketId("");
        }
    });

    const updateRuleMutation = useMutation({
        mutationFn: ({ id, data }) => api.updateRule(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] })
    });

    const deleteRuleMutation = useMutation({
        mutationFn: api.deleteRule,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] })
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: api.bulkDeleteRules,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            setSelectedRules(new Set());
        }
    });

    const [showRunModal, setShowRunModal] = useState(false);

    const runRulesMutation = useMutation({
        mutationFn: (overwrite) => api.runRules(overwrite),
        onSuccess: (data) => {
            setRunResult(`Successfully categorized ${data.count} transactions.`);
            setTimeout(() => setRunResult(null), 5000);
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            setShowRunModal(false);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!keyword || !bucketId) return;
        createRuleMutation.mutate({
            keywords: cleanKeywords(keyword),
            bucket_id: parseInt(bucketId),
            priority: 1000, // Default to top priority
            min_amount: minAmount ? parseFloat(minAmount) : null,
            max_amount: maxAmount ? parseFloat(maxAmount) : null,
            apply_tags: applyTags.trim() || null,
            mark_for_review: markForReview,
            assign_to: assignTo || null
        });
        setPreviewData(null);
        // Reset additional fields
        setMinAmount("");
        setMaxAmount("");
        setApplyTags("");
        setMarkForReview(false);
        setAssignTo("");
    };

    const handlePreview = async () => {
        if (!keyword.trim()) return;
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
        } finally {
            setPreviewLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedRules.size === rules?.length) {
            setSelectedRules(new Set());
        } else {
            setSelectedRules(new Set(rules?.map(r => r.id) || []));
        }
    };

    const toggleSelectRule = (id) => {
        const newSelected = new Set(selectedRules);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRules(newSelected);
    };

    const handleBulkDelete = () => {
        if (selectedRules.size === 0) return;
        if (confirm(`Delete ${selectedRules.size} rule(s)?`)) {
            bulkDeleteMutation.mutate([...selectedRules]);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = rules.findIndex((r) => r.id === active.id);
            const newIndex = rules.findIndex((r) => r.id === over.id);
            const newOrder = arrayMove(rules, oldIndex, newIndex).map(r => r.id);

            // Optimistic update could happen here, but for now just API call
            api.reorderRules(newOrder).then(() => {
                queryClient.invalidateQueries({ queryKey: ['rules'] });
            });
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">Defined Rules</h3>
                    {selectedRules.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={bulkDeleteMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 rounded text-xs font-medium transition disabled:opacity-50"
                        >
                            <Trash2 size={12} />
                            Delete {selectedRules.size} selected
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    {runResult && <span className="text-sm text-green-600 dark:text-green-400 font-medium animate-fade-in">{runResult}</span>}
                    <button
                        onClick={() => setShowRunModal(true)}
                        disabled={runRulesMutation.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                        <Play size={16} className={runRulesMutation.isPending ? "animate-spin" : ""} />
                        {runRulesMutation.isPending ? "Running..." : "Run Rules Now"}
                    </button>
                </div>

                {showRunModal && (
                    <RunRulesModal
                        onClose={() => setShowRunModal(false)}
                        onConfirm={(overwrite) => runRulesMutation.mutate(overwrite)}
                        isPending={runRulesMutation.isPending}
                    />
                )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 p-4 text-sm text-blue-700 dark:text-blue-300 flex gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>
                    <strong>Rule Priority:</strong> Rules with amount filters (e.g. "$0-$15") always take precedence over generic rules.
                    Within each group, rules are matched from top to bottom. Drag to reorder.
                </p>
            </div>

            <div id="add-rule-form" className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Row 1: Keywords, Category, Priority */}
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Keywords</label>
                            <input
                                type="text"
                                placeholder="e.g. Woolworths, Uber (comma separated)"
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                            />
                        </div>
                        <div className="w-[200px]">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Assign to Category</label>
                            <select
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={bucketId}
                                onChange={(e) => setBucketId(e.target.value)}
                            >
                                <option value="">Select Category...</option>
                                {renderCategoryOptions(treeBuckets)}
                            </select>
                        </div>

                    </div>

                    {/* Row 2: Amount Range, Tags, Member Assignment */}
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex items-end gap-2">
                            <div className="w-[90px]">
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Min $</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={minAmount}
                                    onChange={(e) => setMinAmount(e.target.value)}
                                />
                            </div>
                            <span className="text-slate-400 pb-2">—</span>
                            <div className="w-[90px]">
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Max $</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="∞"
                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={maxAmount}
                                    onChange={(e) => setMaxAmount(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Apply Tags</label>
                            <input
                                type="text"
                                placeholder="e.g. Tax-Deductible"
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={applyTags}
                                onChange={(e) => setApplyTags(e.target.value)}
                            />
                        </div>
                        {members.length > 0 && (
                            <div className="w-[150px]">
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Assign to</label>
                                <select
                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={assignTo}
                                    onChange={(e) => setAssignTo(e.target.value)}
                                >
                                    <option value="">Unchanged</option>
                                    <option value="Joint">Joint</option>
                                    {members.map(member => (
                                        <option key={member.id} value={member.name}>{member.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pb-1">
                            <input
                                type="checkbox"
                                id="markForReview"
                                checked={markForReview}
                                onChange={(e) => setMarkForReview(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 bg-slate-100 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="markForReview" className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                Mark for Review
                            </label>
                        </div>
                    </div>

                    {/* Row 3: Buttons */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handlePreview}
                            disabled={!keyword.trim() || previewLoading}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            title="Preview matching transactions"
                        >
                            {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                            Preview
                        </button>
                        <button
                            type="submit"
                            disabled={!keyword || !bucketId}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Rule
                        </button>
                    </div>
                </form>

                {/* Preview Results */}
                {previewError && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                        {previewError}
                    </div>
                )}
                {previewData && (
                    <div className="mt-3 p-3 border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <Eye size={16} className="text-indigo-500" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                <strong>{previewData.match_count}</strong> existing transactions match this keyword
                            </span>
                        </div>
                        {previewData.sample_transactions?.length > 0 && (
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {previewData.sample_transactions.map((t, i) => (
                                    <div key={i} className="text-xs text-slate-600 dark:text-slate-400 flex justify-between py-1 border-b border-slate-200 dark:border-slate-700 last:border-0">
                                        <span className="truncate flex-1">{t.description}</span>
                                        <span className="ml-2 font-medium text-slate-500">{t.date}</span>
                                        <span className="ml-2 font-semibold">${Math.abs(t.amount).toFixed(2)}</span>
                                    </div>
                                ))}
                                {previewData.match_count > previewData.sample_transactions.length && (
                                    <p className="text-xs text-slate-400 italic pt-1">
                                        ...and {previewData.match_count - previewData.sample_transactions.length} more
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

            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="col-span-1 flex items-center">
                    <input
                        type="checkbox"
                        checked={rules?.length > 0 && selectedRules.size === rules?.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                </div>
                <div className="col-span-5">Keywords</div>
                <div className="col-span-4">Category</div>
                <div className="col-span-2 text-right"></div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={rules?.map(r => r.id) || []} strategy={verticalListSortingStrategy}>
                        {!rules?.length && (
                            <div className="p-8 text-center text-slate-400 text-sm">No rules defined yet.</div>
                        )}
                        {rules?.map(rule => (
                            <SortableRuleItem
                                key={rule.id}
                                rule={rule}
                                buckets={buckets}
                                treeBuckets={treeBuckets}
                                members={members}
                                updateRuleMutation={updateRuleMutation}
                                deleteRuleMutation={deleteRuleMutation}
                                isSelected={selectedRules.has(rule.id)}
                                onToggleSelect={() => toggleSelectRule(rule.id)}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}
