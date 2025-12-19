import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import * as api from '../services/api';

export default function Insights() {
    const { data: anomalies = [], isLoading } = useQuery({
        queryKey: ['anomalies'],
        queryFn: api.getAnomalies
    });

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Zap className="text-amber-500" />
                    Spending Insights
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    Automated analysis of your spending habits and potential anomalies.
                </p>
            </header>

            {isLoading ? (
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
        </div>
    );
}
