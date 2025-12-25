import React from 'react';
import { Link } from 'react-router-dom';
import { Target, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

/**
 * GoalsWidget - Displays top 3 financial goals with progress
 */
export default function GoalsWidget({ formatCurrency }) {
    const { data: goals = [], isLoading } = useQuery({
        queryKey: ['goals'],
        queryFn: async () => (await api.get('/goals')).data
    });

    // Show top 3 incomplete goals
    const topGoals = goals
        .filter(g => (g.current_amount || 0) < g.target_amount)
        .slice(0, 3);

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="animate-pulse h-32 bg-slate-100 dark:bg-slate-700 rounded-lg"></div>
            </div>
        );
    }

    if (topGoals.length === 0) {
        return (
            <Link to="/goals" className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow block">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-lg">
                        <Target size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Goals</h2>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    No active goals yet. Click to create your first goal!
                </p>
            </Link>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-lg">
                        <Target size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Goals</h2>
                </div>
                <Link to="/goals" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    View All →
                </Link>
            </div>
            <div className="space-y-4">
                {topGoals.map(goal => {
                    const current = goal.current_amount || 0;
                    const percent = Math.min((current / goal.target_amount) * 100, 100);

                    return (
                        <div key={goal.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-slate-800 dark:text-white text-sm">{goal.name}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {Math.round(percent)}%
                                </span>
                            </div>
                            <div className="relative h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div
                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
                                <span>{formatCurrency(current)}</span>
                                <span>{formatCurrency(goal.target_amount)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
