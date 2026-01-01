import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Target, TrendingUp, AlertTriangle, PiggyBank, Filter, BarChart3 } from 'lucide-react';
import CategoryProgressCard from './CategoryProgressCard';

import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

// Fetch budget progress data
const fetchBudgetProgress = async (months, spender) => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ months: months.toString(), spender });
    const response = await fetch(`${API_URL}/analytics/budget-progress?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch budget progress');
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
 * BudgetProgressTab - Main container for budget progress view
 */
export default function BudgetProgressTab({ userSettings }) {
    const [selectedMember, setSelectedMember] = useState('Combined');

    const formatCurrency = (val) => {
        return `$${Number(val || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    };

    const { data: progress, isLoading } = useQuery({
        queryKey: ['budget-progress', 6, selectedMember],
        queryFn: () => fetchBudgetProgress(6, selectedMember)
    });

    const { data: members = [] } = useQuery({
        queryKey: ['members'],
        queryFn: fetchMembers
    });

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
        );
    }

    const { period = {}, score = 0, summary = {}, categories = [] } = progress || {};

    // Group categories
    const needsCategories = categories.filter(c => c.group === 'Non-Discretionary');
    const wantsCategories = categories.filter(c => c.group === 'Discretionary');

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Filters:</span>
                </div>

                {/* Member Filter */}
                <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                    <option value="Combined">All Members</option>
                    <option value="Joint">Joint</option>
                    {members.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                </select>

                {/* History Range Removed (Fixed 6 months) */}

                {/* Period Label */}
                <div className="ml-auto text-sm text-slate-500 dark:text-slate-400">
                    <BarChart3 size={14} className="inline mr-1" />
                    {period.label || 'Current Month'}
                </div>
            </div>

            {/* Score Card */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Target size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Budget Score</h2>
                            <p className="text-white/70 text-sm">{period.label}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-bold">{score}</div>
                        <div className="text-white/70 text-sm">out of 100</div>
                    </div>
                </div>

                {/* Score Progress Bar */}
                <div className="h-3 bg-white/20 rounded-full overflow-hidden mb-4">
                    <div
                        className="h-full bg-white rounded-full transition-all duration-700"
                        style={{ width: `${score}%` }}
                    />
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/10 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-emerald-300 mb-1">
                            <TrendingUp size={16} />
                        </div>
                        <div className="text-2xl font-bold">{summary.on_track || 0}</div>
                        <div className="text-xs text-white/70">On Track</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-red-300 mb-1">
                            <AlertTriangle size={16} />
                        </div>
                        <div className="text-2xl font-bold">{summary.over_budget || 0}</div>
                        <div className="text-xs text-white/70">Over Budget</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-amber-300 mb-1">
                            <PiggyBank size={16} />
                        </div>
                        <div className="text-2xl font-bold">{formatCurrency(summary.total_saved || 0)}</div>
                        <div className="text-xs text-white/70">Potential Savings</div>
                    </div>
                </div>
            </div>

            {/* Wants (Discretionary) - Shown First */}
            {wantsCategories.length > 0 && (
                <section>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <span className="text-2xl">🎯</span>
                        Discretionary (Wants)
                        <span className="text-sm font-normal text-slate-500 ml-2">
                            {wantsCategories.length} categories
                        </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {wantsCategories.map(cat => (
                            <CategoryProgressCard
                                key={cat.id}
                                category={cat}
                                formatCurrency={formatCurrency}
                                showMembers={selectedMember === 'Combined'}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Needs (Non-Discretionary) */}
            {needsCategories.length > 0 && (
                <section>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <span className="text-2xl">🏠</span>
                        Non-Discretionary (Needs)
                        <span className="text-sm font-normal text-slate-500 ml-2">
                            {needsCategories.length} categories
                        </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {needsCategories.map(cat => (
                            <CategoryProgressCard
                                key={cat.id}
                                category={cat}
                                formatCurrency={formatCurrency}
                                showMembers={selectedMember === 'Combined'}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Empty State */}
            {categories.length === 0 && (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No budget categories yet</p>
                    <p className="text-sm">Add categories in the Categories tab to track your spending.</p>
                </div>
            )}
        </div>
    );
}
