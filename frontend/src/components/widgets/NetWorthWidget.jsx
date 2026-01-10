import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * NetWorthWidget - Mini net worth chart with sparkline
 */
export default function NetWorthWidget({ history: historyProp = [], formatCurrency }) {
    // Defensive: ensure history is always an array to prevent crashes
    const history = Array.isArray(historyProp) ? historyProp : [];

    const latestSnapshot = history.length > 0 ? history[history.length - 1] : null;
    const prevSnapshot = history.length > 1 ? history[history.length - 2] : null;

    const currentNetWorth = latestSnapshot?.net_worth || 0;
    const prevNetWorth = prevSnapshot?.net_worth || 0;
    const change = currentNetWorth - prevNetWorth;
    const changePercent = prevNetWorth !== 0 ? (change / Math.abs(prevNetWorth)) * 100 : 0;
    const isPositive = change >= 0;

    // Prepare chart data (last 6 months)
    const chartData = history.slice(-6).map(s => ({
        date: s.date,
        value: s.net_worth
    }));

    return (
        <Link
            to="/net-worth"
            className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-sm text-white hover:shadow-lg transition-shadow relative overflow-hidden group block"
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Wallet size={18} className="text-text-muted dark:text-text-muted-dark" />
                        <span className="text-sm font-medium text-text-muted dark:text-text-muted-dark">Net Worth</span>
                    </div>
                    {change !== 0 && (
                        <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            <span>{isPositive ? '+' : ''}{changePercent.toFixed(1)}%</span>
                        </div>
                    )}
                </div>
                <p className="text-3xl font-bold mb-4">{formatCurrency(currentNetWorth)}</p>

                {/* Mini Sparkline Chart */}
                {chartData.length >= 1 ? (
                    <div className="h-16 -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData.length === 1 ? [chartData[0], chartData[0]] : chartData}>
                                <defs>
                                    <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isPositive ? "#10B981" : "#EF4444"} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={isPositive ? "#10B981" : "#EF4444"} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={isPositive ? "#10B981" : "#EF4444"}
                                    strokeWidth={2}
                                    fill="url(#netWorthGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-16 flex items-center justify-center border-t border-border dark:border-border-dark mt-2">
                        <span className="text-xs text-text-muted dark:text-text-muted-dark">No history data yet</span>
                    </div>
                )}
            </div>
        </Link>
    );
}
