import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import {
    Trophy, Star, Flame, Target, TrendingUp, PiggyBank,
    Award, Crown, Zap, Shield, Heart, Sparkles
} from 'lucide-react';

/**
 * AchievementsWidget - Celebrate financial milestones with badges
 */

const ACHIEVEMENTS = [
    // First Steps
    {
        id: 'first_budget',
        name: 'Budget Beginner',
        description: 'Created your first budget category',
        icon: Target,
        color: 'blue',
        check: (data) => data.buckets?.length > 0
    },
    {
        id: 'first_goal',
        name: 'Goal Setter',
        description: 'Created your first savings goal',
        icon: Star,
        color: 'yellow',
        check: (data) => data.goals?.length > 0
    },
    // Consistency
    {
        id: 'under_budget',
        name: 'Under Budget',
        description: 'Stayed under budget this month',
        icon: Shield,
        color: 'emerald',
        check: (data) => {
            const totals = data.totals || {};
            return totals.expenses <= totals.budget_total && totals.budget_total > 0;
        }
    },
    {
        id: 'saver_20',
        name: 'Super Saver',
        description: 'Saved 20%+ of your income',
        icon: PiggyBank,
        color: 'emerald',
        check: (data) => {
            const totals = data.totals || {};
            if (!totals.income || totals.income <= 0) return false;
            return ((totals.income - totals.expenses) / totals.income * 100) >= 20;
        }
    },
    // Net Worth Milestones
    {
        id: 'networth_10k',
        name: '$10K Club',
        description: 'Reached $10,000 net worth',
        icon: TrendingUp,
        color: 'indigo',
        check: (data) => data.netWorth >= 10000
    },
    {
        id: 'networth_50k',
        name: '$50K Club',
        description: 'Reached $50,000 net worth',
        icon: Award,
        color: 'violet',
        check: (data) => data.netWorth >= 50000
    },
    {
        id: 'networth_100k',
        name: 'Six Figures',
        description: 'Reached $100,000 net worth',
        icon: Crown,
        color: 'amber',
        check: (data) => data.netWorth >= 100000
    },
    // Engagement
    {
        id: 'power_user',
        name: 'Power User',
        description: 'Imported 100+ transactions',
        icon: Zap,
        color: 'orange',
        check: (data) => data.transactionCount >= 100
    },
    {
        id: 'category_master',
        name: 'Organized',
        description: 'Set up 10+ budget categories',
        icon: Sparkles,
        color: 'pink',
        check: (data) => (data.buckets?.length || 0) >= 10
    },
];

const colorClasses = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
    yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
    emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
    violet: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
    amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
    pink: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
};

export default function AchievementsWidget({ dashboardData, netWorth, goals }) {
    // Fetch additional data needed for achievements
    const { data: buckets = [] } = useQuery({
        queryKey: ['buckets'],
        queryFn: async () => (await api.get('/settings/buckets')).data
    });

    const { data: txStats } = useQuery({
        queryKey: ['transactionStats'],
        queryFn: async () => (await api.get('/analytics/transactions/stats')).data,
        retry: false
    });

    // Compute earned achievements
    const { earned, locked } = useMemo(() => {
        const data = {
            totals: dashboardData?.totals || {},
            buckets,
            goals: goals || [],
            netWorth: netWorth || 0,
            transactionCount: txStats?.total_count || 0
        };

        const earnedList = [];
        const lockedList = [];

        ACHIEVEMENTS.forEach(achievement => {
            try {
                if (achievement.check(data)) {
                    earnedList.push(achievement);
                } else {
                    lockedList.push(achievement);
                }
            } catch (e) {
                lockedList.push(achievement);
            }
        });

        return { earned: earnedList, locked: lockedList };
    }, [dashboardData, buckets, goals, netWorth, txStats]);

    if (earned.length === 0 && locked.length === 0) {
        return null;
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
                <Trophy className="text-amber-500" size={20} />
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Achievements</h2>
                <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
                    {earned.length} / {ACHIEVEMENTS.length} earned
                </span>
            </div>

            {/* Earned Achievements */}
            {earned.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                    {earned.map(achievement => {
                        const Icon = achievement.icon;
                        const colors = colorClasses[achievement.color];
                        return (
                            <div
                                key={achievement.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${colors.bg} ${colors.border} transition-transform hover:scale-105`}
                                title={achievement.description}
                            >
                                <Icon size={18} className={colors.text} />
                                <span className={`text-sm font-medium ${colors.text}`}>
                                    {achievement.name}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Locked Achievements (Next to Earn) */}
            {locked.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-400 mb-2">Next achievements to unlock:</p>
                    <div className="flex flex-wrap gap-2">
                        {locked.slice(0, 3).map(achievement => {
                            const Icon = achievement.icon;
                            return (
                                <div
                                    key={achievement.id}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 opacity-60"
                                    title={achievement.description}
                                >
                                    <Icon size={14} className="text-slate-400" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {achievement.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
