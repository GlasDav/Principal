import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import BucketTableRow from './BucketTableRow';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

export default function BucketTableSection({
    title,
    icon: SectionIcon,
    buckets,
    userSettings,
    createBucketMutation,
    updateBucketMutation,
    deleteBucketMutation,
    groupName,
    allTags = [],
    members = [],
    onMoveBucket = null,
    onReorderBuckets = null
}) {
    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const [expandedIds, setExpandedIds] = useState(new Set());

    useEffect(() => {
        if (buckets && buckets.length > 0) {
            setExpandedIds(prev => {
                const hasChildren = (bucket) => bucket.children && bucket.children.length > 0;
                const parentsWithChildren = buckets.filter(hasChildren);
                if (parentsWithChildren.length > 0 && prev.size === 0) {
                    return new Set(buckets.map(b => b.id));
                }
                return prev;
            });
        }
    }, [buckets]);

    const handleAddNew = () => {
        // For Income group, auto-parent under the "Income" category to maintain hierarchy
        let parentId = null;
        if (groupName === 'Income') {
            const incomeParent = roots.find(b => b.name === 'Income' && b.group === 'Income');
            if (incomeParent) {
                parentId = incomeParent.id;
            }
        }
        createBucketMutation.mutate({
            name: "New Category",
            group: groupName,
            is_shared: false,
            parent_id: parentId
        });
    };

    const handleToggleExpand = (id) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    // Use buckets directly as roots (expecting Tree structure)
    const roots = buckets || [];

    // Helper to get all bucket IDs recursively (for SortableContext)
    const getAllBucketIds = (nodes) => {
        let ids = [];
        nodes.forEach(node => {
            ids.push(node.id);
            if (node.children && node.children.length > 0) {
                ids = ids.concat(getAllBucketIds(node.children));
            }
        });
        return ids;
    };

    // Handle drag end - reorder buckets and support cross-parent moves
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        // Find bucket and its context (siblings, parent) by ID
        const findBucketContext = (nodes, targetId, parentId = null, parentBucket = null) => {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === targetId) {
                    return { siblings: nodes, index: i, parentId, parentBucket };
                }
                if (nodes[i].children && nodes[i].children.length > 0) {
                    const result = findBucketContext(nodes[i].children, targetId, nodes[i].id, nodes[i]);
                    if (result) return result;
                }
            }
            return null;
        };

        const activeContext = findBucketContext(roots, active.id);
        const overContext = findBucketContext(roots, over.id);

        if (!activeContext || !overContext) return;

        const sameParent = activeContext.parentId === overContext.parentId;

        if (sameParent) {
            // Same parent: just reorder within siblings
            const { siblings } = activeContext;
            const oldIndex = siblings.findIndex(b => b.id === active.id);
            const newIndex = siblings.findIndex(b => b.id === over.id);

            if (oldIndex === -1 || newIndex === -1) return;

            const reordered = [...siblings];
            const [movedItem] = reordered.splice(oldIndex, 1);
            reordered.splice(newIndex, 0, movedItem);

            const orderUpdates = reordered.map((bucket, idx) => ({
                id: bucket.id,
                display_order: idx
            }));

            if (onReorderBuckets) {
                onReorderBuckets(orderUpdates);
            }
        } else {
            // Different parent: move to new parent
            const activeBucket = activeContext.siblings[activeContext.index];
            const newParentId = overContext.parentId; // Parent of the 'over' item
            const newParentBucket = overContext.parentBucket;

            // Get the new parent's group (or keep current if moving to root)
            const newGroup = newParentBucket?.group || activeBucket.group;

            // Calculate new display_order (insert after the 'over' item)
            const overIndex = overContext.siblings.findIndex(b => b.id === over.id);
            const newDisplayOrder = overIndex + 1;

            // Update the bucket's parent_id, group, and display_order
            if (updateBucketMutation) {
                updateBucketMutation.mutate({
                    id: activeBucket.id,
                    data: {
                        ...activeBucket,
                        parent_id: newParentId,
                        group: newGroup,
                        display_order: newDisplayOrder
                    }
                });
            }
        }
    };

    const renderRows = (nodes, depth = 0, parentIsGroupBudget = false, parentGroup = null) => {
        return nodes.map((bucket, index) => (
            <React.Fragment key={bucket.id}>
                <BucketTableRow
                    bucket={bucket}
                    userSettings={userSettings}
                    members={members}
                    updateBucketMutation={updateBucketMutation}
                    deleteBucketMutation={deleteBucketMutation}
                    createBucketMutation={createBucketMutation}
                    allTags={allTags}
                    depth={depth}
                    isExpanded={expandedIds.has(bucket.id)}
                    onToggleExpand={() => handleToggleExpand(bucket.id)}
                    hasChildren={bucket.children && bucket.children.length > 0}
                    onMoveBucket={onMoveBucket}
                    isFirst={index === 0}
                    isLast={index === nodes.length - 1}
                    parentIsGroupBudget={parentIsGroupBudget}
                    parentGroup={parentGroup}
                />
                {expandedIds.has(bucket.id) && bucket.children && renderRows(bucket.children, depth + 1, bucket.is_group_budget, bucket.group)}
            </React.Fragment>
        ));
    };

    const colSpan = userSettings?.is_couple_mode ? 8 : 6;

    return (
        <div className="mb-8 h-full flex flex-col">
            {title && (
                <div className="flex items-center gap-2 mb-3">
                    {SectionIcon && <SectionIcon size={18} className="text-slate-500 dark:text-slate-400" />}
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wider">{title}</h3>
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full text-xs">{buckets.length}</span>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                                <th className="p-3 w-12"></th>
                                <th className="p-3">Category Name</th>
                                {/* Dynamic Member Columns */}
                                {members.length > 0 ? (
                                    members.map(member => (
                                        <th key={member.id} className="p-3 w-28">
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: member.color }}></div>
                                                {member.name}
                                            </div>
                                        </th>
                                    ))
                                ) : (
                                    <th className="p-3 w-28">Limit</th>
                                )}
                                {/* Total Column - always show if there are members */}
                                {members.length > 0 && (
                                    <th className="p-3 w-28 text-center">Total</th>
                                )}
                                <th className="p-3 w-16 text-center">Shared</th>
                                <th className="p-3 w-20 text-center">Rollover</th>
                                <th className="p-3">Tags</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                            modifiers={[restrictToVerticalAxis]}
                        >
                            <SortableContext
                                items={getAllBucketIds(roots)}
                                strategy={verticalListSortingStrategy}
                            >
                                <tbody>
                                    {renderRows(roots)}
                                    {roots.length === 0 && (
                                        <tr>
                                            <td colSpan={colSpan} className="p-6 text-center text-slate-400 text-sm">
                                                No categories yet
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </SortableContext>
                        </DndContext>
                    </table>
                </div>

                {/* Footer / Add Root Category */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 flex-shrink-0">
                    <button
                        onClick={handleAddNew}
                        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                        <Plus size={16} />
                        Add Main Category
                    </button>
                </div>
            </div>
        </div>
    );
}
