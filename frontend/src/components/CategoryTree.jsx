import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Folder, FolderOpen } from 'lucide-react';
import { ICON_MAP } from '../utils/icons';

/**
 * CategoryTree - Renders hierarchical budget categories
 * 
 * Props:
 * - categories: Array of category objects with optional children array
 * - onSelect: Callback when a category is selected (id, category)
 * - selectedId: Currently selected category ID
 * - onAddChild: Callback to add sub-category (parentId)
 * - renderItem: Optional custom renderer for each item
 * - showAddButton: Show "Add Sub-Category" buttons
 * - indentPx: Pixels to indent each level (default: 24)
 */
export default function CategoryTree({
    categories = [],
    onSelect,
    selectedId,
    onAddChild,
    renderItem,
    showAddButton = false,
    indentPx = 24,
}) {
    const [expandedIds, setExpandedIds] = useState(new Set(
        // Auto-expand parents of selected item
        categories.map(c => c.id)
    ));

    const toggleExpand = (id, e) => {
        e.stopPropagation();
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    const renderCategory = (category, depth = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedIds.has(category.id);
        const isSelected = selectedId === category.id;
        const Icon = ICON_MAP[category.icon_name] || Folder;

        return (
            <div key={category.id}>
                {/* Category Row */}
                <div
                    className={`
                        flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all
                        ${isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                        }
                    `}
                    style={{ paddingLeft: `${12 + depth * indentPx}px` }}
                    onClick={() => onSelect?.(category.id, category)}
                >
                    {/* Expand/Collapse Toggle */}
                    {hasChildren ? (
                        <button
                            onClick={(e) => toggleExpand(category.id, e)}
                            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition"
                        >
                            {isExpanded ? (
                                <ChevronDown size={16} className="text-slate-400" />
                            ) : (
                                <ChevronRight size={16} className="text-slate-400" />
                            )}
                        </button>
                    ) : (
                        <span className="w-5" /> /* Spacer for alignment */
                    )}

                    {/* Icon */}
                    <div className={`p-1.5 rounded-lg ${hasChildren ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>
                        {hasChildren ? (
                            isExpanded ? <FolderOpen size={14} className="text-indigo-500" /> : <Folder size={14} className="text-indigo-500" />
                        ) : (
                            <Icon size={14} className={isSelected ? 'text-indigo-500' : 'text-slate-500'} />
                        )}
                    </div>

                    {/* Name */}
                    <span className={`flex-1 text-sm ${hasChildren ? 'font-medium' : ''}`}>
                        {category.name}
                    </span>

                    {/* Child count badge */}
                    {hasChildren && (
                        <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                            {category.children.length}
                        </span>
                    )}

                    {/* Add sub-category button */}
                    {showAddButton && depth === 0 && onAddChild && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAddChild(category.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition"
                            title="Add sub-category"
                        >
                            <Plus size={14} className="text-indigo-500" />
                        </button>
                    )}
                </div>

                {/* Children (if expanded) */}
                {hasChildren && isExpanded && (
                    <div className="relative">
                        {/* Vertical line connector */}
                        <div
                            className="absolute top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700"
                            style={{ left: `${20 + depth * indentPx}px` }}
                        />
                        {category.children.map(child => renderCategory(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-0.5">
            {categories.map(category => renderCategory(category, 0))}
        </div>
    );
}

/**
 * CategorySelect - Dropdown with hierarchical category selection
 * Used in transaction forms and filters
 */
export function CategorySelect({
    categories = [],
    value,
    onChange,
    placeholder = "Select category...",
    className = "",
}) {
    const flattenCategories = (cats, depth = 0) => {
        const result = [];
        for (const cat of cats) {
            result.push({ ...cat, depth });
            if (cat.children && cat.children.length > 0) {
                result.push(...flattenCategories(cat.children, depth + 1));
            }
        }
        return result;
    };

    const flattened = flattenCategories(categories);

    return (
        <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
            className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${className}`}
        >
            <option value="">{placeholder}</option>
            {flattened.map(cat => (
                <option key={cat.id} value={cat.id}>
                    {"  ".repeat(cat.depth)}{cat.depth > 0 ? "└ " : ""}{cat.name}
                </option>
            ))}
        </select>
    );
}
