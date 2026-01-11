import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, DollarSign, Calendar, Calculator, ArrowRight } from 'lucide-react';
import * as api from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ASSET_COLOR, LIABILITY_COLOR, NET_WORTH_COLOR, CHART_COLORS } from '../constants/chartColors';

export default function DebtVisualizer() {
    const [inputs, setInputs] = useState({
        current_balance: 10000,
        interest_rate: 15.0,
        minimum_payment: 300,
        extra_payment: 100
    });

    const { data: projection, isLoading, error } = useQuery({
        queryKey: ['debtProjection', inputs],
        queryFn: () => api.getDebtProjection(inputs),
        keepPreviousData: true,
        staleTime: 5000
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setInputs(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
    };

    // Prepare Chart Data
    // Combine base and accelerated into single array for recharts
    const chartData = [];
    if (projection) {
        const maxMonths = Math.max(
            projection.base_plan?.schedule?.length || 0,
            projection.accelerated_plan?.schedule?.length || 0
        );

        for (let i = 0; i < maxMonths; i++) {
            const baseItem = projection.base_plan?.schedule[i] || { balance: 0 };
            const accItem = projection.accelerated_plan?.schedule[i] || { balance: 0 };

            // Optimization: Don't push if both are 0
            if (baseItem.balance === 0 && accItem.balance === 0 && i > 0) continue;

            chartData.push({
                month: i + 1,
                "Standard Plan": Math.round(baseItem.balance),
                "Accelerated Plan": Math.round(accItem.balance)
            });
        }
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <TrendingDown className="text-indigo-600" />
                    Debt Payoff Visualizer
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    Simulate how extra payments can save you interest and time.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Inputs Panel */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-fit space-y-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Calculator size={20} />
                        Loan Details
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Balance</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                            <input
                                type="number"
                                name="current_balance"
                                value={inputs.current_balance}
                                onChange={handleInputChange}
                                className="w-full pl-8 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Annual Interest Rate (%)</label>
                        <input
                            type="number"
                            name="interest_rate"
                            value={inputs.interest_rate}
                            onChange={handleInputChange}
                            step="0.1"
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Minimum Monthly Payment</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                            <input
                                type="number"
                                name="minimum_payment"
                                value={inputs.minimum_payment}
                                onChange={handleInputChange}
                                className="w-full pl-8 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                        <label className="block text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-1">Extra Payment (Monthly)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                            <input
                                type="number"
                                name="extra_payment"
                                value={inputs.extra_payment}
                                onChange={handleInputChange}
                                className="w-full pl-8 pr-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Summary Cards */}
                    {projection && projection.savings && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                                <p className="text-emerald-600 dark:text-emerald-400 font-medium text-sm flex items-center gap-2">
                                    <DollarSign size={16} /> Interest Saved
                                </p>
                                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-2">
                                    {projection.savings.interest_saved < 0 ? "Infinite" : `$${projection.savings.interest_saved.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                                </p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                                <p className="text-blue-600 dark:text-blue-400 font-medium text-sm flex items-center gap-2">
                                    <Calendar size={16} /> Time Saved
                                </p>
                                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-2">
                                    {projection.savings.time_saved_months < 0 ? "N/A" : `${projection.savings.time_saved_months} months`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Chart Container */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Payoff Projection</h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        type="number"
                                        label={{ value: 'Months', position: 'insideBottom', offset: -5 }}
                                        tick={{ fill: '#94a3b8' }}
                                    />
                                    <YAxis
                                        tickFormatter={(value) => `$${value / 1000}k`}
                                        tick={{ fill: '#94a3b8' }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                        formatter={(value) => [`$${value.toLocaleString()}`, undefined]}
                                    />
                                    <Legend />

                                    <Line
                                        type="monotone"
                                        dataKey="Standard Plan"
                                        stroke={CHART_COLORS[3]} // Red/Warn
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 6 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="Accelerated Plan"
                                        stroke={NET_WORTH_COLOR} // Indigo/Brand
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
