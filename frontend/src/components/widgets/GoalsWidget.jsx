import React from 'react';
import { Link } from 'react-router-dom';
import { Target, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

/**
 * GoalsWidget - Displays top 3 financial goals with progress
 */
export default function GoalsWidget({ formatCurrency }) {
    const { data: goalsRaw = [], isLoading } = useQuery({
        queryKey: ['goals'],
        queryFn: async () => (await api.get('/goals')).data
    });

    // Defensive: ensure goals is always an array to prevent .filter() crashes
    const goals = Array.isArray(goalsRaw) ? goalsRaw : [];

    // Show top 3 incomplete goals
    const topGoals = goals
        .filter(g => (g.current_amount || 0) < g.target_amount)
        .slice(0, 3);

    if (isLoading) {
        return (
            <div className="bg-card dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-border dark:border-border-dark">
                <div className="animate-pulse h-32 bg-surface dark:bg-card-dark rounded-lg"></div>
            </div>
        );
    }

    if (topGoals.length === 0) {
        return (
            <Link to="/goals" className="bg-card dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-border dark:border-border-dark hover:shadow-md transition-shadow block">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-lg">
                        <Target size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">Goals</h2>
                </div>
                <p className="text-text-muted dark:text-text-muted-dark text-sm">
                    No active goals yet. Click to create your first goal!
                </p>
            </Link>
        );
    }

    return (
        <div className="bg-card dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-border dark:border-border-dark">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-lg">
                        <Target size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">Goals</h2>
                </div>
                <Link to="/goals" className="text-sm text-primary hover:text-primary-hover font-medium">
                    View All →
                </Link>
            </div>
            <div className="space-y-4">
                {topGoals.map(goal => {
                    const current = goal.current_amount || 0;
                    const percent = Math.min((current / goal.target_amount) * 100, 100);

                    return (
                        <div key={goal.id} className="p-3 bg-surface dark:bg-card-dark/50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-text-primary dark:text-text-primary-dark text-sm">{goal.name}</span>
                                <span className="text-xs text-text-muted dark:text-text-muted-dark">
                                    {Math.round(percent)}%
                                </span>
                            </div>
                            <div className="relative h-2 bg-surface dark:bg-surface-dark rounded-full overflow-hidden">
                                <div
                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-text-muted dark:text-text-muted-dark">
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
