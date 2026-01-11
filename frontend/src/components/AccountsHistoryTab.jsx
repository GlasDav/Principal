import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Plus } from 'lucide-react';
import api from '../services/api';

/**
 * Format currency for table cells (compact format)
 */
const formatCurrency = (val) => {
    if (val === null || val === undefined) return '-';
    if (val === 0) return '$0';
    const abs = Math.abs(val);
    if (abs >= 1000000) {
        return `$${(abs / 1000000).toFixed(1)}M`;
    }
    if (abs >= 1000) {
        return `$${(abs / 1000).toFixed(0)}k`;
    }
    return `$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

/**
 * AccountRow component for individual account rows
 */
function AccountRow({ account, months, isLiability }) {
    return (
        <tr className="border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            {/* Account Name - FROZEN COLUMN */}
            <td className="sticky left-0 z-10 px-3 py-2.5 whitespace-nowrap border-r border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 min-w-[180px]">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {account.name}
                    </span>
                    <span className="text-xs text-slate-400">{account.category}</span>
                </div>
            </td>

            {/* Monthly balance columns */}
            {account.balances_by_month.map((balance, idx) => (
                <td
                    key={idx}
                    className="px-2 py-2.5 text-right text-sm whitespace-nowrap text-slate-600 dark:text-slate-300"
                >
                    {isLiability && balance ? `-${formatCurrency(balance)}` : formatCurrency(balance)}
                </td>
            ))}
        </tr>
    );
}

/**
 * TotalRow component for summary rows
 */
function TotalRow({ label, values, colorClass, isBold = false }) {
    return (
        <tr className={`border-b border-slate-200 dark:border-slate-600 ${isBold ? 'bg-slate-100 dark:bg-slate-700' : 'bg-slate-50 dark:bg-slate-700/50'}`}>
            <td className={`sticky left-0 z-10 px-3 py-2.5 whitespace-nowrap border-r border-slate-200 dark:border-slate-600 ${isBold ? 'bg-slate-100 dark:bg-slate-700' : 'bg-slate-50 dark:bg-slate-700/50'}`}>
                <span className={`text-sm ${isBold ? 'font-bold' : 'font-semibold'} ${colorClass}`}>
                    {label}
                </span>
            </td>
            {values.map((val, idx) => (
                <td
                    key={idx}
                    className={`px-2 py-2.5 text-right text-sm whitespace-nowrap ${isBold ? 'font-bold' : 'font-semibold'} ${colorClass}`}
                >
                    {formatCurrency(val)}
                </td>
            ))}
        </tr>
    );
}

/**
 * AccountsHistoryTab - Spreadsheet view of account balance history
 */
export default function AccountsHistoryTab({ onAddAccount }) {
    const { data: historyData, isLoading } = useQuery({
        queryKey: ['accountsHistory'],
        queryFn: async () => (await api.get('/net-worth/accounts-history')).data
    });

    // Separate accounts by type
    const { assetAccounts, liabilityAccounts } = useMemo(() => {
        if (!historyData?.accounts) return { assetAccounts: [], liabilityAccounts: [] };

        return {
            assetAccounts: historyData.accounts.filter(a => a.type === 'Asset'),
            liabilityAccounts: historyData.accounts.filter(a => a.type === 'Liability')
        };
    }, [historyData]);

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    const months = historyData?.months || [];
    const totals = historyData?.totals || {};

    if (months.length === 0) {
        return (
            <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-12 text-center">
                <p className="text-lg font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    No historical data yet
                </p>
                <p className="text-sm text-text-muted dark:text-text-muted-dark mb-4">
                    Import your net worth history or create a monthly check-in to start tracking.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="text-sm text-text-muted dark:text-text-muted-dark">
                    Showing {months.length} months of history
                </div>
                {onAddAccount && (
                    <button
                        onClick={onAddAccount}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition"
                    >
                        <Plus size={16} />
                        Add Account
                    </button>
                )}
            </div>

            {/* Spreadsheet Table */}
            <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                                {/* Frozen Account Header */}
                                <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-700/50 px-3 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-600 min-w-[180px]">
                                    Account
                                </th>
                                {months.map((month) => (
                                    <th
                                        key={month}
                                        className="px-2 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap"
                                    >
                                        {month}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Assets Section */}
                            {assetAccounts.length > 0 && (
                                <>
                                    <tr className="bg-emerald-50/50 dark:bg-emerald-900/20">
                                        <td
                                            colSpan={months.length + 1}
                                            className="sticky left-0 z-10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide bg-emerald-50/50 dark:bg-emerald-900/20"
                                        >
                                            Assets
                                        </td>
                                    </tr>
                                    {assetAccounts.map(account => (
                                        <AccountRow
                                            key={account.id}
                                            account={account}
                                            months={months}
                                            isLiability={false}
                                        />
                                    ))}
                                    <TotalRow
                                        label="Total Assets"
                                        values={totals.assets_by_month || []}
                                        colorClass="text-emerald-600 dark:text-emerald-400"
                                    />
                                </>
                            )}

                            {/* Liabilities Section */}
                            {liabilityAccounts.length > 0 && (
                                <>
                                    <tr className="bg-red-50/50 dark:bg-red-900/20">
                                        <td
                                            colSpan={months.length + 1}
                                            className="sticky left-0 z-10 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide bg-red-50/50 dark:bg-red-900/20"
                                        >
                                            Liabilities
                                        </td>
                                    </tr>
                                    {liabilityAccounts.map(account => (
                                        <AccountRow
                                            key={account.id}
                                            account={account}
                                            months={months}
                                            isLiability={true}
                                        />
                                    ))}
                                    <TotalRow
                                        label="Total Liabilities"
                                        values={(totals.liabilities_by_month || []).map(v => -v)}
                                        colorClass="text-red-600 dark:text-red-400"
                                    />
                                </>
                            )}

                            {/* Net Worth Row */}
                            <TotalRow
                                label="Net Worth"
                                values={totals.net_worth_by_month || []}
                                colorClass="text-primary dark:text-primary-light"
                                isBold={true}
                            />
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
