import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu } from '@headlessui/react';
import { Trash2, Plus, DollarSign, Wallet, ShoppingBag, Home, Tag as TagIcon, Save, Play, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import * as api from '../services/api';
import { ICON_MAP } from '../utils/icons';

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

const cleanKeywords = (str) => {
    if (!str) return "";
    return [...new Set(str.split(',').map(k => k.trim()).filter(k => k))].join(', ');
};

// === BUCKET TABLE ROW ===
const BucketTableRow = ({ bucket, userSettings, updateBucketMutation, deleteBucketMutation, createBucketMutation, allTags = [], depth = 0, isExpanded = false, onToggleExpand = () => { }, hasChildren = false }) => {
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

    const handleAddSubCategory = () => {
        createBucketMutation.mutate({
            name: "New Sub-Category",
            group: bucket.group,
            parent_id: bucket.id,
            is_shared: bucket.is_shared
        });
        if (!isExpanded) onToggleExpand();
    };

    const tags = bucket.tags || [];
    const visibleTags = tags.slice(0, 2);
    const hiddenCount = tags.length - visibleTags.length;
    const currentTagNames = tags.map(t => t.name.toLowerCase());
    const suggestions = allTags.filter(t => !currentTagNames.includes(t.toLowerCase()));

    const isParent = depth === 0;
    const rowBgClass = isParent
        ? 'bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold'
        : `hover:bg-slate-50 dark:hover:bg-slate-800/50 ${bucket.is_transfer ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''} ${bucket.is_investment ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`;

    return (
        <tr className={`border-b border-slate-100 dark:border-slate-700 transition group ${rowBgClass}`}>
            <td className="p-2 w-12 relative">
                <div className="flex items-center" style={{ paddingLeft: depth * 20 }}>
                    {depth > 0 && <CornerDownRight size={12} className="text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" style={{ left: (depth * 20) - 10 }} />}

                    {/* Expand/Collapse Toggle for Parents */}
                    {hasChildren && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                            className="absolute -left-1 text-slate-400 hover:text-indigo-500 p-0.5 z-10"
                            style={{ left: (depth * 20) - 18 }}
                        >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    )}

                    <Menu as="div" className="relative">
                        <Menu.Button className={`p-1.5 rounded-lg transition relative ${isParent ? 'bg-white dark:bg-slate-700 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600 text-indigo-600 dark:text-indigo-400' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'}`}>
                            <Icon size={16} />
                            {/* Add Child Button Overlay */}
                            {depth < 2 && (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleAddSubCategory();
                                    }}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm hover:scale-110 cursor-pointer"
                                    title="Add Sub-Category"
                                >
                                    <Plus size={10} />
                                </div>
                            )}
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
                </div>
            </td>
            <td className="p-2">
                <input
                    className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none transition text-sm py-1 ${isParent ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-800 dark:text-slate-100'}`}
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={handleBlurName}
                    placeholder="Category name..."
                />
            </td>
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
                {showTags && (
                    <div ref={tagDropdownRef} className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 z-20 min-w-[220px]">
                        <div className="flex flex-wrap gap-1 mb-2">
                            {tags.map((tag, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                    {tag.name}
                                    <button onClick={() => handleRemoveTag(tag.name)} className="ml-1.5 hover:text-red-500">×</button>
                                </span>
                            ))}
                        </div>
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
            <td className="p-2 w-10">
                {!bucket.is_transfer && !bucket.is_investment && (
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
                )}
            </td>
        </tr>
    );
};

// === BUCKET TABLE SECTION ===
const BucketTableSection = ({ title, icon: SectionIcon, buckets, userSettings, createBucketMutation, updateBucketMutation, deleteBucketMutation, groupName, allTags = [] }) => {
    const [sortField, setSortField] = useState('name');
    const [sortDir, setSortDir] = useState('asc');
    const [expandedIds, setExpandedIds] = useState(new Set());

    useEffect(() => {
        if (buckets && buckets.length > 0) {
            setExpandedIds(prev => {
                if (prev.size === 0) return new Set(buckets.map(b => b.id));
                return prev;
            });
        }
    }, [buckets]);

    const handleAddNew = () => {
        createBucketMutation.mutate({ name: "New Category", group: groupName, is_shared: false });
    };

    const handleToggleExpand = (id) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    // --- Tree Logic ---
    const visibleRows = React.useMemo(() => {
        if (!buckets || buckets.length === 0) return [];

        // 1. Map buckets by ID and add children array
        const bucketMap = new Map();
        buckets.forEach(b => bucketMap.set(String(b.id), { ...b, children: [] }));



        // 2. Identify roots and link children to parents
        const roots = [];

        buckets.forEach(b => {
            const strId = String(b.id);
            const strParentId = b.parent_id ? String(b.parent_id) : null;

            if (strParentId && bucketMap.has(strParentId)) {
                bucketMap.get(strParentId).children.push(bucketMap.get(strId));
            } else {
                roots.push(bucketMap.get(strId));
            }
        });

        // 3. Helper to sort nodes
        const sortNodes = (nodes) => {
            return [...nodes].sort((a, b) => {
                let aVal, bVal;
                switch (sortField) {
                    case 'name': aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase(); break;
                    case 'limitA': aVal = a.monthly_limit_a || 0; bVal = b.monthly_limit_a || 0; break;
                    case 'limitB': aVal = a.monthly_limit_b || 0; bVal = b.monthly_limit_b || 0; break;
                    case 'rollover': aVal = a.is_rollover ? 1 : 0; bVal = b.is_rollover ? 1 : 0; break;
                    default: aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase();
                }
                if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        };

        // 4. Recursive flatten
        const flatten = (nodes, depth = 0) => {
            const sorted = sortNodes(nodes);
            let flat = [];
            for (const node of sorted) {
                const hasChildren = node.children && node.children.length > 0;
                flat.push({ ...node, depth, hasChildren });

                if (hasChildren && expandedIds.has(node.id)) {
                    flat = flat.concat(flatten(node.children, depth + 1));
                }
            }
            return flat;
        };

        return flatten(roots);

    }, [buckets, sortField, sortDir, expandedIds]);


    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

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
                        {visibleRows.map(bucket => (
                            <BucketTableRow
                                key={bucket.id}
                                bucket={bucket}
                                userSettings={userSettings}
                                updateBucketMutation={updateBucketMutation}
                                deleteBucketMutation={deleteBucketMutation}
                                createBucketMutation={createBucketMutation}
                                allTags={allTags}
                                depth={bucket.depth}
                                isExpanded={expandedIds.has(bucket.id)}
                                onToggleExpand={() => handleToggleExpand(bucket.id)}
                                hasChildren={bucket.hasChildren}
                            />
                        ))}
                        {buckets.length === 0 && (
                            <tr>
                                <td colSpan={colSpan} className="p-6 text-center text-slate-400 text-sm">
                                    No categories yet
                                </td>
                            </tr>
                        )}
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

// === RULE ITEM ===
const RuleItem = ({ rule, buckets, updateRuleMutation, deleteRuleMutation, isSelected, onToggleSelect }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localKeywords, setLocalKeywords] = useState(rule.keywords);
    const [localBucketId, setLocalBucketId] = useState(rule.bucket_id);
    const [localPriority, setLocalPriority] = useState(rule.priority);

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

// === RULES SECTION ===
const RulesSection = ({ buckets }) => {
    const queryClient = useQueryClient();
    const [keyword, setKeyword] = useState("");
    const [bucketId, setBucketId] = useState("");
    const [priority, setPriority] = useState(0);
    const [runResult, setRunResult] = useState(null);
    const [selectedRules, setSelectedRules] = useState(new Set());

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

    const runRulesMutation = useMutation({
        mutationFn: api.runRules,
        onSuccess: (data) => {
            setRunResult(`Successfully categorized ${data.count} transactions.`);
            setTimeout(() => setRunResult(null), 5000);
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
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
                        onClick={() => runRulesMutation.mutate()}
                        disabled={runRulesMutation.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                        <Play size={16} className={runRulesMutation.isPending ? "animate-spin" : ""} />
                        {runRulesMutation.isPending ? "Running..." : "Run Rules Now"}
                    </button>
                </div>
            </div>

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
                <div className="col-span-2 text-right">Priority</div>
            </div>

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
                        isSelected={selectedRules.has(rule.id)}
                        onToggleSelect={() => toggleSelectRule(rule.id)}
                    />
                ))}
            </div>
        </div>
    );
};

// === MAIN BUDGET PAGE ===
export default function Budget() {
    const queryClient = useQueryClient();

    const { data: userSettings, isLoading: loadingUser } = useQuery({
        queryKey: ['userSettings'],
        queryFn: api.getSettings
    });

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

    const groupedBuckets = React.useMemo(() => {
        if (!buckets) return { "Non-Discretionary": [], "Discretionary": [] };
        const groups = { "Income": [], "Non-Discretionary": [], "Discretionary": [] };
        buckets.forEach(bucket => {
            const groupName = bucket.group || "Discretionary";
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(bucket);
        });
        return groups;
    }, [buckets]);

    const allTags = React.useMemo(() => {
        if (!buckets) return [];
        const tagSet = new Set();
        buckets.forEach(bucket => {
            (bucket.tags || []).forEach(tag => tagSet.add(tag.name));
        });
        return Array.from(tagSet).sort();
    }, [buckets]);

    if (loadingUser || loadingBuckets) {
        return <div className="p-8 dark:bg-slate-900 dark:text-white h-screen">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
            <div className="max-w-7xl mx-auto p-6 space-y-8">
                <header>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Budget</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your spending categories and smart rules.</p>
                </header>

                {/* Budget Categories */}
                <section>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Categories</h2>

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

                {/* Smart Rules */}
                <section>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Smart Rules</h2>
                    <RulesSection buckets={buckets} />
                </section>
            </div>
        </div>
    );
}
