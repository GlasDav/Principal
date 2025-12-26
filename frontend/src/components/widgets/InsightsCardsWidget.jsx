import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import {
    TrendingUp, TrendingDown, Sparkles, Wallet, Target,
    ShoppingBag, Coffee, PiggyBank, AlertTriangle, Trophy,
    ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

/**
 * InsightsCardsWidget - Natural language comparative insights
 * Shows engaging cards with personalized spending insights
 */
export default function InsightsCardsWidget({ currentStart, currentEnd, spenderMode, formatCurrency }) {
    // Calculate previous month dates
    const previousDates = useMemo(() => {
        const start = new Date(currentStart);
        const end = new Date(currentEnd);
        start.setMonth(start.getMonth() - 1);
        end.setMonth(end.getMonth() - 1);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }, [currentStart, currentEnd]);

    // Fetch current and previous period data
    const { data: currentData } = useQuery({
        queryKey: ['insightsCurrent', currentStart, currentEnd, spenderMode],
        queryFn: async () => (await api.get('/analytics/dashboard', {
            params: { start_date: currentStart, end_date: currentEnd, spender: spenderMode }
        })).data
    });

    const { data: previousData } = useQuery({
        queryKey: ['insightsPrevious', previousDates.start, previousDates.end, spenderMode],
        queryFn: async () => (await api.get('/analytics/dashboard', {
            params: { start_date: previousDates.start, end_date: previousDates.end, spender: spenderMode }
        })).data
    });

    // Generate insights from data
    const insights = useMemo(() => {
        if (!currentData || !previousData) return [];

        const result = [];
        const current = currentData.totals || {};
        const previous = previousData.totals || {};
        const currentBuckets = currentData.buckets || [];
        const previousBuckets = previousData.buckets || [];

        // 1. Total spending insight
        if (current.expenses && previous.expenses) {
            const changePercent = ((current.expenses - previous.expenses) / previous.expenses * 100);
            const isDown = changePercent < 0;
            result.push({
                id: 'total-spending',
                type: isDown ? 'positive' : 'warning',
                icon: isDown ? TrendingDown : TrendingUp,
                title: isDown ? 'Spending Down!' : 'Spending Up',
                message: isDown
                    ? `You spent ${Math.abs(changePercent).toFixed(0)}% less than last month`
                    : `You spent ${changePercent.toFixed(0)}% more than last month`,
                detail: `${formatCurrency(current.expenses)} vs ${formatCurrency(previous.expenses)}`,
                color: isDown ? 'emerald' : 'amber'
            });
        }

        // 2. Savings rate insight
        if (current.income > 0) {
            const savingsRate = ((current.income - current.expenses) / current.income * 100);
            const isGood = savingsRate >= 20;
            result.push({
                id: 'savings-rate',
                type: isGood ? 'positive' : 'info',
                icon: PiggyBank,
                title: isGood ? 'Great Savings!' : 'Savings Rate',
                message: isGood
                    ? `You're saving ${savingsRate.toFixed(0)}% of your income`
                    : `Your savings rate is ${savingsRate.toFixed(0)}%`,
                detail: savingsRate >= 20 ? 'Above the recommended 20%' : 'Try aiming for 20%+',
                color: isGood ? 'emerald' : 'blue'
            });
        }

        // 3. Category changes - find biggest improvement and concern
        const categoryChanges = currentBuckets
            .filter(b => !b.is_transfer && !b.is_investment)
            .map(b => {
                const prevBucket = previousBuckets.find(p => p.id === b.id);
                const prevSpent = prevBucket?.spent || 0;
                const change = prevSpent > 0 ? ((b.spent - prevSpent) / prevSpent * 100) : 0;
                return { ...b, prevSpent, change };
            })
            .filter(b => Math.abs(b.change) > 10 && b.spent > 50); // Only significant changes

        // Find biggest decrease (improvement)
        const improvement = categoryChanges
            .filter(b => b.change < 0)
            .sort((a, b) => a.change - b.change)[0];

        if (improvement) {
            result.push({
                id: 'category-improvement',
                type: 'positive',
                icon: Trophy,
                title: `${improvement.name} Savings`,
                message: `You spent ${Math.abs(improvement.change).toFixed(0)}% less on ${improvement.name}`,
                detail: `${formatCurrency(improvement.spent)} vs ${formatCurrency(improvement.prevSpent)} last month`,
                color: 'emerald'
            });
        }

        // Find biggest increase (concern)
        const concern = categoryChanges
            .filter(b => b.change > 20) // More than 20% increase
            .sort((a, b) => b.change - a.change)[0];

        if (concern) {
            result.push({
                id: 'category-concern',
                type: 'warning',
                icon: AlertTriangle,
                title: `${concern.name} Alert`,
                message: `${concern.name} spending is up ${concern.change.toFixed(0)}%`,
                detail: `${formatCurrency(concern.spent)} this month`,
                color: 'amber'
            });
        }

        return result.slice(0, 4); // Max 4 insights
    }, [currentData, previousData, formatCurrency]);

    if (insights.length === 0) {
        return null; // Don't render if no insights
    }

    const colorClasses = {
        emerald: {
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
            border: 'border-emerald-200 dark:border-emerald-800',
            icon: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50',
            text: 'text-emerald-700 dark:text-emerald-300'
        },
        amber: {
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            border: 'border-amber-200 dark:border-amber-800',
            icon: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50',
            text: 'text-amber-700 dark:text-amber-300'
        },
        blue: {
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            border: 'border-blue-200 dark:border-blue-800',
            icon: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50',
            text: 'text-blue-700 dark:text-blue-300'
        },
        indigo: {
            bg: 'bg-indigo-50 dark:bg-indigo-900/20',
            border: 'border-indigo-200 dark:border-indigo-800',
            icon: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50',
            text: 'text-indigo-700 dark:text-indigo-300'
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Sparkles className="text-indigo-500" size={20} />
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Insights</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {insights.map(insight => {
                    const colors = colorClasses[insight.color] || colorClasses.blue;
                    const Icon = insight.icon;

                    return (
                        <div
                            key={insight.id}
                            className={`p-4 rounded-xl border ${colors.bg} ${colors.border} transition-all hover:scale-[1.02] hover:shadow-md`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${colors.icon}`}>
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`font-semibold text-sm ${colors.text}`}>
                                        {insight.title}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                                        {insight.message}
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                                        {insight.detail}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
