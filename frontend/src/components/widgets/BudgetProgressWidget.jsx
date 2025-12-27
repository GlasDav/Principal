import React from 'react';
import { Link } from 'react-router-dom';
import { Utensils, ShoppingBag, RefreshCw, Wallet } from 'lucide-react';
import { ICON_MAP } from '../../utils/icons';

/**
 * BudgetProgressWidget - Displays budget progress cards for Needs and Wants
 */
export default function BudgetProgressWidget({ buckets = [], formatCurrency, startDate, endDate }) {
    const needsBuckets = buckets.filter(b => b.group === "Non-Discretionary");
    const wantsBuckets = buckets.filter(b => (b.group || "Discretionary") === "Discretionary");

    const renderBucketCard = (bucket) => {
        const Icon = ICON_MAP[bucket.icon] || Wallet;

        // Percentages
        const percentSpent = bucket.limit > 0 ? (bucket.spent / bucket.limit) * 100 : 0;
        const upcoming = bucket.upcoming_recurring || 0;
        const percentUpcoming = bucket.limit > 0 ? (upcoming / bucket.limit) * 100 : 0;

        let barColor = "bg-emerald-500";
        let upcomingColor = "bg-emerald-300 dark:bg-emerald-800";

        if (bucket.percent > 90) {
            barColor = "bg-amber-500";
            upcomingColor = "bg-amber-300 dark:bg-amber-800";
        }
        if (bucket.percent > 100) {
            barColor = "bg-red-500";
            upcomingColor = "bg-red-300 dark:bg-red-800";
        }

        const effectiveRemaining = bucket.effective_remaining !== undefined ? bucket.effective_remaining : (bucket.limit - bucket.spent - upcoming);

        return (
            <Link
                to={`/transactions?bucket_id=${bucket.id}&start_date=${startDate}&end_date=${endDate}`}
                key={bucket.id}
                className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow group"
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
                            <Icon size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                {bucket.name}
                                {bucket.is_rollover && <RefreshCw size={12} className="text-indigo-500" title="Rollover Fund" />}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {bucket.is_over
                                    ? "Over Budget"
                                    : upcoming > 0
                                        ? `${formatCurrency(effectiveRemaining)} effective left`
                                        : `${formatCurrency(bucket.remaining)} left`
                                }
                            </p>
                        </div>
                    </div>
                    <div className={`text-sm font-bold ${bucket.is_over ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {Math.round(bucket.percent)}%
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    {/* Spent */}
                    <div
                        className={`h-full rounded-l-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(percentSpent, 100)}%` }}
                    />
                    {/* Upcoming */}
                    {percentUpcoming > 0 && (
                        <div
                            className={`h-full transition-all duration-500 ${upcomingColor} relative`}
                            style={{
                                width: `${Math.min(percentUpcoming, 100 - Math.min(percentSpent, 100))}%`,
                                backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)',
                                backgroundSize: '0.75rem 0.75rem'
                            }}
                            title={`Upcoming: ${formatCurrency(upcoming)}`}
                        />
                    )}
                </div>

                <div className="flex justify-between mt-3 text-sm">
                    <span className="text-slate-500 dark:text-slate-400 font-medium flex gap-1">
                        {formatCurrency(bucket.spent)}
                        {upcoming > 0 && <span className="text-slate-400 opacity-75">+ {formatCurrency(upcoming)}</span>}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">Of {formatCurrency(bucket.limit)}</span>
                </div>
            </Link>
        );
    };

    return (
        <div className="space-y-8">
            {/* Needs Section */}
            <section>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><Utensils size={18} /></span>
                    Non-Discretionary (Needs)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {needsBuckets.map(renderBucketCard)}
                </div>
            </section>

            {/* Wants Section */}
            <section>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <span className="p-1.5 bg-pink-100 text-pink-600 rounded-lg"><ShoppingBag size={18} /></span>
                    Discretionary (Wants)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {wantsBuckets.map(renderBucketCard)}
                </div>
            </section>
        </div>
    );
}
