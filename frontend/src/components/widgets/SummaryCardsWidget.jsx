import React from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';

/**
 * SummaryCardsWidget - Displays the 4 main summary cards: Income, Expenses, Net Savings, Net Worth
 */
export default function SummaryCardsWidget({ totals, netWorth, formatCurrency }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Income</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totals.income)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Expenses</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(totals.expenses)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Savings</p>
                <p className={`text-2xl font-bold mt-1 ${totals.net_savings >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(totals.net_savings)}
                </p>
            </div>
            <Link to="/net-worth" className="bg-gradient-to-br from-indigo-500 to-violet-600 p-6 rounded-2xl shadow-sm text-white hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="relative z-10">
                    <p className="text-sm font-medium text-indigo-100 flex items-center gap-2">
                        <Wallet size={16} /> Net Worth
                    </p>
                    <p className="text-2xl font-bold mt-1">
                        {formatCurrency(netWorth)}
                    </p>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-20 transform rotate-12 group-hover:scale-110 transition-transform">
                    <Wallet size={80} />
                </div>
            </Link>
        </div>
    );
}
