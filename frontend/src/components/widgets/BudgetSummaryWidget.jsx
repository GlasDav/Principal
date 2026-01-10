import React from 'react';
import { Link } from 'react-router-dom';
import { PiggyBank, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';

/**
 * BudgetSummaryWidget - Compact budget health indicator for Dashboard
 * Shows overall status and links to full Budget page
 */
export default function BudgetSummaryWidget({ buckets: bucketsProp = [], formatCurrency }) {
    // Defensive: ensure buckets is always an array to prevent .filter() crashes
    const buckets = Array.isArray(bucketsProp) ? bucketsProp : [];

    // State for toggling rollover inclusion
    const [showRollover, setShowRollover] = React.useState(false);

    // Calculate budget health metrics
    // Exclude: transfers, investments, income, AND parent categories (to avoid double-counting)
    const budgetCategories = buckets.filter(b =>
        !b.is_transfer &&
        !b.is_investment &&
        b.limit > 0 &&
        b.group !== 'Income' &&
        !b.is_parent  // Exclude parent categories - they roll up child limits
    );
    const overBudget = budgetCategories.filter(b => b.percent > 100);
    const nearLimit = budgetCategories.filter(b => b.percent > 80 && b.percent <= 100);
    const healthy = budgetCategories.filter(b => b.percent <= 80);

    // Calculate Totals based on toggle
    const totalLimitStrict = budgetCategories.reduce((sum, b) => sum + (b.limit || 0), 0);
    const totalRollover = budgetCategories.reduce((sum, b) => sum + (b.rollover_amount || 0), 0);

    // Effective budget = Limit + (Rollover if toggled)
    const totalBudget = showRollover ? (totalLimitStrict + totalRollover) : totalLimitStrict;

    const totalSpent = budgetCategories.reduce((sum, b) => sum + (b.spent || 0), 0);
    const totalUpcoming = budgetCategories.reduce((sum, b) => sum + (b.upcoming_recurring || 0), 0);

    // Percentages
    const percentSpent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const percentUpcoming = totalBudget > 0 ? (totalUpcoming / totalBudget) * 100 : 0;

    // Status color
    let statusColor = 'emerald';
    let statusText = 'On Track';
    let StatusIcon = CheckCircle;

    if (overBudget.length > 0) {
        statusColor = 'red';
        statusText = `${overBudget.length} Over Budget`;
        StatusIcon = AlertCircle;
    } else if (nearLimit.length >= 3) {
        statusColor = 'amber';
        statusText = 'Approaching Limits';
        StatusIcon = AlertCircle;
    }

    const colorClasses = {
        emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', upcoming: 'bg-emerald-300 dark:bg-emerald-800' },
        amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', upcoming: 'bg-amber-300 dark:bg-amber-800' },
        red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', upcoming: 'bg-red-300 dark:bg-red-800' },
    };

    const colors = colorClasses[statusColor];

    return (
        <div className="block bg-card dark:bg-card-dark p-5 rounded-2xl shadow-sm border border-border dark:border-border-dark hover:shadow-md transition-shadow group relative">
            <Link to="/budget" className="block">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${colors.bg}`}>
                            <PiggyBank className={colors.text} size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-text-primary dark:text-text-primary-dark">Budget</h3>
                            <div className="flex items-center gap-1.5">
                                <StatusIcon size={14} className={colors.text} />
                                <span className={`text-sm font-medium ${colors.text}`}>{statusText}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>

            {/* Toggle Button Positioned Absolute Top Right */}
            <button
                onClick={(e) => {
                    e.preventDefault();
                    setShowRollover(!showRollover);
                }}
                className={`absolute top-5 right-5 text-xs font-medium px-2 py-1 rounded-full transition-colors ${showRollover
                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light'
                    : 'bg-surface text-text-muted dark:bg-card-dark dark:text-text-muted-dark hover:bg-surface/80 dark:hover:bg-card-dark/80'
                    }`}
                title="Include accumulated unspent budget (rollovers) in total"
            >
                {showRollover ? 'Include Rollovers' : 'Exclude Rollovers'}
            </button>

            <Link to="/budget" className="block">
                {/* Progress bar */}
                <div className="relative h-2.5 bg-surface dark:bg-card-dark rounded-full overflow-hidden mb-3 flex">
                    {/* Spent */}
                    <div
                        className={`h-full rounded-l-full transition-all duration-500 ${colors.bar}`}
                        style={{ width: `${Math.min(percentSpent, 100)}%` }}
                    />
                    {/* Upcoming (Hashed/Patterned) */}
                    {percentUpcoming > 0 && (
                        <div
                            className={`h-full transition-all duration-500 ${colors.upcoming} relative`}
                            style={{
                                width: `${Math.min(percentUpcoming, 100 - Math.min(percentSpent, 100))}%`,
                                backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)',
                                backgroundSize: '1rem 1rem'
                            }}
                            title={`Upcoming: ${formatCurrency(totalUpcoming)}`}
                        />
                    )}
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-text-muted dark:text-text-muted-dark flex gap-2">
                        <span>{formatCurrency(totalSpent)} spent</span>
                        {totalUpcoming > 0 && (
                            <span className="text-text-muted dark:text-text-muted-dark opacity-75 hidden sm:inline">
                                + {formatCurrency(totalUpcoming)} pending
                            </span>
                        )}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 text-right">
                        {formatCurrency(totalBudget)} {showRollover ? 'available' : 'budgeted'}
                    </span>
                </div>

                {/* Quick stats */}
                {budgetCategories.length > 0 && (
                    <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-slate-500">{healthy.length} healthy</span>
                        </div>
                        {nearLimit.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                <span className="text-slate-500">{nearLimit.length} near limit</span>
                            </div>
                        )}
                        {overBudget.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-slate-500">{overBudget.length} over</span>
                            </div>
                        )}
                    </div>
                )}
            </Link>
        </div>
    );
}
