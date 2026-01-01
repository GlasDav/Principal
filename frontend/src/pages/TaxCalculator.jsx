import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

// Simple UI Components to replace missing shadcn/ui
const Card = ({ children, className = "" }) => (
    <div className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 ${className}`}>
        {children}
    </div>
);

const CardHeader = ({ children, className = "" }) => (
    <div className={`p-6 pb-2 ${className}`}>{children}</div>
);

const CardTitle = ({ children, className = "" }) => (
    <h3 className={`font-semibold text-lg leading-none tracking-tight text-slate-900 dark:text-slate-100 ${className}`}>{children}</h3>
);

const CardContent = ({ children, className = "" }) => (
    <div className={`p-6 pt-0 ${className}`}>{children}</div>
);

export default function TaxCalculator() {
    const queryClient = useQueryClient();
    const [year, setYear] = useState(new Date().getFullYear());

    // fetch settings
    const { data: settings, isLoading: settingsLoading } = useQuery({
        queryKey: ['taxSettings'],
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/taxes/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch settings');
            return response.json();
        }
    });

    // fetch estimate
    const { data: estimate, isLoading: estimateLoading } = useQuery({
        queryKey: ['taxEstimate', year, settings], // Refetch when settings change
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/taxes/estimate?year=${year}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch estimate');
            return response.json();
        },
        enabled: !!settings // only run if settings loaded
    });

    // Update mutation
    const updateSettingsMutation = useMutation({
        mutationFn: async (newSettings) => {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/taxes/settings`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newSettings)
            });
            if (!response.ok) throw new Error('Failed to update settings');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['taxSettings']);
            queryClient.invalidateQueries(['taxEstimate']);
        }
    });

    const handleStatusChange = (e) => {
        updateSettingsMutation.mutate({ filing_status: e.target.value });
    };

    const localFormat = (val) => {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
    }

    if (settingsLoading) return <div className="p-8">Loading Settings...</div>;

    return (
        <div className="p-8 space-y-8 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                        🇦🇺 ATO Tax Planner (2024-2025)
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Projection based on YTD Income and Stage 3 Tax Cuts.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Settings Card */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Residency Status</label>
                            <select
                                value={settings?.filing_status || "Resident"}
                                onChange={handleStatusChange}
                                className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="Resident">Australian Resident</option>
                                <option value="Non-Resident">Foreign Resident</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Work Related Expenses / Deductions</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-500">$</span>
                                <input
                                    type="number"
                                    value={settings?.custom_deduction || 0}
                                    onChange={(e) => updateSettingsMutation.mutate({ custom_deduction: parseFloat(e.target.value) })}
                                    className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 pl-7 text-slate-900 dark:text-white"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Deductions reduce your taxable income. Examples: Work from home costs, professional memberships, charity donations.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Big Numbers */}
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total YTD Income</p>
                            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-500 mt-2">
                                {estimate ? localFormat(estimate.gross_income) : "..."}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Taxable Income</p>
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-500 mt-2">
                                {estimate ? localFormat(estimate.taxable_income) : "..."}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                After {localFormat(estimate?.deduction || 0)} expenses
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Estimated ATO Tax</p>
                            <p className="text-3xl font-bold text-rose-600 dark:text-rose-500 mt-2">
                                {estimate ? localFormat(estimate.total_tax) : "..."}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Includes Medicare Levy
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Effective Tax Rate</p>
                            <p className="text-3xl font-bold text-amber-500 dark:text-amber-400 mt-2">
                                {estimate ? (estimate.effective_rate * 100).toFixed(1) + "%" : "..."}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Marginal Rate: {estimate ? (estimate.marginal_rate * 100).toFixed(0) + "%" : "..."}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Bracket Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Tax Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {estimate?.brackets_breakdown.map((b, i) => (
                        <div key={i} className="flex flex-col gap-1">
                            <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                                <span>
                                    {b.label ? (
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{b.label}</span>
                                    ) : (
                                        <span>{(b.rate * 100).toFixed(0)}% Bracket</span>
                                    )}

                                    {!b.label && (
                                        <span className="text-slate-400 dark:text-slate-500 text-xs ml-2">
                                            ({localFormat(b.min)} - {b.max ? localFormat(b.max) : "+"})
                                        </span>
                                    )}
                                </span>
                                <span className="font-medium text-slate-900 dark:text-white">{localFormat(b.tax_for_bracket)}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 w-full opacity-50"></div>
                            </div>
                        </div>
                    ))}
                    {(!estimate?.brackets_breakdown || estimate.brackets_breakdown.length === 0) && (
                        <div className="text-slate-500 italic">No tax liability calculated yet.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
