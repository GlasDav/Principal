import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';

export function useBucketOperations() {
    const queryClient = useQueryClient();

    // Optimistic update for updating a bucket
    const updateBucketMutation = useMutation({
        mutationFn: ({ id, data }) => api.updateBucket(id, data),
        onMutate: async ({ id, data }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['buckets'] });

            // Snapshot the previous value
            const previousBuckets = queryClient.getQueryData(['buckets']);

            // Optimistically update the bucket in cache
            queryClient.setQueryData(['buckets'], (old) => {
                if (!old) return old;

                const updateBucketInTree = (buckets) => {
                    return buckets.map(bucket => {
                        if (bucket.id === id) {
                            return { ...bucket, ...data };
                        }
                        if (bucket.children && bucket.children.length > 0) {
                            return { ...bucket, children: updateBucketInTree(bucket.children) };
                        }
                        return bucket;
                    });
                };

                return updateBucketInTree(old);
            });

            return { previousBuckets };
        },
        onError: (err, variables, context) => {
            // Rollback to previous state on error
            if (context?.previousBuckets) {
                queryClient.setQueryData(['buckets'], context.previousBuckets);
            }
        },
        onSettled: () => {
            // Refetch to ensure data is in sync with server
            queryClient.invalidateQueries({ queryKey: ['buckets'] });
        },
    });

    // Optimistic update for creating a bucket
    const createBucketMutation = useMutation({
        mutationFn: api.createBucket,
        onMutate: async (newBucket) => {
            await queryClient.cancelQueries({ queryKey: ['buckets'] });

            const previousBuckets = queryClient.getQueryData(['buckets']);

            // Optimistically add the new bucket with a temporary ID
            queryClient.setQueryData(['buckets'], (old) => {
                if (!old) return old;

                // Add to root or to parent's children based on parent_id
                const tempId = `temp-${Date.now()}`;
                const optimisticBucket = { ...newBucket, id: tempId, children: [] };

                if (!newBucket.parent_id) {
                    // Add to root level
                    return [...old, optimisticBucket];
                } else {
                    // Add to parent's children
                    const addToParent = (buckets) => {
                        return buckets.map(bucket => {
                            if (bucket.id === newBucket.parent_id) {
                                return {
                                    ...bucket,
                                    children: [...(bucket.children || []), optimisticBucket]
                                };
                            }
                            if (bucket.children && bucket.children.length > 0) {
                                return { ...bucket, children: addToParent(bucket.children) };
                            }
                            return bucket;
                        });
                    };
                    return addToParent(old);
                }
            });

            return { previousBuckets };
        },
        onError: (err, variables, context) => {
            if (context?.previousBuckets) {
                queryClient.setQueryData(['buckets'], context.previousBuckets);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['buckets'] });
        },
    });

    // Optimistic update for deleting a bucket
    const deleteBucketMutation = useMutation({
        mutationFn: api.deleteBucket,
        onMutate: async (bucketId) => {
            await queryClient.cancelQueries({ queryKey: ['buckets'] });

            const previousBuckets = queryClient.getQueryData(['buckets']);

            // Optimistically remove the bucket
            queryClient.setQueryData(['buckets'], (old) => {
                if (!old) return old;

                const removeBucket = (buckets) => {
                    return buckets
                        .filter(bucket => bucket.id !== bucketId)
                        .map(bucket => {
                            if (bucket.children && bucket.children.length > 0) {
                                return { ...bucket, children: removeBucket(bucket.children) };
                            }
                            return bucket;
                        });
                };

                return removeBucket(old);
            });

            return { previousBuckets };
        },
        onError: (err, variables, context) => {
            if (context?.previousBuckets) {
                queryClient.setQueryData(['buckets'], context.previousBuckets);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['buckets'] });
        },
    });

    // Optimistic update for reordering buckets
    const reorderBucketsMutation = useMutation({
        mutationFn: api.reorderBuckets,
        onMutate: async (orderUpdates) => {
            await queryClient.cancelQueries({ queryKey: ['buckets'] });

            const previousBuckets = queryClient.getQueryData(['buckets']);

            // Optimistically reorder buckets
            queryClient.setQueryData(['buckets'], (old) => {
                if (!old) return old;

                const reorderInTree = (buckets) => {
                    return buckets
                        .map(bucket => {
                            const update = orderUpdates.find(u => u.id === bucket.id);
                            const newBucket = update
                                ? { ...bucket, display_order: update.display_order }
                                : bucket;

                            if (bucket.children && bucket.children.length > 0) {
                                return { ...newBucket, children: reorderInTree(bucket.children) };
                            }
                            return newBucket;
                        })
                        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                };

                return reorderInTree(old);
            });

            return { previousBuckets };
        },
        onError: (err, variables, context) => {
            if (context?.previousBuckets) {
                queryClient.setQueryData(['buckets'], context.previousBuckets);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['buckets'] });
        },
    });

    const moveBucket = (buckets, bucketId, direction) => {
        if (!buckets) return;

        // Find the bucket and its siblings
        const findBucketAndSiblings = (nodes, parentId = null) => {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === bucketId) {
                    return { siblings: nodes, index: i, parentId };
                }
                if (nodes[i].children && nodes[i].children.length > 0) {
                    const result = findBucketAndSiblings(nodes[i].children, nodes[i].id);
                    if (result) return result;
                }
            }
            return null;
        };

        // Prepare tree structure if flattened, but buckets passed here should be tree if coming from getBucketsTree
        // Wait, moveBucket logic assumes tree structure.
        // Backend returns tree? api.getBucketsTree returns tree?
        // Let's verify.
        // api.js: export const getBucketsTree = ... /settings/buckets/tree
        // Assuming it returns nested objects.

        // However, if buckets passed are FLAT (from getBuckets?), we need to build tree first?
        // Budget.jsx logic assumed `buckets` is a tree (line 712 used recursive search).
        // Let's assume input is a Tree.

        const result = findBucketAndSiblings(buckets);
        if (!result) return;

        const { siblings, index } = result;
        const newIndex = direction === 'up' ? index - 1 : index + 1;

        if (newIndex < 0 || newIndex >= siblings.length) return;

        // Swap the display_order values
        const orderUpdates = siblings.map((sib, i) => {
            if (i === index) return { id: sib.id, display_order: newIndex };
            if (i === newIndex) return { id: sib.id, display_order: index };
            return { id: sib.id, display_order: i };
        });

        reorderBucketsMutation.mutate(orderUpdates);
    };

    return {
        updateBucketMutation,
        createBucketMutation,
        deleteBucketMutation,
        reorderBucketsMutation,
        moveBucket
    };
}
