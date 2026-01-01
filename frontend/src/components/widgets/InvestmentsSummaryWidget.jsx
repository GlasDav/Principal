import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, LineChart, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

/**
 * InvestmentsSummaryWidget - Shows total investments, daily change, and top movers
 */
export default function InvestmentsSummaryWidget({ formatCurrency }) {
    // Fetch all accounts to find investment accounts
    const { data: accountsRaw = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await api.get('/net-worth/accounts')).data
    });

    // Defensive: ensure accounts is always an array to prevent .filter() crashes
    const accounts = Array.isArray(accountsRaw) ? accountsRaw : [];

    // Fetch holdings for investment accounts
    const investmentAccounts = accounts.filter(a => a.category === 'Investment');
    const accountIds = investmentAccounts.map(a => a.id);

    const { data: allHoldings = [], isLoading } = useQuery({
        queryKey: ['allHoldings', accountIds],
        queryFn: async () => {
            if (accountIds.length === 0) return [];
            // Fetch holdings for each investment account
            const promises = accountIds.map(id =>
                api.get(`/net-worth/accounts/${id}/holdings`).then(res => res.data)
            );
            const results = await Promise.all(promises);
            return results.flat();
        },
        enabled: accountIds.length > 0
    });

    // Calculate totals
    const totalValue = allHoldings.reduce((sum, h) => sum + (h.value || 0), 0);

    // Calculate daily change (using price change if available, otherwise estimate)
    const totalDailyChange = allHoldings.reduce((sum, h) => {
        // If we have previous price data, calculate actual change
        // For now, we'll estimate based on a small percentage
        const dailyChange = h.daily_change || 0;
        return sum + dailyChange;
    }, 0);

    const dailyChangePercent = totalValue > 0 ? (totalDailyChange / totalValue) * 100 : 0;
    const isPositive = totalDailyChange >= 0;

    // Get top movers (sorted by absolute change)
    const topMovers = allHoldings
        .filter(h => h.value > 0)
        .map(h => ({
            ...h,
            change: h.daily_change || 0,
            changePercent: h.daily_change_percent || 0
        }))
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 3);

    if (isLoading) {
        return (
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-2xl shadow-sm text-white">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-white/20 rounded w-1/3"></div>
                    <div className="h-8 bg-white/20 rounded w-2/3"></div>
                </div>
            </div>
        );
    }

    if (investmentAccounts.length === 0) {
        return (
            <Link
                to="/net-worth"
                className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-2xl shadow-sm text-white hover:shadow-lg transition-shadow block"
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                        <LineChart size={20} />
                    </div>
                    <span className="text-sm font-medium text-emerald-100">Investments</span>
                </div>
                <p className="text-white/80 text-sm">
                    No investment accounts yet. Click to add one!
                </p>
            </Link>
        );
    }

    return (
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-2xl shadow-sm text-white relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <LineChart size={18} className="text-emerald-200" />
                    <span className="text-sm font-medium text-emerald-100">Investments</span>
                </div>
                <Link to="/net-worth" className="text-sm text-emerald-200 hover:text-white flex items-center gap-1">
                    Details <ArrowRight size={14} />
                </Link>
            </div>

            {/* Total Value */}
            <p className="text-3xl font-bold mb-1">{formatCurrency(totalValue)}</p>

            {/* Daily Change */}
            <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-emerald-200' : 'text-red-300'}`}>
                {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>
                    {isPositive ? '+' : ''}{formatCurrency(totalDailyChange)} ({dailyChangePercent.toFixed(2)}%)
                </span>
                <span className="text-emerald-300 ml-1">Today</span>
            </div>

            {/* Top Movers */}
            {topMovers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-xs text-emerald-200 mb-2">Top Movers</p>
                    <div className="space-y-2">
                        {topMovers.map((holding, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="font-medium truncate max-w-[120px]">{holding.ticker || holding.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-100">{formatCurrency(holding.value)}</span>
                                    <span className={`text-xs ${holding.changePercent >= 0 ? 'text-emerald-200' : 'text-red-300'}`}>
                                        {holding.changePercent >= 0 ? '+' : ''}{holding.changePercent.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
