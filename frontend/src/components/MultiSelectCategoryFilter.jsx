import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X, Minus } from 'lucide-react';

/**
 * MultiSelectCategoryFilter - Dropdown with checkboxes for multiple category selection
 * Categories are grouped by Income, Non-Discretionary, Discretionary and sorted alphabetically
 */
export default function MultiSelectCategoryFilter({ categories = [], selectedIds = [], onChange, placeholder = "Filter by categories..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Flatten tree structure and sort by group, then alphabetically
    const flattenAndSort = (cats, depth = 0) => {
        const result = [];
        for (const cat of cats) {
            result.push({ ...cat, depth });
            if (cat.children && cat.children.length > 0) {
                result.push(...flattenAndSort(cat.children, depth + 1));
            }
        }
        return result;
    };

    const flattened = flattenAndSort(categories);

    // Group categories by their Root Parent (e.g. Food, Housing) instead of high-level Group
    const grouped = {};

    categories.forEach(root => {
        // Exclude Income categories from the filter
        if (root.group === 'Income' || root.name === 'Income') return;

        // Use the root category name as the group header
        const groupName = root.name;

        // Flatten the root and its children
        // We wrap root in array because flattenAndSort expects an array
        const branchItems = flattenAndSort([root]);

        grouped[groupName] = branchItems;
    });

    // Sort groups alphabetically
    const sortedGroups = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    const toggleCategory = (id) => {
        const newSelection = selectedIds.includes(id)
            ? selectedIds.filter(selectedId => selectedId !== id)
            : [...selectedIds, id];
        onChange(newSelection);
    };

    // NEW: Toggle entire group
    const toggleGroup = (group) => {
        const groupCategoryIds = grouped[group].map(cat => cat.id);
        const allSelected = groupCategoryIds.every(id => selectedIds.includes(id));

        if (allSelected) {
            // Deselect all in this group
            onChange(selectedIds.filter(id => !groupCategoryIds.includes(id)));
        } else {
            // Select all in this group
            const newSelection = [...new Set([...selectedIds, ...groupCategoryIds])];
            onChange(newSelection);
        }
    };

    // Check if group is fully/partially selected
    const getGroupSelectionState = (group) => {
        const groupCategoryIds = grouped[group].map(cat => cat.id);
        const selectedCount = groupCategoryIds.filter(id => selectedIds.includes(id)).length;

        if (selectedCount === 0) return 'none';
        if (selectedCount === groupCategoryIds.length) return 'all';
        return 'some';
    };

    const clearAll = () => {
        onChange([]);
    };

    const selectedCount = selectedIds.length;
    const selectedNames = flattened
        .filter(cat => selectedIds.includes(cat.id))
        .map(cat => cat.name)
        .join(', ');

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            >
                <span className="truncate">
                    {selectedCount === 0 ? (
                        <span className="text-slate-400">{placeholder}</span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-xs font-medium">
                                {selectedCount}
                            </span>
                            <span className="truncate">{selectedNames}</span>
                        </span>
                    )}
                </span>
                <div className="flex items-center gap-1 ml-2">
                    {selectedCount > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                clearAll();
                            }}
                            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition"
                        >
                            <X size={14} className="text-slate-400" />
                        </button>
                    )}
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-96 overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                    {sortedGroups.map(group => {
                        const selectionState = getGroupSelectionState(group);
                        return (
                            <div key={group}>
                                {/* Group Header - Clickable to select all */}
                                <label className="sticky top-0 bg-slate-100 dark:bg-slate-900 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition">
                                    {/* Group Checkbox */}
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={selectionState === 'all'}
                                            ref={(el) => {
                                                if (el) el.indeterminate = selectionState === 'some';
                                            }}
                                            onChange={() => toggleGroup(group)}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        {selectionState === 'all' && (
                                            <Check size={12} className="absolute text-white pointer-events-none" />
                                        )}
                                        {selectionState === 'some' && (
                                            <Minus size={12} className="absolute text-white pointer-events-none" />
                                        )}
                                    </div>

                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex-1">
                                        {group}
                                    </span>

                                    <span className="text-xs text-slate-400">
                                        {grouped[group].filter(cat => selectedIds.includes(cat.id)).length}/{grouped[group].length}
                                    </span>
                                </label>

                                {/* Category Items */}
                                {grouped[group].map(cat => {
                                    const isSelected = selectedIds.includes(cat.id);
                                    return (
                                        <label
                                            key={cat.id}
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition"
                                            style={{ paddingLeft: `${12 + cat.depth * 16}px` }}
                                        >
                                            {/* Checkbox */}
                                            <div className="relative flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleCategory(cat.id)}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                {isSelected && (
                                                    <Check size={12} className="absolute text-white pointer-events-none" />
                                                )}
                                            </div>

                                            {/* Category Name */}
                                            <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                                                {cat.depth > 0 && <span className="text-slate-400 mr-1">└</span>}
                                                {cat.name}
                                            </span>

                                            {/* Category Icon/Badge if needed */}
                                            {cat.children && cat.children.length > 0 && (
                                                <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                                                    {cat.children.length}
                                                </span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* Footer with actions */}
                    {selectedCount > 0 && (
                        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-3 py-2 flex justify-between items-center">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {selectedCount} selected
                            </span>
                            <button
                                onClick={clearAll}
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
