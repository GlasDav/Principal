import React from 'react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../services/api';
import BucketTableSection from '../BucketTableSection';
import { useBucketOperations } from '../../hooks/useBucketOperations';

export default function CategoriesSettings() {
    // Queries
    const { data: userSettings, isLoading: sL } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
    const { data: buckets = [], isLoading: bL } = useQuery({ queryKey: ['buckets'], queryFn: api.getBucketsTree });
    const { data: allTags = [], isLoading: tL } = useQuery({ queryKey: ['tags'], queryFn: api.getTags });
    const { data: members = [], isLoading: mL } = useQuery({ queryKey: ['members'], queryFn: api.getMembers });

    const isLoading = sL || bL || tL || mL;

    // Hook
    const {
        updateBucketMutation,
        createBucketMutation,
        deleteBucketMutation,
        reorderBucketsMutation,
        moveBucket
    } = useBucketOperations();

    if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-800 dark:text-white">Budget Categories</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage your budget categories, limits, and grouping. Changes here affect your Main Budget page.
            </p>

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
                onReorderBuckets={(updates) => reorderBucketsMutation.mutate(updates)}
            />
        </div>
    );
}
