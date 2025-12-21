import React, { useState, useEffect, useRef } from 'react';
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

// Bucket Table Row Component - compact inline editing
const BucketTableRow = ({ bucket, userSettings, updateBucketMutation, deleteBucketMutation, allTags = [] }) => {
    const Icon = ICON_MAP[bucket.icon_name] || Wallet;
    const [localName, setLocalName] = useState(bucket.name || '');
    const [localLimitA, setLocalLimitA] = useState(bucket.monthly_limit_a || 0);
    const [localLimitB, setLocalLimitB] = useState(bucket.monthly_limit_b || 0);
    const [showTags, setShowTags] = useState(false);
    const [newTag, setNewTag] = useState('');
    const tagDropdownRef = useRef(null);
    const currencySymbol = CURRENCY_MAP[userSettings?.currency_symbol] || userSettings?.currency_symbol || '$';

    useEffect(() => {
        setLocalName(bucket.name || '');
        setLocalLimitA(bucket.monthly_limit_a || 0);
        setLocalLimitB(bucket.monthly_limit_b || 0);
    }, [bucket.name, bucket.monthly_limit_a, bucket.monthly_limit_b]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target)) {
                setShowTags(false);
                setNewTag('');
            }
        };
        if (showTags) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showTags]);

    const handleBlurName = () => {
        if (localName !== bucket.name && localName.trim()) {
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, name: localName } });
        }
    };

    const handleBlurLimitA = () => {
        const val = parseFloat(localLimitA) || 0;
        if (val !== bucket.monthly_limit_a) {
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, monthly_limit_a: val } });
        }
    };

    const handleBlurLimitB = () => {
        const val = parseFloat(localLimitB) || 0;
        if (val !== bucket.monthly_limit_b) {
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, monthly_limit_b: val } });
        }
    };

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (newTag.trim()) {
                const currentTags = bucket.tags || [];
                if (!currentTags.some(t => t.name.toLowerCase() === newTag.toLowerCase())) {
                    updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, tags: [...currentTags, { name: newTag.trim() }] } });
                }
                setNewTag('');
            }
            setShowTags(false);
        } else if (e.key === 'Tab' || e.key === 'Escape') {
            setShowTags(false);
            setNewTag('');
        }
    };

    const handleAddExistingTag = (tagName) => {
        const currentTags = bucket.tags || [];
        if (!currentTags.some(t => t.name.toLowerCase() === tagName.toLowerCase())) {
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, tags: [...currentTags, { name: tagName }] } });
        }
    };

    const handleRemoveTag = (tagName) => {
        const newTags = (bucket.tags || []).filter(t => t.name !== tagName);
        updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, tags: newTags } });
    };

    const tags = bucket.tags || [];
    const visibleTags = tags.slice(0, 2);
    const hiddenCount = tags.length - visibleTags.length;

    // Get suggestions (existing tags not already on this bucket)
    const currentTagNames = tags.map(t => t.name.toLowerCase());
    const suggestions = allTags.filter(t => !currentTagNames.includes(t.toLowerCase()));

    return (
        <tr className={`border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group ${bucket.is_transfer ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
            {/* Icon */}
            <td className="p-2 w-12">
                <Menu as="div" className="relative">
                    <Menu.Button className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition">
                        <Icon size={16} />
                    </Menu.Button>
                    <Menu.Items className="absolute left-0 mt-1 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-2 grid grid-cols-5 gap-1 z-20">
                        {AVAILABLE_ICONS.map(iconName => {
                            const I = ICON_MAP[iconName];
                            return (
                                <Menu.Item key={iconName}>
                                    {({ active }) => (
                                        <button
                                            onClick={() => updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, icon_name: iconName } })}
                                            className={`p-1.5 rounded flex justify-center ${active ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`}
                                        >
                                            <I size={16} />
                                        </button>
                                    )}
                                </Menu.Item>
                            );
                        })}
                    </Menu.Items>
                </Menu>
            </td>

            {/* Name */}
            <td className="p-2">
                <input
                    className="w-full font-medium text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none transition text-sm py-1"
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={handleBlurName}
                    placeholder="Category name..."
                />
            </td>

            {/* Limit A */}
            <td className="p-2 w-28">
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{currencySymbol}</span>
                    <input
                        type="number"
                        className="w-full pl-6 pr-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-800 dark:text-slate-200 focus:border-indigo-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={localLimitA}
                        onChange={(e) => setLocalLimitA(e.target.value)}
                        onBlur={handleBlurLimitA}
                    />
                </div>
            </td>

            {/* Limit B (Couple Mode) */}
            {userSettings?.is_couple_mode && (
                <td className="p-2 w-28">
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{currencySymbol}</span>
                        <input
                            type="number"
                            className={`w-full pl-6 pr-2 py-1 text-sm border rounded focus:border-indigo-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${bucket.is_shared
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-slate-400'
                                : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200'
                                }`}
                            value={localLimitB}
                            onChange={(e) => setLocalLimitB(e.target.value)}
                            onBlur={handleBlurLimitB}
                            disabled={bucket.is_shared}
                        />
                    </div>
                </td>
            )}

            {/* Shared Toggle (Couple Mode) */}
            {userSettings?.is_couple_mode && (
                <td className="p-2 w-16 text-center">
                    <button
                        onClick={() => updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, is_shared: !bucket.is_shared } })}
                        className={`mx-auto w-5 h-5 rounded border-2 flex items-center justify-center transition ${bucket.is_shared
                            ? 'bg-indigo-500 border-indigo-500 text-white'
                            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                            }`}
                    >
                        {bucket.is_shared && <span className="text-xs">✓</span>}
                    </button>
                </td>
            )}

            {/* Rollover */}
            <td className="p-2 w-20 text-center">
                <button
                    onClick={() => updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, is_rollover: !bucket.is_rollover } })}
                    className={`mx-auto w-5 h-5 rounded border-2 flex items-center justify-center transition ${bucket.is_rollover
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                        }`}
                >
                    {bucket.is_rollover && <span className="text-xs">✓</span>}
                </button>
            </td>

            {/* Tags (for filtering insights) */}
            <td className="p-2 relative">
                <div className="flex flex-wrap gap-1 items-center">
                    {visibleTags.map((tag, idx) => (
                        <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            {tag.name}
                            {showTags && (
                                <button onClick={() => handleRemoveTag(tag.name)} className="ml-1 hover:text-red-500">×</button>
                            )}
                        </span>
                    ))}
                    {hiddenCount > 0 && (
                        <button
                            onClick={() => setShowTags(!showTags)}
                            className="text-[10px] text-purple-500 hover:text-purple-700 font-medium"
                        >
                            +{hiddenCount} more
                        </button>
                    )}
                    <button
                        onClick={() => setShowTags(!showTags)}
                        className="text-slate-300 hover:text-purple-500 opacity-0 group-hover:opacity-100 transition"
                    >
                        <Plus size={12} />
                    </button>
                </div>

                {/* Expanded Tags Dropdown */}
                {showTags && (
                    <div ref={tagDropdownRef} className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 z-20 min-w-[220px]">
                        {/* Current tags on this bucket */}
                        <div className="flex flex-wrap gap-1 mb-2">
                            {tags.map((tag, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                    {tag.name}
                                    <button onClick={() => handleRemoveTag(tag.name)} className="ml-1.5 hover:text-red-500">×</button>
                                </span>
                            ))}
                        </div>

                        {/* Suggestions from other buckets */}
                        {suggestions.length > 0 && (
                            <div className="mb-2">
                                <div className="text-[10px] text-slate-400 mb-1">Add existing:</div>
                                <div className="flex flex-wrap gap-1">
                                    {suggestions.map((tagName, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleAddExistingTag(tagName)}
                                            className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-purple-100 hover:text-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-400 transition"
                                        >
                                            + {tagName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <input
                            type="text"
                            className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:border-purple-500"
                            placeholder="New tag (Enter to add)"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                            autoFocus
                        />
                    </div>
                )}
            </td>

            {/* Delete */}
            <td className="p-2 w-10">
                <button
                    onClick={() => {
                        if (confirm(`Delete "${bucket.name}"?`)) {
                            deleteBucketMutation.mutate(bucket.id);
                        }
                    }}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                >
                    <Trash2 size={14} />
                </button>
            </td>
        </tr>
    );
};

// Bucket Table Section Component - one per group with sortable columns
const BucketTableSection = ({ title, icon: SectionIcon, buckets, userSettings, createBucketMutation, updateBucketMutation, deleteBucketMutation, groupName, allTags = [] }) => {
    const [sortField, setSortField] = useState('name');
    const [sortDir, setSortDir] = useState('asc');

    const handleAddNew = () => {
        createBucketMutation.mutate({ name: "New Category", group: groupName, is_shared: false });
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    // Sort buckets
    const sortedBuckets = [...buckets].sort((a, b) => {
        let aVal, bVal;
        switch (sortField) {
            case 'name':
                aVal = (a.name || '').toLowerCase();
                bVal = (b.name || '').toLowerCase();
                break;
            case 'limitA':
                aVal = a.monthly_limit_a || 0;
                bVal = b.monthly_limit_a || 0;
                break;
            case 'limitB':
                aVal = a.monthly_limit_b || 0;
                bVal = b.monthly_limit_b || 0;
                break;
            case 'rollover':
                aVal = a.is_rollover ? 1 : 0;
                bVal = b.is_rollover ? 1 : 0;
                break;
            case 'tags':
                aVal = (a.tags || []).length;
                bVal = (b.tags || []).length;
                break;
            default:
                aVal = (a.name || '').toLowerCase();
                bVal = (b.name || '').toLowerCase();
        }
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const SortHeader = ({ field, children, className = '' }) => (
        <th
            className={`p-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition select-none ${className}`}
            onClick={() => handleSort(field)}
        >
            <div className={`flex items-center gap-1 ${className.includes('text-center') ? 'justify-center' : ''}`}>
                {children}
                {sortField === field && (
                    <span className="text-indigo-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
            </div>
        </th>
    );

    const colSpan = userSettings?.is_couple_mode ? 8 : 6;

    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
                <SectionIcon size={18} className="text-slate-500 dark:text-slate-400" />
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wider">{title}</h3>
                <span className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full text-xs">{buckets.length}</span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-left table-fixed">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="p-2 w-12"></th>
                            <SortHeader field="name" className="w-40">Name</SortHeader>
                            <SortHeader field="limitA" className="w-24">
                                {userSettings?.is_couple_mode ? (userSettings?.name_a || 'User A') : 'Limit'}
                            </SortHeader>
                            {userSettings?.is_couple_mode && (
                                <SortHeader field="limitB" className="w-24">
                                    {userSettings?.name_b || 'User B'}
                                </SortHeader>
                            )}
                            {userSettings?.is_couple_mode && (
                                <th className="p-2 text-xs font-semibold text-slate-500 dark:text-slate-400 w-16 text-center">Shared</th>
                            )}
                            <SortHeader field="rollover" className="w-20 text-center">Rollover</SortHeader>
                            <SortHeader field="tags" className="w-32">Tags</SortHeader>
                            <th className="p-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Existing Buckets */}
                        {sortedBuckets.map(bucket => (
                            <BucketTableRow
                                key={bucket.id}
                                bucket={bucket}
                                userSettings={userSettings}
                                updateBucketMutation={updateBucketMutation}
                                deleteBucketMutation={deleteBucketMutation}
                                allTags={allTags}
                            />
                        ))}

                        {buckets.length === 0 && (
                            <tr>
                                <td colSpan={colSpan} className="p-6 text-center text-slate-400 text-sm">
                                    No categories yet
                                </td>
                            </tr>
                        )}

                        {/* Add New Row - at bottom */}
                        <tr className="border-t border-slate-100 dark:border-slate-700 bg-slate-25 dark:bg-slate-800/30">
                            <td colSpan={colSpan} className="p-2">
                                <button
                                    onClick={handleAddNew}
                                    className="w-full py-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center justify-center gap-2 text-sm font-medium"
                                >
                                    <Plus size={14} />
                                    Add new category
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
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

    // Collect all unique tag names across all buckets for suggestions
    const allTags = React.useMemo(() => {
        if (!buckets) return [];
        const tagSet = new Set();
        buckets.forEach(bucket => {
            (bucket.tags || []).forEach(tag => tagSet.add(tag.name));
        });
        return Array.from(tagSet).sort();
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

                {/* Budget Buckets - Table Layout */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Budget Categories</h2>
                    </div>

                    {/* Income Section */}
                    <BucketTableSection
                        title="Income"
                        icon={DollarSign}
                        buckets={groupedBuckets["Income"] || []}
                        userSettings={userSettings}
                        createBucketMutation={createBucketMutation}
                        updateBucketMutation={updateBucketMutation}
                        deleteBucketMutation={deleteBucketMutation}
                        groupName="Income"
                        allTags={allTags}
                    />

                    {/* Non-Discretionary Section */}
                    <BucketTableSection
                        title="Non-Discretionary"
                        icon={Home}
                        buckets={groupedBuckets["Non-Discretionary"] || []}
                        userSettings={userSettings}
                        createBucketMutation={createBucketMutation}
                        updateBucketMutation={updateBucketMutation}
                        deleteBucketMutation={deleteBucketMutation}
                        groupName="Non-Discretionary"
                        allTags={allTags}
                    />

                    {/* Discretionary Section */}
                    <BucketTableSection
                        title="Discretionary"
                        icon={ShoppingBag}
                        buckets={groupedBuckets["Discretionary"] || []}
                        userSettings={userSettings}
                        createBucketMutation={createBucketMutation}
                        updateBucketMutation={updateBucketMutation}
                        deleteBucketMutation={deleteBucketMutation}
                        groupName="Discretionary"
                        allTags={allTags}
                    />
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

                {/* Danger Zone */}
                <section className="mt-12">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-6">
                        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Danger Zone</h2>
                        <p className="text-sm text-red-600/70 dark:text-red-400/70 mb-4">
                            Irreversible actions that will permanently affect your account.
                        </p>

                        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-lg border border-red-200 dark:border-red-900/50">
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-white">Delete Account</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Permanently delete your account and all data. This cannot be undone.
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    const password = prompt("To confirm deletion, please enter your password:");
                                    if (!password) return;

                                    if (!window.confirm("⚠️ FINAL WARNING ⚠️\n\nThis will permanently delete:\n• All transactions\n• All accounts\n• All budget categories\n• All goals and subscriptions\n• Your entire account\n\nThis action CANNOT be undone.\n\nAre you absolutely sure?")) {
                                        return;
                                    }

                                    try {
                                        await api.axiosInstance.delete('/auth/account', {
                                            data: { password }
                                        });
                                        alert("Your account has been deleted. Goodbye!");
                                        localStorage.removeItem('token');
                                        localStorage.removeItem('refreshToken');
                                        window.location.href = '/login';
                                    } catch (err) {
                                        const detail = err.response?.data?.detail;
                                        if (typeof detail === 'string') {
                                            alert(`Error: ${detail}`);
                                        } else {
                                            alert("Failed to delete account. Please try again.");
                                        }
                                    }
                                }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                            >
                                Delete My Account
                            </button>
                        </div>
                    </div>
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
