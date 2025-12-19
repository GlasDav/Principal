import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch, Menu } from '@headlessui/react';
import { Trash2, Plus, Download, Moon, Sun, DollarSign, Euro, PoundSterling, Save, Upload, Wallet, ShoppingCart, Tag as TagIcon, Home, Utensils, Zap, Car, Film, Heart, ShoppingBag, Briefcase, Coffee, Gift, Music, Smartphone, Plane, Play } from 'lucide-react';
import * as api from '../services/api';
import { ICON_MAP, DEFAULT_ICON } from '../utils/icons';
import { useTheme } from '../context/ThemeContext';



// Currency Code to Symbol Map
const CURRENCY_MAP = {
    'USD': '$',
    'AUD': '$',
    'GBP': '£',
    'EUR': '€',
    'JPY': '¥',
    'INR': '₹',
    'CAD': '$',
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

// Extracted Components to prevent re-render focus loss
const cleanKeywords = (str) => {
    if (!str) return "";
    return [...new Set(str.split(',').map(k => k.trim()).filter(k => k))].join(', ');
};

const BucketCard = ({ bucket, userSettings, updateBucketMutation, deleteBucketMutation }) => {
    const Icon = ICON_MAP[bucket.icon_name] || Wallet;
    const [localLimitA, setLocalLimitA] = useState(bucket.monthly_limit_a);
    const [localLimitB, setLocalLimitB] = useState(bucket.monthly_limit_b);
    const [localName, setLocalName] = useState(bucket.name);
    const currencySymbol = CURRENCY_MAP[userSettings?.currency_symbol] || userSettings?.currency_symbol || '$';

    // Sync local state when prop updates (e.g. from server refresh)
    useEffect(() => {
        setLocalLimitA(bucket.monthly_limit_a);
        setLocalLimitB(bucket.monthly_limit_b);
        setLocalName(bucket.name);
    }, [bucket.monthly_limit_a, bucket.monthly_limit_b, bucket.name]);

    const handleBlurA = () => {
        if (localLimitA !== bucket.monthly_limit_a) {
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, monthly_limit_a: parseFloat(localLimitA) || 0 } });
        }
    };

    const handleBlurB = () => {
        if (localLimitB !== bucket.monthly_limit_b) {
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, monthly_limit_b: parseFloat(localLimitB) || 0 } });
        }
    };

    const handleBlurName = () => {
        if (localName !== bucket.name && localName.trim()) {
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, name: localName } });
        }
    };

    const handleAddTag = (e) => {
        if (e.key === 'Enter') {
            const tagName = e.target.value.trim();
            if (!tagName) return;
            const currentTags = bucket.tags || [];
            if (currentTags.some(t => t.name.toLowerCase() === tagName.toLowerCase())) return;

            const newTags = [...currentTags, { name: tagName }];
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, tags: newTags } });
            e.target.value = '';
        }
    };

    const handleRemoveTag = (tagName) => {
        const newTags = (bucket.tags || []).filter(t => t.name !== tagName);
        updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, tags: newTags } });
    };

    return (
        <div className="bg-white dark:bg-slate-800 h-full flex flex-col p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-2 hover:shadow-md transition-shadow">
            {/* Header: Icon + Name */}
            <div className="flex items-center gap-3">
                <Menu as="div" className="relative">
                    <Menu.Button className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition">
                        <Icon size={20} />
                    </Menu.Button>
                    <Menu.Items className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 p-2 grid grid-cols-5 gap-1 z-10 focus:outline-none">
                        {AVAILABLE_ICONS.map(iconName => {
                            const I = ICON_MAP[iconName];
                            return (
                                <Menu.Item key={iconName}>
                                    {({ active }) => (
                                        <button
                                            onClick={() => updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, icon_name: iconName } })}
                                            className={`p-2 rounded-lg flex justify-center items-center ${active ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                                        >
                                            <I size={18} />
                                        </button>
                                    )}
                                </Menu.Item>
                            )
                        })}
                    </Menu.Items>
                </Menu>

                <div className="flex flex-col flex-1 gap-1">
                    <input
                        className="font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none transition px-1"
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        onBlur={handleBlurName}
                    />
                </div>

                <button onClick={() => deleteBucketMutation.mutate(bucket.id)} className="text-slate-300 hover:text-red-400 transition self-start">
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Type Toggle & Group Select */}
            <div className="flex items-center justify-end gap-2">
                <select
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg px-2 py-1 border-none text-center appearance-none"
                    value={bucket.group || "Discretionary"}
                    onChange={(e) => updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, group: e.target.value } })}
                >
                    <option value="Non-Discretionary">Non-Discretionary</option>
                    <option value="Discretionary">Discretionary</option>
                    <option value="Income">Income</option>
                </select>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>
                <button
                    onClick={() => updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, is_rollover: !bucket.is_rollover } })}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${bucket.is_rollover
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-transparent'
                        }`}
                >
                    Rollover
                </button>
                {userSettings?.is_couple_mode && (
                    <>
                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <button
                            onClick={() => updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, is_shared: !bucket.is_shared } })}
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${bucket.is_shared
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600'
                                }`}
                        >
                            {bucket.is_shared ? 'Shared' : 'Individual'}
                        </button>
                    </>
                )}
            </div>

            {/* Inputs */}
            {/* Inputs Container with Min-Height for Equality (32px * 2 + 8px gap = 72px) */}
            <div className="space-y-2 min-h-[72px] flex flex-col justify-center">
                {userSettings?.is_couple_mode && bucket.is_shared ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500 w-12 text-right">Shared</span>
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-800 dark:text-slate-200 font-medium text-sm">{currencySymbol}</span>
                            <input
                                type="number"
                                placeholder="Limit"
                                className="w-full pl-9 pr-3 h-8 border rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={localLimitA}
                                onChange={(e) => setLocalLimitA(e.target.value)}
                                onBlur={handleBlurA}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-500 w-12 text-right truncate" title={userSettings?.name_a || "User A"}>
                                {userSettings?.name_a || "User A"}
                            </span>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-800 dark:text-slate-200 font-medium text-sm">{currencySymbol}</span>
                                <input
                                    type="number"
                                    placeholder="Limit"
                                    className="w-full pl-9 pr-3 h-8 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    value={localLimitA}
                                    onChange={(e) => setLocalLimitA(e.target.value)}
                                    onBlur={handleBlurA}
                                />
                            </div>
                        </div>
                        {userSettings?.is_couple_mode && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500 w-12 text-right truncate" title={userSettings?.name_b || "User B"}>
                                    {userSettings?.name_b || "User B"}
                                </span>
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-800 dark:text-slate-200 font-medium text-sm">{currencySymbol}</span>
                                    <input
                                        type="number"
                                        placeholder="Limit"
                                        className="w-full pl-9 pr-3 h-8 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={localLimitB}
                                        onChange={(e) => setLocalLimitB(e.target.value)}
                                        onBlur={handleBlurB}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}



            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-50 dark:border-slate-700">
                {bucket.tags?.map((tag, idx) => (
                    <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                        {tag.name}
                        <button
                            onClick={() => handleRemoveTag(tag.name)}
                            className="ml-1 hover:text-red-500"
                        >
                            ×
                        </button>
                    </span>
                ))}
                <div className="relative group/tag">
                    <button className="text-slate-300 hover:text-indigo-500 p-0.5"><Plus size={14} /></button>
                    {/* Quick Tag Input */}
                    <input
                        type="text"
                        className="absolute bottom-full left-0 mb-1 w-24 px-2 py-1 text-xs border rounded shadow-sm opacity-0 group-hover/tag:opacity-100 focus:opacity-100 transition-opacity outline-none z-10 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                        placeholder="Add Tag"
                        onKeyDown={handleAddTag}
                    />
                </div>
            </div>
        </div>
    );
};

const AccountCard = ({ account, updateAccountMutation, deleteAccountMutation }) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${account.type === 'Asset' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {account.type === 'Asset' ? <Wallet size={20} /> : <ShoppingCart size={20} />}
                </div>

                <div className="flex flex-col flex-1 gap-1">
                    <input
                        className="font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none transition px-1"
                        value={account.name}
                        onChange={(e) => updateAccountMutation.mutate({ id: account.id, data: { ...account, name: e.target.value } })}
                    />
                    <div className="flex gap-2">
                        <select
                            className="text-xs text-slate-500 dark:text-slate-400 bg-transparent outline-none cursor-pointer hover:text-indigo-500"
                            value={account.type}
                            onChange={(e) => updateAccountMutation.mutate({ id: account.id, data: { ...account, type: e.target.value } })}
                        >
                            <option value="Asset">Asset</option>
                            <option value="Liability">Liability</option>
                        </select>
                        <span className="text-xs text-slate-300">|</span>
                        <select
                            className="text-xs text-slate-500 dark:text-slate-400 bg-transparent outline-none cursor-pointer hover:text-indigo-500"
                            value={account.category}
                            onChange={(e) => updateAccountMutation.mutate({ id: account.id, data: { ...account, category: e.target.value } })}
                        >
                            <option value="Cash">Cash</option>
                            <option value="Investment">Investment</option>
                            <option value="Real Estate">Real Estate</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Loan">Loan</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={() => {
                        if (confirm("Delete this account?")) deleteAccountMutation.mutate(account.id);
                    }}
                    className="text-slate-300 hover:text-red-400 transition self-start"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
};

const RuleItem = ({ rule, buckets, updateRuleMutation, deleteRuleMutation }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localKeywords, setLocalKeywords] = useState(rule.keywords);
    const [localBucketId, setLocalBucketId] = useState(rule.bucket_id);
    const [localPriority, setLocalPriority] = useState(rule.priority);

    // Reset local state when edit mode is cancelled or rule updates
    useEffect(() => {
        if (!isEditing) {
            setLocalKeywords(rule.keywords);
            setLocalBucketId(rule.bucket_id);
            setLocalPriority(rule.priority);
        }
    }, [isEditing, rule]);

    const handleSave = () => {
        if (!localKeywords || !localBucketId) return;
        updateRuleMutation.mutate({
            id: rule.id,
            data: {
                keywords: cleanKeywords(localKeywords),
                bucket_id: parseInt(localBucketId),
                priority: parseInt(localPriority) || 0
            }
        });
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="p-4 bg-indigo-50 dark:bg-slate-900 border-b border-indigo-100 dark:border-slate-700 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-6">
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
                        value={localBucketId}
                        onChange={(e) => setLocalBucketId(e.target.value)}
                    >
                        {buckets?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                    <input
                        type="number"
                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-white text-right"
                        value={localPriority}
                        onChange={(e) => setLocalPriority(e.target.value)}
                    />
                    <div className="flex gap-1 ml-auto">
                        <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-100 rounded">
                            <Save size={16} />
                        </button>
                        <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                            <TagIcon size={16} className="rotate-45" />
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition cursor-pointer group border-l-2 border-transparent hover:border-indigo-500" onClick={() => setIsEditing(true)}>
            <div className="col-span-6 truncate font-medium text-slate-800 dark:text-slate-200 text-sm group-hover:text-indigo-600 transition-colors" title={rule.keywords}>
                {rule.keywords}
            </div>
            <div className="col-span-4 truncate text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                {buckets?.find(b => b.id === rule.bucket_id)?.name || "Unknown Bucket"}
            </div>
            <div className="col-span-2 flex justify-end items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{rule.priority}</span>
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

const RulesSection = ({ buckets }) => {
    const queryClient = useQueryClient();
    const [keyword, setKeyword] = useState("");
    const [bucketId, setBucketId] = useState("");
    const [priority, setPriority] = useState(0);
    const [runResult, setRunResult] = useState(null);

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

    const runRulesMutation = useMutation({
        mutationFn: api.runRules,
        onSuccess: (data) => {
            setRunResult(`Successfully categorized ${data.count} transactions.`);
            setTimeout(() => setRunResult(null), 5000);
            queryClient.invalidateQueries({ queryKey: ['transactions'] }); // Invalidate transaction lists elsewhere if needed
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!keyword || !bucketId) return;
        createRuleMutation.mutate({
            keywords: cleanKeywords(keyword),
            bucket_id: parseInt(bucketId),
            priority: parseInt(priority) || 0
        });
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            {/* Header / Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">Defined Rules</h3>
                <div className="flex items-center gap-4">
                    {runResult && <span className="text-sm text-green-600 dark:text-green-400 font-medium animate-fade-in">{runResult}</span>}
                    <button
                        onClick={() => runRulesMutation.mutate()}
                        disabled={runRulesMutation.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                        <Play size={16} className={runRulesMutation.isPending ? "animate-spin" : ""} />
                        {runRulesMutation.isPending ? "Running..." : "Run Rules Now"}
                    </button>
                </div>
            </div>

            {/* Add Rule Form */}
            <div id="add-rule-form" className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
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
                            {buckets?.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-[100px]">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Priority</label>
                        <input
                            type="number"
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!keyword || !bucketId}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add Rule
                    </button>
                </form>
            </div>

            {/* Rules List - Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="col-span-6">Keywords</div>
                <div className="col-span-4">Category</div>
                <div className="col-span-2 text-right">Priority</div>
            </div>

            {/* Rules List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
                {!rules?.length && (
                    <div className="p-8 text-center text-slate-400 text-sm">No rules defined yet.</div>
                )}
                {rules?.map(rule => (
                    <RuleItem
                        key={rule.id}
                        rule={rule}
                        buckets={buckets}
                        updateRuleMutation={updateRuleMutation}
                        deleteRuleMutation={deleteRuleMutation}
                    />
                ))}
            </div>
        </div>
    );
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Settings Page Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-red-600">
                    <h1 className="text-xl font-bold">Something went wrong.</h1>
                    <pre className="mt-4 bg-red-50 p-4 rounded text-sm overflow-auto">
                        {this.state.error && this.state.error.toString()}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

function SettingsContent() {

    const queryClient = useQueryClient();
    const { darkMode, setDarkMode } = useTheme();

    // Removed local dark mode logic as it's now handled globally in ThemeContext

    // User Settings
    const { data: userSettings, isLoading: loadingUser } = useQuery({
        queryKey: ['userSettings'],
        queryFn: api.getSettings
    });

    const [formState, setFormState] = useState(null);
    const [isDirty, setIsDirty] = useState(false);

    // Initialize/Sync Form State
    useEffect(() => {
        if (userSettings && !isDirty) {
            setFormState(userSettings);
        }
    }, [userSettings, isDirty]);

    const updateUserMutation = useMutation({
        mutationFn: (data) => {
            const payload = {
                is_couple_mode: data.is_couple_mode,
                name_a: data.name_a,
                name_b: data.name_b,
                currency_symbol: data.currency_symbol
            };
            return api.updateSettings(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userSettings'] });
            setIsDirty(false); // Reset dirty flag on save
        }
    });

    // Buckets
    const { data: buckets, isLoading: loadingBuckets } = useQuery({
        queryKey: ['buckets'],
        queryFn: api.getBuckets
    });

    const createBucketMutation = useMutation({
        mutationFn: api.createBucket,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['buckets'] })
    });

    const updateBucketMutation = useMutation({
        mutationFn: ({ id, data }) => {
            const payload = { ...data };
            if (payload.tags && Array.isArray(payload.tags)) {
                payload.tags = payload.tags.map(t => typeof t === 'object' ? t.name : t);
            }
            return api.updateBucket(id, payload);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['buckets'] })
    });

    const deleteBucketMutation = useMutation({
        mutationFn: api.deleteBucket,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['buckets'] })
    });

    // Net Worth Accounts
    const { data: accounts, isLoading: loadingAccounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await api.axiosInstance.get('/net-worth/accounts')).data
    });

    const createAccountMutation = useMutation({
        mutationFn: async (newAccount) => {
            await api.axiosInstance.post('/net-worth/accounts', newAccount);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] })
    });

    const updateAccountMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            await api.axiosInstance.put(`/net-worth/accounts/${id}`, data);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] })
    });

    const deleteAccountMutation = useMutation({
        mutationFn: async (id) => {
            await api.axiosInstance.delete(`/net-worth/accounts/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] })
    });

    // Group Buckets
    const groupedBuckets = React.useMemo(() => {
        if (!buckets) return { "Non-Discretionary": [], "Discretionary": [] };

        const groups = {
            "Income": [],
            "Non-Discretionary": [],
            "Discretionary": []
        };

        buckets.forEach(bucket => {
            const groupName = bucket.group || "Discretionary";
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(bucket);
        });

        return groups;
    }, [buckets]);

    const handleDownloadBackup = async () => {
        try {
            const response = await fetch('http://localhost:8000/settings/backup');
            if (!response.ok) throw new Error('Backup failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `principal_backup_${new Date().toISOString().split('T')[0]}.db`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            console.error("Backup download failed", err);
            alert("Failed to download backup");
        }
    };

    const fileInputRef = React.useRef(null);

    const handleRestoreBackup = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!window.confirm("WARNING: transforming data... \n\nThis will completely overwrite your current data with the backup.\n\nAre you sure you want to proceed?")) {
            event.target.value = null;
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.axiosInstance.post('/settings/restore', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            alert("Data restored successfully! The page will now reload.");
            window.location.reload();
        } catch (err) {
            console.error("Restore failed", err);
            alert(`Restore failed: ${err.response?.data?.detail || err.message}`);
        } finally {
            event.target.value = null;
        }
    };

    const handleFormChange = (updates) => {
        setFormState(prev => ({ ...prev, ...updates }));
        setIsDirty(true);
    };

    const saveSettings = () => {
        if (formState) {
            updateUserMutation.mutate(formState);
        }
    };

    if (loadingUser || loadingBuckets) return <div className="p-8 dark:bg-slate-900 dark:text-white h-screen">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
            <div className="max-w-7xl mx-auto p-6 space-y-8">
                {/* Header / Top Bar */}
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Settings</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your budget preferences and categories.</p>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                        >
                            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".db,.sqlite"
                            onChange={handleRestoreBackup}
                        />

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition group"
                            title="Restore from Backup"
                        >
                            <Upload size={18} className="group-hover:text-red-500 transition-colors" />
                            <span>Restore</span>
                        </button>

                        <button
                            onClick={handleDownloadBackup}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        >
                            <Download size={18} />
                            <span>Backup Data</span>
                        </button>
                    </div>
                </div>

                {/* Global Preferences Panel */}
                <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Application Preferences</h2>
                        {isDirty && (
                            <button
                                onClick={saveSettings}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition animate-pulse"
                            >
                                <Save size={18} />
                                <span>Save Changes</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Mode Settings */}
                        <div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg mb-4">
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">Couple Mode</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-500">Enable separate spending limits per person.</p>
                                </div>
                                <Switch
                                    checked={formState?.is_couple_mode || false}
                                    onChange={(checked) => handleFormChange({ is_couple_mode: checked })}
                                    className={`${formState?.is_couple_mode ? 'bg-indigo-600' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                                >
                                    <span className={`${formState?.is_couple_mode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                                </Switch>
                            </div>

                            {formState?.is_couple_mode && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Partner A (You)</label>
                                        <input
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formState?.name_a || ''}
                                            onChange={(e) => handleFormChange({ name_a: e.target.value })}
                                            placeholder="You"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Partner B</label>
                                        <input
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formState?.name_b || ''}
                                            onChange={(e) => handleFormChange({ name_b: e.target.value })}
                                            placeholder="Partner"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Currency Setting - Matched style to Couple Mode */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">Currency</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-500">Select your preferred currency code.</p>
                                </div>
                                <select
                                    value={formState?.currency_symbol || 'AUD'}
                                    onChange={(e) => handleFormChange({ currency_symbol: e.target.value })}
                                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                >
                                    <option value="USD">USD</option>
                                    <option value="AUD">AUD</option>
                                    <option value="GBP">GBP</option>
                                    <option value="EUR">EUR</option>
                                    <option value="JPY">JPY</option>
                                    <option value="INR">INR</option>
                                    <option value="CAD">CAD</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Budget Buckets - Columnar Layout */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Budget Categories</h2>
                    </div>

                    <div className="flex overflow-x-auto pb-8 gap-6 snap-x">
                        {Object.entries(groupedBuckets).map(([tag, groupBuckets]) => (
                            <div key={tag} className="min-w-[320px] w-[320px] shrink-0 snap-start">
                                <div className="flex items-center justify-center mb-4 px-1">
                                    <h3 className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-sm flex items-center gap-2">
                                        {tag === "Income" && <DollarSign size={16} />}
                                        {tag === "Non-Discretionary" && <Home size={16} />}
                                        {(tag === "Discretionary" || !["Income", "Non-Discretionary"].includes(tag)) && <ShoppingBag size={16} />}

                                        {tag === "Income" ? "Income" : (tag === "Non-Discretionary" ? "Non-Discretionary" : "Discretionary")}
                                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full text-xs">{groupBuckets.length}</span>
                                    </h3>
                                </div>

                                <div className="space-y-4">
                                    {groupBuckets.map(bucket => (
                                        <BucketCard
                                            key={bucket.id}
                                            bucket={bucket}
                                            userSettings={userSettings}
                                            updateBucketMutation={updateBucketMutation}
                                            deleteBucketMutation={deleteBucketMutation}
                                        />
                                    ))}

                                    {groupBuckets.length === 0 && (
                                        <div className="h-24 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                                            Empty
                                        </div>
                                    )}

                                    <button
                                        onClick={() => createBucketMutation.mutate({ name: "New Category", group: tag, is_shared: false })}
                                        className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition flex items-center justify-center gap-2 font-medium text-sm"
                                    >
                                        <Plus size={16} />
                                        Add {tag === "Non-Discretionary" ? "Needs" : (tag === "Discretionary" ? "Wants" : tag)}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Net Worth Accounts (Moved above Smart Rules) */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Net Worth Accounts</h2>
                        <button
                            onClick={() => {
                                const name = prompt("Enter account name:");
                                if (name) createAccountMutation.mutate({ name, type: "Asset", category: "Cash" });
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition"
                        >
                            <Plus size={20} />
                            <span>Add Account</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-sm mb-4">Assets</h3>
                            <div className="space-y-4">
                                {accounts?.filter(a => a.type === 'Asset').map(account => (
                                    <AccountCard
                                        key={account.id}
                                        account={account}
                                        updateAccountMutation={updateAccountMutation}
                                        deleteAccountMutation={deleteAccountMutation}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-sm mb-4">Liabilities</h3>
                            <div className="space-y-4">
                                {accounts?.filter(a => a.type === 'Liability').map(account => (
                                    <AccountCard
                                        key={account.id}
                                        account={account}
                                        updateAccountMutation={updateAccountMutation}
                                        deleteAccountMutation={deleteAccountMutation}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Categorization Rules Section */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Smart Rules</h2>
                    </div>
                    <RulesSection buckets={buckets} />
                </section>
            </div>
        </div>
    );
}

export default function Settings() {
    return (
        <ErrorBoundary>
            <SettingsContent />
        </ErrorBoundary>
    );
}
