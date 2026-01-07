import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Tag, Zap, Table2 } from 'lucide-react';
import * as api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import BucketTableSection from '../components/BucketTableSection';
import RulesSection from '../components/RulesSection';
import BudgetProgressTab from '../components/BudgetProgressTab';
import BudgetPerformanceTab from '../components/BudgetPerformanceTab';
import { useBucketOperations } from '../hooks/useBucketOperations';

export default function Budget() {
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState('progress');

    // Queries with optimized stale times
    const { data: userSettings, isLoading: settingsLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: api.getSettings,
        staleTime: 30 * 60 * 1000, // 30 minutes - settings rarely change
    });

    const { data: buckets = [], isLoading: bucketsLoading } = useQuery({
        queryKey: ['buckets'],
        queryFn: api.getBucketsTree,
        staleTime: 30 * 60 * 1000, // 30 minutes - categories rarely change
    });

    const { data: allTags = [], isLoading: tagsLoading } = useQuery({
        queryKey: ['tags'],
        queryFn: api.getTags,
        staleTime: 30 * 60 * 1000, // 30 minutes - tags rarely change
    });

    const { data: members = [], isLoading: membersLoading } = useQuery({
        queryKey: ['members'],
        queryFn: api.getMembers,
        staleTime: 30 * 60 * 1000, // 30 minutes - members rarely change
    });

    const isLoading = settingsLoading || bucketsLoading || tagsLoading || membersLoading;

    // Custom Hook for Mutations
    const {
        updateBucketMutation,
        createBucketMutation,
        deleteBucketMutation,
        moveBucket,
        reorderBucketsMutation
    } = useBucketOperations();

    // Flatten buckets tree for Rules dropdown
    const flatBuckets = useMemo(() => {
        const flatten = (nodes) => {
            let res = [];
            if (!nodes) return res;
            nodes.forEach(node => {
                res.push(node);
                if (node.children && node.children.length > 0) {
                    res = res.concat(flatten(node.children));
                }
            });
            return res;
        };
        return flatten(buckets);
    }, [buckets]);

    const tabs = [
        { id: 'progress', label: 'Progress', icon: BarChart3 },
        { id: 'performance', label: 'Performance', icon: Table2 },
        { id: 'categories', label: 'Categories', icon: Tag },
        { id: 'rules', label: 'Rules', icon: Zap },
    ];

    if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header with Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Budget & Categories</h1>

                {/* Tab Navigation */}
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'progress' && (
                <BudgetProgressTab userSettings={userSettings} />
            )}

            {activeTab === 'performance' && (
                <BudgetPerformanceTab userSettings={userSettings} />
            )}

            {activeTab === 'categories' && (
                <BucketTableSection
                    title={null}
                    buckets={buckets}
                    userSettings={userSettings}
                    members={members}
                    createBucketMutation={createBucketMutation}
                    updateBucketMutation={updateBucketMutation}
                    deleteBucketMutation={deleteBucketMutation}
                    groupName="Discretionary"
                    allTags={allTags.map(t => t.name)}
                    onMoveBucket={(id, dir) => moveBucket(buckets, id, dir)}
                    onReorderBuckets={(ids) => reorderBucketsMutation.mutate(ids)}
                />
            )}

            {activeTab === 'rules' && (
                <section>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Smart Rules</h2>
                    <RulesSection buckets={flatBuckets} />
                </section>
            )}
        </div>
    );
}
