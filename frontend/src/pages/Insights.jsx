import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap, AlertTriangle, AlertCircle, CheckCircle, TrendingDown, Scissors, Lightbulb, DollarSign } from 'lucide-react';
import { getAnomalies, getSavingsOpportunities } from '../services/api';

export default function Insights() {
    const { data: anomalies = [], isLoading: anomaliesLoading } = useQuery({
        queryKey: ['anomalies'],
        queryFn: getAnomalies
    });

    const { data: savingsData, isLoading: savingsLoading } = useQuery({
        queryKey: ['savings-opportunities'],
        queryFn: getSavingsOpportunities
    });

    const opportunities = savingsData?.opportunities || [];
    const totalSavings = savingsData?.total_potential_savings || 0;

    const getOpportunityIcon = (type) => {
        switch (type) {
            case 'over_budget': return TrendingDown;
            case 'unused_subscription': return Scissors;
            case 'spending_spike': return AlertCircle;
            default: return Lightbulb;
        }
    };

    const getOpportunityColor = (severity) => {
        switch (severity) {
            case 'high': return 'red';
            case 'medium': return 'amber';
            default: return 'blue';
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Zap className="text-amber-500" />
                    Spending Insights
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    AI-powered analysis of your spending habits and savings opportunities.
                </p>
            </header>

            {/* Savings Opportunities Section */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Lightbulb className="text-indigo-500" />
                        Savings Opportunities
                    </h2>
                    {totalSavings > 0 && (
                        <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
                            Potential Savings: ${totalSavings.toLocaleString()}/year
                        </div>
                    )}
                </div>

                {savingsLoading ? (
                    <div className="p-12 text-center text-slate-500">Analyzing spending patterns...</div>
                ) : opportunities.length === 0 ? (
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-8 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-center">
                        <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
                        <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">Looking Good!</h3>
                        <p className="text-emerald-700 dark:text-emerald-300 mt-2">
                            No immediate savings opportunities detected. Keep up the good work!
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {opportunities.map((opp, idx) => {
                            const Icon = getOpportunityIcon(opp.type);
                            const color = getOpportunityColor(opp.severity);

                            return (
                                <div
                                    key={idx}
                                    className={`p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md ${opp.severity === 'high'
                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-full shrink-0 ${opp.severity === 'high'
                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                            }`}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className="font-semibold text-slate-900 dark:text-white">
                                                    {opp.message}
                                                </h3>
                                                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                    +${opp.potential_savings.toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                {opp.action}
                                            </p>
                                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${opp.type === 'over_budget' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                    opp.type === 'unused_subscription' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                }`}>
                                                {opp.category}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Spending Anomalies Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="text-amber-500" />
                    Spending Anomalies
                </h2>

                {anomaliesLoading ? (
                    <div className="p-12 text-center text-slate-500">Analyzing transactions...</div>
                ) : (
                    <div className="space-y-4">
                        {anomalies.length === 0 ? (
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-8 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-center">
                                <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
                                <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">All Good!</h3>
                                <p className="text-emerald-700 dark:text-emerald-300 mt-2">
                                    No spending anomalies or unusual patterns detected in the last 30 days.
                                </p>
                            </div>
                        ) : (
                            anomalies.map((item, idx) => (
                                <div key={idx} className={`p-6 rounded-2xl border flex items-start gap-4 shadow-sm ${item.severity === 'high'
                                    ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                    }`}>
                                    <div className={`p-3 rounded-full shrink-0 ${item.severity === 'high'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                        }`}>
                                        {item.severity === 'high' ? <AlertTriangle size={24} /> : <AlertCircle size={24} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.message}</h3>
                                            <span className="text-sm text-slate-500">{new Date(item.date).toLocaleDateString('en-AU')}</span>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-300 mt-1">{item.details}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </section>

            {/* Tip about AI Chat */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800 text-center">
                <DollarSign className="mx-auto text-indigo-500 mb-3" size={32} />
                <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">Need More Insights?</h3>
                <p className="text-indigo-700 dark:text-indigo-300 mt-1 text-sm">
                    Click the chat bubble in the bottom-right corner to ask AI questions about your finances.
                </p>
            </div>
        </div>
    );
}
