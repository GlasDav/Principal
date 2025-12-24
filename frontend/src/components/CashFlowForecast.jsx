import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Calendar } from 'lucide-react';
import { getCashFlowForecast } from '../services/api';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area
} from 'recharts';

export default function CashFlowForecast({ days = 90 }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['cash-flow-forecast', days],
        queryFn: () => getCashFlowForecast(days)
    });

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="h-64 bg-slate-100 dark:bg-slate-700 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400">Failed to load forecast data</p>
            </div>
        );
    }

    const forecast = data?.forecast || [];
    const currentBalance = data?.current_balance || 0;
    const dailyBurn = data?.daily_burn_rate || 0;
    const minBalance = data?.min_projected_balance || 0;

    // Determine if there's a danger zone
    const willGoNegative = minBalance < 0;
    const lowBalanceWarning = minBalance < currentBalance * 0.2;

    // Prepare chart data - sample every few days for cleaner display
    const chartData = forecast.filter((_, idx) => idx === 0 || idx % 3 === 0 || idx === forecast.length - 1)
        .map(point => ({
            date: point.label,
            balance: Math.round(point.balance),
            isProjected: point.is_projected
        }));

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <TrendingUp className="text-indigo-500" />
                            Cash Flow Forecast
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Projected balance for the next {days} days
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Current Balance</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {formatCurrency(currentBalance)}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Daily Burn Rate</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">
                        {formatCurrency(dailyBurn)}/day
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Min. Projected</p>
                    <p className={`text-2xl font-bold mt-1 ${minBalance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {formatCurrency(minBalance)}
                    </p>
                </div>
            </div>

            {/* Warning Banner */}
            {willGoNegative && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center gap-3">
                    <AlertTriangle className="text-red-500 shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">
                        <strong>Warning:</strong> Your projected balance drops below zero. Consider reducing spending or increasing income.
                    </p>
                </div>
            )}

            {/* Chart */}
            <div className="p-6">
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12 }}
                                className="text-slate-500"
                            />
                            <YAxis
                                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                tick={{ fontSize: 12 }}
                                className="text-slate-500"
                            />
                            <Tooltip
                                formatter={(value) => [formatCurrency(value), 'Balance']}
                                contentStyle={{
                                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white'
                                }}
                            />
                            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
                            <Area
                                type="monotone"
                                dataKey="balance"
                                stroke="#6366f1"
                                fill="url(#balanceGradient)"
                            />
                            <Line
                                type="monotone"
                                dataKey="balance"
                                stroke="#6366f1"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6, fill: '#6366f1' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    Forecast based on recurring bills, subscriptions, and your average daily spending pattern.
                </p>
            </div>
        </div>
    );
}
