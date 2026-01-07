import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Filter, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

// Fetch performance data
const fetchPerformanceData = async (spender) => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ spender });

    const response = await fetch(`${API_URL}/analytics/performance?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch performance data');
    return response.json();
};

// Fetch members for filter dropdown
const fetchMembers = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/settings/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return [];
    return response.json();
};

/**
 * Format currency value - compact format
 */
const formatCurrency = (val) => {
    if (val === 0 || val === null || val === undefined) return '-';
    const abs = Math.abs(val);
    if (abs >= 1000) {
        return `$${(abs / 1000).toFixed(1)}k`;
    }
    return `$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

/**
 * Get variance styling
 */
const getVarianceStyle = (variance, isBudget = false) => {
    if (variance === 0 || variance === null) return {};

    if (isBudget) {
        if (variance > 0) return { color: '#ef4444' }; // Over budget - red
        return { color: '#22c55e' }; // Under budget - green
    }

    if (variance > 0) return { color: '#f59e0b' }; // Above average - amber
    return { color: '#3b82f6' }; // Below average - blue
};

/**
 * Category row component (parent or child)
 */
function CategoryRow({ category, isChild, isExpanded, onToggle, months, selectedMonthIndex, onSelectMonth, showDifferentGroupIndicator }) {
    const hasChildren = category.children && category.children.length > 0;

    const selectedMonthSpend = category.spend_by_month[selectedMonthIndex] || 0;
    const varianceVsBudget = category.budget_limit > 0
        ? selectedMonthSpend - category.budget_limit
        : 0;
    const varianceVsAverage = category.average > 0
        ? selectedMonthSpend - category.average
        : 0;

    return (
        <tr className={`
            border-b border-slate-100 dark:border-slate-700/50
            ${isChild ? 'bg-slate-50/50 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-800'}
            hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors
        `}>
            {/* Category Name (sticky) */}
            <td className={`
                sticky left-0 z-10 px-2 py-2 whitespace-nowrap min-w-[140px]
                ${isChild ? 'pl-8 bg-slate-50/50 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-800'}
                ${!isChild && 'font-medium'}
            `}>
                <div className="flex items-center gap-1">
                    {!isChild && hasChildren && (
                        <button
                            onClick={onToggle}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronDown size={14} className="text-slate-400" />
                            ) : (
                                <ChevronRight size={14} className="text-slate-400" />
                            )}
                        </button>
                    )}
                    {!isChild && !hasChildren && <span className="w-4" />}
                    <span className={`text-xs text-slate-700 dark:text-slate-200 truncate max-w-[120px] ${showDifferentGroupIndicator ? 'italic' : ''}`} title={category.name}>
                        {category.name}
                        {showDifferentGroupIndicator && <span className="ml-1 text-[10px] text-slate-400">*</span>}
                    </span>
                </div>
            </td>

            {/* Monthly spend columns */}
            {months.map((month, idx) => {
                const spend = category.spend_by_month[idx] || 0;
                const isSelected = idx === selectedMonthIndex;
                const isOverBudget = category.budget_limit > 0 && spend > category.budget_limit;

                return (
                    <td
                        key={month}
                        onClick={() => onSelectMonth(idx)}
                        className={`
                            px-1 py-2 text-right text-xs cursor-pointer transition-colors
                            ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400 ring-inset' : ''}
                            ${isOverBudget && !isChild ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-slate-300'}
                            hover:bg-blue-50/50 dark:hover:bg-blue-900/20
                        `}
                    >
                        {formatCurrency(spend)}
                    </td>
                );
            })}

            {/* Budget limit */}
            <td className="px-1 py-2 text-right text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-700/30">
                {category.budget_limit > 0 ? formatCurrency(category.budget_limit) : '-'}
            </td>

            {/* Average */}
            <td className="px-1 py-2 text-right text-xs text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-700/30">
                {formatCurrency(category.average)}
            </td>

            {/* Variance vs Budget */}
            <td
                className="px-1 py-2 text-right text-xs bg-slate-50/50 dark:bg-slate-700/30"
                style={getVarianceStyle(varianceVsBudget, true)}
            >
                {category.budget_limit > 0 ? (
                    <span className="flex items-center justify-end gap-0.5">
                        {varianceVsBudget > 0 ? '+' : ''}{formatCurrency(varianceVsBudget)}
                        {varianceVsBudget > 0 && <TrendingUp size={10} />}
                        {varianceVsBudget < 0 && <TrendingDown size={10} />}
                    </span>
                ) : '-'}
            </td>

            {/* Variance vs Average */}
            <td
                className="px-1 py-2 text-right text-xs bg-slate-50/50 dark:bg-slate-700/30"
                style={getVarianceStyle(varianceVsAverage, false)}
            >
                {category.average > 0 ? (
                    <span>{varianceVsAverage > 0 ? '+' : ''}{formatCurrency(varianceVsAverage)}</span>
                ) : '-'}
            </td>
        </tr>
    );
}

/**
 * BudgetPerformanceTab - Spreadsheet view of budget performance
 */
export default function BudgetPerformanceTab({ userSettings }) {
    const [selectedMember, setSelectedMember] = useState('Combined');
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(null);
    const [expandedCategories, setExpandedCategories] = useState(new Set());

    const { data: performance, isLoading } = useQuery({
        queryKey: ['performance', selectedMember],
        queryFn: () => fetchPerformanceData(selectedMember)
    });

    const { data: members = [] } = useQuery({
        queryKey: ['members'],
        queryFn: fetchMembers
    });

    useEffect(() => {
        if (performance && selectedMonthIndex === null) {
            setSelectedMonthIndex(performance.current_month_index || performance.months.length - 1);
        }
    }, [performance, selectedMonthIndex]);

    const toggleCategory = (categoryId) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    };

    // Extract data from performance (with safe defaults)
    const months = performance?.months || [];
    const categories = performance?.categories || [];
    const currentMonthIdx = selectedMonthIndex ?? (months.length - 1);

    // Process categories: separate children that belong to different groups
    // NOTE: This useMemo MUST be before any early returns to satisfy React hooks rules
    const processedCategories = useMemo(() => {
        const needsParents = [];
        const wantsParents = [];
        const needsOrphans = [];
        const wantsOrphans = [];

        for (const cat of categories) {
            const parentGroup = cat.group;

            const sameGroupChildren = cat.children?.filter(c => !c.group || c.group === parentGroup) || [];
            const diffGroupChildren = cat.children?.filter(c => c.group && c.group !== parentGroup) || [];

            const processedParent = { ...cat, children: sameGroupChildren };

            if (parentGroup === 'Non-Discretionary') {
                needsParents.push(processedParent);
                diffGroupChildren.forEach(child => {
                    wantsOrphans.push({ ...child, isOrphan: true, parentName: cat.name });
                });
            } else {
                wantsParents.push(processedParent);
                diffGroupChildren.forEach(child => {
                    needsOrphans.push({ ...child, isOrphan: true, parentName: cat.name });
                });
            }
        }

        return {
            needs: [...needsParents, ...needsOrphans.map(o => ({ ...o, children: [] }))],
            wants: [...wantsParents, ...wantsOrphans.map(o => ({ ...o, children: [] }))]
        };
    }, [categories]);

    // Loading check AFTER all hooks
    if (isLoading) {
        return (
            <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Member:</span>
                </div>

                <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                    <option value="Combined">Total Household</option>
                    <option value="Joint">Joint</option>
                    {members.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                </select>

                <div className="ml-auto text-xs text-slate-400">
                    Click month to view variance • <span className="italic">*</span> = child in different group
                </div>
            </div>

            {/* Spreadsheet Table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                                <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-700/50 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase min-w-[140px]">
                                    Category
                                </th>
                                {months.map((month, idx) => (
                                    <th
                                        key={month}
                                        onClick={() => setSelectedMonthIndex(idx)}
                                        className={`
                                            px-1 py-2 text-right text-[10px] font-semibold uppercase cursor-pointer min-w-[50px]
                                            ${idx === currentMonthIdx
                                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400 ring-inset'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}
                                        `}
                                    >
                                        {month}
                                    </th>
                                ))}
                                <th className="px-1 py-2 text-right text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase bg-slate-200/50 dark:bg-slate-600/50 min-w-[50px]">
                                    Bud
                                </th>
                                <th className="px-1 py-2 text-right text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase bg-slate-200/50 dark:bg-slate-600/50 min-w-[50px]">
                                    Avg
                                </th>
                                <th className="px-1 py-2 text-right text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase bg-slate-200/50 dark:bg-slate-600/50 min-w-[55px]">
                                    ±Bud
                                </th>
                                <th className="px-1 py-2 text-right text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase bg-slate-200/50 dark:bg-slate-600/50 min-w-[55px]">
                                    ±Avg
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Non-Discretionary (Needs) */}
                            {processedCategories.needs.length > 0 && (
                                <>
                                    <tr className="bg-emerald-50/50 dark:bg-emerald-900/20">
                                        <td
                                            colSpan={months.length + 5}
                                            className="sticky left-0 z-10 px-2 py-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase bg-emerald-50/50 dark:bg-emerald-900/20"
                                        >
                                            Non-Discretionary (Needs)
                                        </td>
                                    </tr>
                                    {processedCategories.needs.map(category => (
                                        <React.Fragment key={category.id}>
                                            <CategoryRow
                                                category={category}
                                                isChild={category.isOrphan || false}
                                                isExpanded={expandedCategories.has(category.id)}
                                                onToggle={() => toggleCategory(category.id)}
                                                months={months}
                                                selectedMonthIndex={currentMonthIdx}
                                                onSelectMonth={setSelectedMonthIndex}
                                                showDifferentGroupIndicator={category.isOrphan}
                                            />
                                            {expandedCategories.has(category.id) && category.children?.map(child => (
                                                <CategoryRow
                                                    key={child.id}
                                                    category={child}
                                                    isChild={true}
                                                    isExpanded={false}
                                                    onToggle={() => { }}
                                                    months={months}
                                                    selectedMonthIndex={currentMonthIdx}
                                                    onSelectMonth={setSelectedMonthIndex}
                                                    showDifferentGroupIndicator={false}
                                                />
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </>
                            )}

                            {/* Discretionary (Wants) */}
                            {processedCategories.wants.length > 0 && (
                                <>
                                    <tr className="bg-purple-50/50 dark:bg-purple-900/20">
                                        <td
                                            colSpan={months.length + 5}
                                            className="sticky left-0 z-10 px-2 py-1.5 text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase bg-purple-50/50 dark:bg-purple-900/20"
                                        >
                                            Discretionary (Wants)
                                        </td>
                                    </tr>
                                    {processedCategories.wants.map(category => (
                                        <React.Fragment key={category.id}>
                                            <CategoryRow
                                                category={category}
                                                isChild={category.isOrphan || false}
                                                isExpanded={expandedCategories.has(category.id)}
                                                onToggle={() => toggleCategory(category.id)}
                                                months={months}
                                                selectedMonthIndex={currentMonthIdx}
                                                onSelectMonth={setSelectedMonthIndex}
                                                showDifferentGroupIndicator={category.isOrphan}
                                            />
                                            {expandedCategories.has(category.id) && category.children?.map(child => (
                                                <CategoryRow
                                                    key={child.id}
                                                    category={child}
                                                    isChild={true}
                                                    isExpanded={false}
                                                    onToggle={() => { }}
                                                    months={months}
                                                    selectedMonthIndex={currentMonthIdx}
                                                    onSelectMonth={setSelectedMonthIndex}
                                                    showDifferentGroupIndicator={false}
                                                />
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Empty State */}
            {categories.length === 0 && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <p className="text-sm font-medium">No budget categories yet</p>
                    <p className="text-xs">Add categories in the Categories tab to track performance.</p>
                </div>
            )}
        </div>
    );
}
