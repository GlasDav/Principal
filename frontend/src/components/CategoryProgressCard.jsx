import React from 'react';
import { TrendingUp, TrendingDown, Minus, Users, Wallet } from 'lucide-react';
import { ICON_MAP } from '../utils/icons';
import SparklineChart from './SparklineChart';

/**
 * CategoryProgressCard - Shows budget progress for a single category
 * with sparkline history and member breakdown
 */
export default function CategoryProgressCard({
    category,
    formatCurrency = (v) => `$${v?.toLocaleString() || 0}`,
    showMembers = true
}) {
    const Icon = ICON_MAP[category.icon] || Wallet;

    // Progress bar color based on status
    const getBarColor = () => {
        switch (category.status) {
            case 'over': return 'bg-red-500';
            case 'warning': return 'bg-amber-500';
            case 'on_track': return 'bg-emerald-500';
            default: return 'bg-slate-400';
        }
    };

    // Status badge
    const getStatusBadge = () => {
        switch (category.status) {
            case 'over':
                return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">Over Budget</span>;
            case 'warning':
                return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Near Limit</span>;
            case 'on_track':
                return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">On Track</span>;
            default:
                return null;
        }
    };

    // Trend icon
    const TrendIcon = category.trend > 5 ? TrendingUp : category.trend < -5 ? TrendingDown : Minus;
    const trendColor = category.trend > 5
        ? 'text-red-500'
        : category.trend < -5
            ? 'text-emerald-500'
            : 'text-slate-400';

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        <Icon size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white">{category.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{category.group}</p>
                    </div>
                </div>
                {getStatusBadge()}
            </div>

            {/* Progress Section */}
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {formatCurrency(category.spent)}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                        of {formatCurrency(category.limit)}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
                    {/* Spent Bar */}
                    <div
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${getBarColor()} z-10`}
                        style={{ width: `${Math.min(category.percent, 100)}%` }}
                    />

                    {/* Upcoming Recurring Bar (Hashed) */}
                    {category.upcoming > 0 && (
                        <div
                            className={`absolute top-0 h-full transition-all duration-500 ${getBarColor()} opacity-60`}
                            style={{
                                left: `${Math.min(category.percent, 100)}%`,
                                width: `${Math.min((category.upcoming / category.limit) * 100, 100 - Math.min(category.percent, 100))}%`,
                                backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,0.5) 25%,transparent 25%,transparent 50%,rgba(255,255,255,0.5) 50%,rgba(255,255,255,0.5) 75%,transparent 75%,transparent)',
                                backgroundSize: '8px 8px'
                            }}
                            title={`Upcoming: $${category.upcoming.toLocaleString()}`}
                        />
                    )}
                </div>

                {/* Percentage and Remaining */}
                <div className="flex justify-between items-center mt-1.5">
                    <span className={`text-sm font-bold ${category.status === 'over' ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'
                        }`}>
                        {Math.round(category.percent)}%
                    </span>
                    <span className="text-xs text-slate-500">
                        {category.remaining > 0
                            ? `${formatCurrency(category.remaining)} left`
                            : category.status === 'over'
                                ? `${formatCurrency(category.spent - category.limit)} over`
                                : 'No limit set'
                        }
                    </span>
                </div>
            </div>

            {/* Sparkline History */}
            {category.history && category.history.length > 0 && (
                <div className="mb-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            History ({category.history.length}mo)
                        </span>
                        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
                            <TrendIcon size={12} />
                            <span>{Math.abs(category.trend)}% vs avg</span>
                        </div>
                    </div>
                    <SparklineChart data={category.history} height={64} />
                </div>
            )}

            {/* Member Breakdown - Individual progress bars (skip if only Joint) */}
            {showMembers && category.by_member && category.by_member.length > 0 &&
                !(category.by_member.length === 1 && category.by_member[0].name === 'Joint') && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-3">
                            <Users size={12} />
                            <span>Spending by Member</span>
                        </div>

                        {/* Individual progress bar for each member */}
                        <div className="space-y-3">
                            {category.by_member.map((member, idx) => {
                                // Use member's color from backend, or fallback
                                const memberColor = member.color || '#6366f1';
                                const limitPercent = Math.min(member.limit_percent || 0, 100);
                                const isOver = (member.limit_percent || 0) > 100;

                                // Determine bar color based on performance
                                const getBarClass = () => {
                                    if (isOver) return 'bg-red-500';
                                    if (limitPercent > 80) return 'bg-amber-500';
                                    return '';  // Will use custom color
                                };
                                const barClass = getBarClass();

                                return (
                                    <div key={idx}>
                                        {/* Member name and stats row */}
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-2.5 h-2.5 rounded-full"
                                                    style={{ backgroundColor: memberColor }}
                                                />
                                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                                    {member.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium ${isOver ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                                    {formatCurrency(member.amount)}
                                                </span>
                                                <span className="text-slate-400 dark:text-slate-500">
                                                    / {formatCurrency(member.limit)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                                                style={{
                                                    width: `${Math.min(limitPercent, 100)}%`,
                                                    backgroundColor: barClass ? undefined : memberColor
                                                }}
                                            />
                                        </div>

                                        {/* Percentage indicator */}
                                        <div className="flex justify-end mt-0.5">
                                            <span className={`text-[10px] font-medium ${isOver ? 'text-red-500' :
                                                limitPercent > 80 ? 'text-amber-500' :
                                                    'text-slate-400'
                                                }`}>
                                                {Math.round(member.limit_percent || 0)}% of budget
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
        </div>
    );
}
