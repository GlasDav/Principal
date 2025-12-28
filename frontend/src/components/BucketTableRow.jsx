import React, { useState, useEffect, useRef } from 'react';
import { Menu } from '@headlessui/react';
import { Trash2, Plus, CornerDownRight, ChevronDown, ChevronRight, GripVertical, Eye, EyeOff, Wallet } from 'lucide-react';
import { ICON_MAP } from '../utils/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

export default function BucketTableRow({
    bucket,
    userSettings,
    members = [],
    updateBucketMutation,
    deleteBucketMutation,
    createBucketMutation,
    allTags = [],
    depth = 0,
    isExpanded = false,
    onToggleExpand = () => { },
    hasChildren = false,
    onMoveBucket = null,
    isFirst = false,
    isLast = false
}) {
    // Sortable hook for all rows
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: bucket.id });

    const sortableStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const Icon = ICON_MAP[bucket.icon_name] || Wallet;
    const [localName, setLocalName] = useState(bucket.name || '');

    // Initialize limits state from bucket.limits or default to empty
    // We map member_id -> amount for easier lookup
    const [localLimits, setLocalLimits] = useState(() => {
        const limitsMap = {};
        (bucket.limits || []).forEach(l => limitsMap[l.member_id] = l.amount);
        return limitsMap;
    });

    const [showTags, setShowTags] = useState(false);
    const [newTag, setNewTag] = useState('');
    const tagDropdownRef = useRef(null);
    const currencySymbol = CURRENCY_MAP[userSettings?.currency_symbol] || userSettings?.currency_symbol || '$';

    // Update local state when prop changes
    useEffect(() => {
        setLocalName(bucket.name || '');
        const limitsMap = {};
        (bucket.limits || []).forEach(l => limitsMap[l.member_id] = l.amount);
        setLocalLimits(limitsMap);
    }, [bucket.name, bucket.limits]);

    // Handle Limit Change (Local)
    const handleLimitChange = (memberId, val) => {
        setLocalLimits(prev => ({ ...prev, [memberId]: val }));
    };

    // Handle Limit Blur (Save)
    const handleLimitBlur = (memberId) => {
        const val = parseFloat(localLimits[memberId]) || 0;
        // Construct new limits array
        const currentLimits = bucket.limits || [];
        const otherLimits = currentLimits.filter(l => l.member_id !== memberId);

        // Only update if changed
        const oldVal = currentLimits.find(l => l.member_id === memberId)?.amount || 0;

        if (val !== oldVal) {
            const newLimits = [
                ...otherLimits,
                { member_id: memberId, amount: val }
            ];
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, limits: newLimits } });
        }
    };

    const handleBlurName = () => {
        if (localName !== bucket.name && localName.trim()) {
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, name: localName } });
        }
    };

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

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (newTag.trim()) {
                const currentTags = bucket.tags || [];
                if (!currentTags.some(t => t.name.toLowerCase() === newTag.toLowerCase())) {
                    // Extract just names + new name
                    const newTagNames = [...currentTags.map(t => t.name), newTag.trim()];
                    updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, tags: newTagNames } });
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
            const newTagNames = [...currentTags.map(t => t.name), tagName];
            updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, tags: newTagNames } });
        }
    };

    const handleRemoveTag = (tagName) => {
        const newTagNames = (bucket.tags || [])
            .filter(t => t.name !== tagName)
            .map(t => t.name);
        updateBucketMutation.mutate({ id: bucket.id, data: { ...bucket, tags: newTagNames } });
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
    const isHidden = bucket.is_hidden;
    const rowBgClass = isParent
        ? `bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold ${isHidden ? 'opacity-50' : ''}`
        : `hover:bg-slate-50 dark:hover:bg-slate-800/50 ${bucket.is_transfer ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''} ${bucket.is_investment ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''} ${isHidden ? 'opacity-50' : ''}`;

    return (
        <tr
            ref={setNodeRef}
            style={sortableStyle}
            className={`border-b border-slate-100 dark:border-slate-700 transition group ${rowBgClass}`}
        >
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

            {/* Dynamic Member Columns */}
            {members.length > 0 ? (
                members.map(member => (
                    <td key={member.id} className="p-2 w-28">
                        <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{currencySymbol}</span>
                            <input
                                type="number"
                                className="w-full pl-6 pr-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-800 dark:text-slate-200 focus:border-indigo-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={localLimits[member.id] || 0}
                                onChange={(e) => handleLimitChange(member.id, e.target.value)}
                                onBlur={() => handleLimitBlur(member.id)}
                            />
                        </div>
                    </td>
                ))
            ) : (
                // Fallback if no members loaded yet (though query normally returns empty list)
                <td className="p-2 w-28">
                    <div className="relative">
                        <span className="text-xs text-slate-400">Loading...</span>
                    </div>
                </td>
            )}

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
                <div className="flex items-center gap-1">
                    {/* Drag Handle */}
                    <button
                        {...attributes}
                        {...listeners}
                        className="text-slate-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition p-0.5"
                        title="Drag to reorder"
                    >
                        <GripVertical size={14} />
                    </button>
                    {/* Hide/Show Toggle */}
                    <button
                        onClick={() => {
                            updateBucketMutation.mutate({ id: bucket.id, data: { is_hidden: !bucket.is_hidden } });
                        }}
                        className={`${bucket.is_hidden ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'} opacity-0 group-hover:opacity-100 transition`}
                        title={bucket.is_hidden ? 'Show in budget' : 'Hide from budget'}
                    >
                        {bucket.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    {/* Delete Button */}
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
                </div>
            </td>
        </tr>
    );
}
