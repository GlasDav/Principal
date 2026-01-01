import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { getMembers, getUpcomingBills } from '../services/api';

// Widget imports
import SummaryCardsWidget from '../components/widgets/SummaryCardsWidget';
import UpcomingBillsWidget from '../components/widgets/UpcomingBillsWidget';
import CashFlowWidget from '../components/widgets/CashFlowWidget';
import SpendingTrendsWidget from '../components/widgets/SpendingTrendsWidget';
import BudgetProgressWidget from '../components/widgets/BudgetProgressWidget';
import BudgetSummaryWidget from '../components/widgets/BudgetSummaryWidget';
import GoalsWidget from '../components/widgets/GoalsWidget';
import NetWorthWidget from '../components/widgets/NetWorthWidget';
import RecentTransactionsWidget from '../components/widgets/RecentTransactionsWidget';
import InvestmentsSummaryWidget from '../components/widgets/InvestmentsSummaryWidget';
import PeriodComparisonWidget from '../components/widgets/PeriodComparisonWidget';
import InsightsCardsWidget from '../components/widgets/InsightsCardsWidget';
import AchievementsWidget from '../components/widgets/AchievementsWidget';

// Drag and Drop Imports
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import OnboardingWizard from '../components/OnboardingWizard';
import { SortableWidgetWrapper } from '../components/widgets/SortableWidgetWrapper';
import { AnimatedPage } from '../components/animations/AnimatedComponents';

export default function Dashboard() {
    // Date Range State
    const [rangeType, setRangeType] = useState("This Month");
    const [spenderMode, setSpenderMode] = useState("Combined");
    const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
    const [trendOption, setTrendOption] = useState("Total");
    const [excludeOneOffs, setExcludeOneOffs] = useState(false);

    // Widget Order State
    const defaultWidgetOrder = [
        'summary-cards',           // 1. Financial Overview (income, expenses, net savings, net worth)
        'recent-activity',         // 2. Recent transactions and upcoming bills
        'budget-progress',         // 3. Budget performance
        'insights-cards',          // 4. Spending insights
        'achievements',            // 5. Milestones
        'financial-overview',      // 6. Net worth, investments, goals widgets
        'period-comparison',       // 7. Period comparisons
        'cash-flow',               // 8. Sankey diagram
        'spending-trends'          // 9. Trend charts
    ];

    const [widgetOrder, setWidgetOrder] = useState(() => {
        try {
            const saved = localStorage.getItem('dashboard_widget_order');
            // Validate that saved order contains all current widgets (in case new ones were added)
            const parsed = saved ? JSON.parse(saved) : null;
            if (parsed && Array.isArray(parsed) && parsed.length === defaultWidgetOrder.length) {
                return parsed;
            }
        } catch (e) {
            console.error("Failed to parse widget order", e);
        }
        return defaultWidgetOrder;
    });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setWidgetOrder((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                localStorage.setItem('dashboard_widget_order', JSON.stringify(newOrder));
                return newOrder;
            });
        }
    };

    // Helper to calculate dates
    const getDateRange = (type) => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        if (type === "Last 3 Months") {
            start.setMonth(now.getMonth() - 2);
        } else if (type === "Last 6 Months") {
            start.setMonth(now.getMonth() - 5);
        } else if (type === "Year to Date") {
            start.setMonth(0);
        } else if (type === "Last Year") {
            start.setFullYear(now.getFullYear() - 1, 0, 1);
            end.setFullYear(now.getFullYear() - 1, 11, 31);
        } else if (type === "Custom") {
            return { start: customStart, end: customEnd };
        }

        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    };

    const { start, end } = getDateRange(rangeType);

    // --- Data Queries ---
    const { data: dashboardData, isLoading } = useQuery({
        queryKey: ['dashboard', start, end, spenderMode],
        queryFn: async () => {
            const res = await api.get(`/analytics/dashboard`, {
                params: { start_date: start, end_date: end, spender: spenderMode }
            });
            return res.data;
        }
    });

    const { data: membersRaw = [] } = useQuery({
        queryKey: ['members'],
        queryFn: getMembers
    });
    // Defensive: ensure members is always an array
    const members = Array.isArray(membersRaw) ? membersRaw : [];

    const { data: netWorthHistoryRaw = [] } = useQuery({
        queryKey: ['netWorthHistory'],
        queryFn: async () => (await api.get('/net-worth/history')).data
    });
    // Defensive: ensure netWorthHistory is always an array
    const netWorthHistory = Array.isArray(netWorthHistoryRaw) ? netWorthHistoryRaw : [];

    const { data: trendHistoryRaw = [] } = useQuery({
        queryKey: ['trendHistory', start, end, trendOption],
        queryFn: async () => {
            const params = { start_date: start, end_date: end };
            if (trendOption === "Non-Discretionary") params.group = "Non-Discretionary";
            else if (trendOption === "Discretionary") params.group = "Discretionary";
            else if (trendOption.startsWith("bucket:")) params.bucket_id = trendOption.split(":")[1];
            return (await api.get('/analytics/history', { params })).data;
        }
    });
    // Defensive: ensure trendHistory is always an array
    const trendHistory = Array.isArray(trendHistoryRaw) ? trendHistoryRaw : [];

    const { data: sankeyData } = useQuery({
        queryKey: ['sankey', start, end, spenderMode, excludeOneOffs],
        queryFn: async () => {
            const res = await api.get(`/analytics/sankey`, {
                params: { start_date: start, end_date: end, spender: spenderMode, exclude_one_offs: excludeOneOffs }
            });
            return res.data;
        }
    });

    const { data: upcomingBillsRaw = [] } = useQuery({
        queryKey: ['upcomingBills'],
        queryFn: () => getUpcomingBills(7),
        staleTime: 300000
    });
    // Defensive: ensure upcomingBills is always an array
    const upcomingBills = Array.isArray(upcomingBillsRaw) ? upcomingBillsRaw : [];

    // --- Loading / Error States ---
    if (isLoading) return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;
    if (!dashboardData) return <div className="p-8 text-center text-red-500">Error loading data. Please check connection.</div>;

    const { buckets: rawBuckets, totals } = dashboardData;
    // Defensive: ensure buckets is always an array to prevent .filter() crashes
    const buckets = Array.isArray(rawBuckets) ? rawBuckets : [];
    const netWorth = netWorthHistory.length > 0 ? netWorthHistory[netWorthHistory.length - 1].net_worth : 0;

    // Formatting helper
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const renderWidget = (id) => {
        switch (id) {
            case 'summary-cards':
                return <SummaryCardsWidget totals={totals} netWorth={netWorth} formatCurrency={formatCurrency} />;
            case 'insights-cards':
                return <InsightsCardsWidget currentStart={start} currentEnd={end} spenderMode={spenderMode} formatCurrency={formatCurrency} />;
            case 'achievements':
                return <AchievementsWidget dashboardData={dashboardData} netWorth={netWorth} goals={[]} />;
            case 'period-comparison':
                return <PeriodComparisonWidget currentStart={start} currentEnd={end} spenderMode={spenderMode} formatCurrency={formatCurrency} currentData={dashboardData} />;
            case 'financial-overview':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <NetWorthWidget history={netWorthHistory} formatCurrency={formatCurrency} />
                        <InvestmentsSummaryWidget formatCurrency={formatCurrency} />
                        <GoalsWidget formatCurrency={formatCurrency} />
                    </div>
                );
            case 'recent-activity':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <RecentTransactionsWidget formatCurrency={formatCurrency} />
                        <UpcomingBillsWidget bills={upcomingBills || []} formatCurrency={formatCurrency} />
                    </div>
                );
            case 'cash-flow':
                return <CashFlowWidget data={sankeyData} excludeOneOffs={excludeOneOffs} onToggleExcludeOneOffs={setExcludeOneOffs} />;
            case 'spending-trends':
                return <SpendingTrendsWidget trendHistory={trendHistory} trendOption={trendOption} onTrendOptionChange={setTrendOption} buckets={buckets} />;
            case 'budget-progress':
                return <BudgetSummaryWidget buckets={buckets} formatCurrency={formatCurrency} />;
            default:
                return null;
        }
    };

    return (
        <AnimatedPage className="max-w-7xl mx-auto p-8 space-y-8">
            {/* Welcome Header - Removed per user request */}

            {/* Filter Controls */}
            <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Financial Overview</h2>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Date Range Selector */}
                    <select
                        value={rangeType}
                        onChange={(e) => setRangeType(e.target.value)}
                        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none cursor-pointer"
                    >
                        <option>This Month</option>
                        <option>Last 3 Months</option>
                        <option>Last 6 Months</option>
                        <option>Year to Date</option>
                        <option>Last Year</option>
                        <option>Custom</option>
                    </select>

                    {/* Custom Date Inputs */}
                    {rangeType === "Custom" && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                            />
                        </div>
                    )}

                    {/* Spender Mode Toggle */}
                    <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex items-center">
                        <button
                            onClick={() => setSpenderMode('Combined')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${spenderMode === 'Combined'
                                ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            Combined
                        </button>
                        {members.map((member) => (
                            <button
                                key={member.id}
                                onClick={() => setSpenderMode(member.name)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${spenderMode === member.name
                                    ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: member.color }}></span>
                                {member.name}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Widget Grid */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={widgetOrder} strategy={verticalListSortingStrategy}>
                    <div className="space-y-8 pb-10">
                        {widgetOrder.map((id) => (
                            <SortableWidgetWrapper key={id} id={id}>
                                {renderWidget(id)}
                            </SortableWidgetWrapper>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            <OnboardingWizard />
        </AnimatedPage>
    );
}
