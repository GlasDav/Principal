import React, { useState, useMemo } from 'react';
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
 * Format currency value
 */
const formatCurrency = (val) => {
    if (val === 0 || val === null || val === undefined) return '-';
    return `$${Math.abs(val).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

/**
 * Get variance styling
 */
const getVarianceStyle = (variance, isBudget = false) => {
    if (variance === 0 || variance === null) return {};

    // For budget variance: negative = under (good), positive = over (bad)
    // For average variance: just show direction
    if (isBudget) {
        if (variance > 0) return { color: '#ef4444', fontWeight: 500 }; // Over budget - red
        return { color: '#22c55e', fontWeight: 500 }; // Under budget - green
    }

    // Average variance styling (more neutral)
    if (variance > 0) return { color: '#f59e0b' }; // Above average - amber
    return { color: '#3b82f6' }; // Below average - blue
};

/**
 * Category row component (parent or child)
 */
function CategoryRow({ category, isChild, isExpanded, onToggle, months, selectedMonthIndex, onSelectMonth }) {
    const hasChildren = category.children && category.children.length > 0;

    // Get the variance values for the selected month
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
                sticky left-0 z-10 px-4 py-3 whitespace-nowrap
                ${isChild ? 'pl-10 bg-slate-50/50 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-800'}
                ${!isChild && 'font-semibold'}
            `}>
                <div className="flex items-center gap-2">
                    {!isChild && hasChildren && (
                        <button
                            onClick={onToggle}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronDown size={16} className="text-slate-400" />
                            ) : (
                                <ChevronRight size={16} className="text-slate-400" />
                            )}
                        </button>
                    )}
                    {!isChild && !hasChildren && <span className="w-5" />}
                    <span className="text-sm text-slate-700 dark:text-slate-200">
                        {category.icon && <span className="mr-1.5">{category.icon}</span>}
                        {category.name}
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
                            px-3 py-3 text-right text-sm cursor-pointer transition-colors
                            ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400 ring-inset' : ''}
                            ${isOverBudget && !isChild ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-slate-300'}
                            hover:bg-blue-50/50 dark:hover:bg-blue-900/20
                        `}
                    >
                        {formatCurrency(spend)}
                    </td>
                );
            })}

            {/* Budget limit */}
            <td className="px-3 py-3 text-right text-sm text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-700/30">
                {category.budget_limit > 0 ? formatCurrency(category.budget_limit) : '-'}
            </td>

            {/* Average */}
            <td className="px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-700/30">
                {formatCurrency(category.average)}
            </td>

            {/* Variance vs Budget */}
            <td
                className="px-3 py-3 text-right text-sm bg-slate-50/50 dark:bg-slate-700/30"
                style={getVarianceStyle(varianceVsBudget, true)}
            >
                {category.budget_limit > 0 ? (
                    <span className="flex items-center justify-end gap-1">
                        {varianceVsBudget > 0 ? '+' : ''}{formatCurrency(varianceVsBudget)}
                        {varianceVsBudget > 0 && <TrendingUp size={14} />}
                        {varianceVsBudget < 0 && <TrendingDown size={14} />}
                        {varianceVsBudget === 0 && <Minus size={14} />}
                    </span>
                ) : '-'}
            </td>

            {/* Variance vs Average */}
            <td
                className="px-3 py-3 text-right text-sm bg-slate-50/50 dark:bg-slate-700/30"
                style={getVarianceStyle(varianceVsAverage, false)}
            >
                {category.average > 0 ? (
                    <span className="flex items-center justify-end gap-1">
                        {varianceVsAverage > 0 ? '+' : ''}{formatCurrency(varianceVsAverage)}
                    </span>
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

    // Fetch data
    const { data: performance, isLoading } = useQuery({
        queryKey: ['performance', selectedMember],
        queryFn: () => fetchPerformanceData(selectedMember)
    });

    const { data: members = [] } = useQuery({
        queryKey: ['members'],
        queryFn: fetchMembers
    });

    // Set default selected month to current (last) month
    useMemo(() => {
        if (performance && selectedMonthIndex === null) {
            setSelectedMonthIndex(performance.current_month_index || performance.months.length - 1);
        }
    }, [performance, selectedMonthIndex]);

    // Toggle category expansion
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

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
        );
    }

    const { months = [], categories = [] } = performance || {};
    const currentMonthIdx = selectedMonthIndex ?? (months.length - 1);

    // Group categories
    const needsCategories = categories.filter(c => c.group === 'Non-Discretionary');
    const wantsCategories = categories.filter(c => c.group === 'Discretionary');

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Member:</span>
                </div>

                <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                    <option value="Combined">Total Household</option>
                    <option value="Joint">Joint</option>
                    {members.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                </select>

                <div className="ml-auto text-sm text-slate-500 dark:text-slate-400">
                    Click a month column to view its variance
                </div>
            </div>

            {/* Spreadsheet Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-max">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                                <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-700/50 px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                    Category
                                </th>
                                {months.map((month, idx) => (
                                    <th
                                        key={month}
                                        onClick={() => setSelectedMonthIndex(idx)}
                                        className={`
                                            px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer
                                            ${idx === currentMonthIdx
                                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400 ring-inset'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}
                                        `}
                                    >
                                        {month}
                                    </th>
                                ))}
                                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-200/50 dark:bg-slate-600/50">
                                    Budget
                                </th>
                                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-200/50 dark:bg-slate-600/50">
                                    Avg
                                </th>
                                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-200/50 dark:bg-slate-600/50">
                                    vs Budget
                                </th>
                                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-200/50 dark:bg-slate-600/50">
                                    vs Avg
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Non-Discretionary (Needs) */}
                            {needsCategories.length > 0 && (
                                <>
                                    <tr className="bg-emerald-50/50 dark:bg-emerald-900/20">
                                        <td
                                            colSpan={months.length + 5}
                                            className="sticky left-0 z-10 px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50/50 dark:bg-emerald-900/20"
                                        >
                                            🏠 Non-Discretionary (Needs)
                                        </td>
                                    </tr>
                                    {needsCategories.map(category => (
                                        <React.Fragment key={category.id}>
                                            <CategoryRow
                                                category={category}
                                                isChild={false}
                                                isExpanded={expandedCategories.has(category.id)}
                                                onToggle={() => toggleCategory(category.id)}
                                                months={months}
                                                selectedMonthIndex={currentMonthIdx}
                                                onSelectMonth={setSelectedMonthIndex}
                                            />
                                            {/* Children (if expanded) */}
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
                                                />
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </>
                            )}

                            {/* Discretionary (Wants) */}
                            {wantsCategories.length > 0 && (
                                <>
                                    <tr className="bg-purple-50/50 dark:bg-purple-900/20">
                                        <td
                                            colSpan={months.length + 5}
                                            className="sticky left-0 z-10 px-4 py-2 text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider bg-purple-50/50 dark:bg-purple-900/20"
                                        >
                                            🎯 Discretionary (Wants)
                                        </td>
                                    </tr>
                                    {wantsCategories.map(category => (
                                        <React.Fragment key={category.id}>
                                            <CategoryRow
                                                category={category}
                                                isChild={false}
                                                isExpanded={expandedCategories.has(category.id)}
                                                onToggle={() => toggleCategory(category.id)}
                                                months={months}
                                                selectedMonthIndex={currentMonthIdx}
                                                onSelectMonth={setSelectedMonthIndex}
                                            />
                                            {/* Children (if expanded) */}
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
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <p className="text-lg font-medium">No budget categories yet</p>
                    <p className="text-sm">Add categories in the Categories tab to track your spending performance.</p>
                </div>
            )}
        </div>
    );
}
