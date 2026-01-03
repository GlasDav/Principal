import React, { useMemo, useState } from 'react';
import { Sankey, Tooltip, Layer, Rectangle } from 'recharts';
import { X } from 'lucide-react';

// Color palette for categories - vibrant and distinct like the reference
const CATEGORY_COLORS = {
    // Income sources
    'Income': '#3B82F6',          // Blue
    'Other Income': '#60A5FA',    // Light blue

    // Groups
    'Discretionary': '#8B5CF6',   // Purple
    'Non-Discretionary': '#F97316', // Orange

    // Savings
    'Savings & Investments': '#10B981', // Emerald green
    'Net Cash Savings': '#34D399',      // Light green
    'Investments': '#059669',           // Dark green

    // Expense categories - vibrant palette
    'Housing': '#F97316',         // Orange
    'Household': '#FB923C',       // Light orange
    'Utilities': '#0EA5E9',       // Sky blue
    'Bills & Utilities': '#0EA5E9',
    'Food': '#EF4444',            // Red
    'Food & Dining': '#EF4444',
    'Groceries': '#F87171',       // Light red
    'Dining Out': '#DC2626',      // Dark red
    'Transport': '#6366F1',       // Indigo
    'Auto & Transport': '#6366F1',
    'Transportation': '#6366F1',
    'Shopping': '#EC4899',        // Pink
    'Entertainment': '#A855F7',   // Purple
    'Health': '#14B8A6',          // Teal
    'Healthcare': '#14B8A6',
    'Insurance': '#64748B',       // Slate
    'Financial': '#8B5CF6',       // Violet
    'Personal': '#F472B6',        // Light pink
    'Travel': '#22D3EE',          // Cyan
    'Travel & Lifestyle': '#22D3EE',
    'Education': '#FBBF24',       // Amber
    'Subscriptions': '#A78BFA',   // Light violet
    'Uncategorized': '#94A3B8',   // Gray
    'Misc': '#CBD5E1',            // Light gray
};

// Get color for a node, with fallback
const getNodeColor = (name, group) => {
    // Null safety check
    if (!name) {
        if (group === 'Non-Discretionary') return '#F97316';
        if (group === 'Discretionary') return '#8B5CF6';
        return '#6366F1';
    }

    // Check exact match first
    if (CATEGORY_COLORS[name]) {
        return CATEGORY_COLORS[name];
    }

    // Check if name contains any known category
    const lowerName = name.toLowerCase();
    for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
        if (lowerName.includes(key.toLowerCase())) {
            return color;
        }
    }

    // Fallback based on group
    if (group === 'Non-Discretionary') return '#F97316';
    if (group === 'Discretionary') return '#8B5CF6';

    // Default fallback
    return '#6366F1';
};

const SankeyChart = ({ data }) => {
    const [selectedNode, setSelectedNode] = useState(null);

    // Validate and sanitize data to prevent Recharts stack overflow
    const sanitizedData = useMemo(() => {
        if (!data || !data.nodes || !data.links) {
            return null;
        }

        const MAX_NODES = 50;
        const MAX_LINKS = 100;

        let nodes = data.nodes.slice(0, MAX_NODES);
        let links = data.links
            .filter(link =>
                link.source < nodes.length &&
                link.target < nodes.length &&
                link.source !== link.target &&
                link.value > 0
            )
            .slice(0, MAX_LINKS);

        const validNodeIndices = new Set(nodes.map((_, i) => i));
        links = links.filter(link =>
            validNodeIndices.has(link.source) &&
            validNodeIndices.has(link.target)
        );

        if (nodes.length === 0 || links.length === 0) {
            return null;
        }

        return { nodes, links };
    }, [data]);

    if (!sanitizedData) {
        return (
            <div className="w-full h-[400px] bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Cash Flow</h3>
                <div className="flex-1 flex items-center justify-center text-slate-400">
                    No data available for flow chart
                </div>
            </div>
        );
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
    };

    // Handle node click
    const handleNodeClick = (node) => {
        if (node.children && node.children.length > 0) {
            setSelectedNode(node);
        }
    };

    // Custom Node with colors and click interaction
    const CustomNode = ({ x, y, width, height, index, payload, containerWidth }) => {
        const isLeft = x < containerWidth / 2;
        const textAnchor = isLeft ? 'end' : 'start';
        const xPos = isLeft ? x - 6 : x + width + 6;
        const yPos = y + height / 2;
        const minHeight = Math.max(height, 4);

        const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        const textColor = isDarkMode ? '#e2e8f0' : '#334155';

        // Get color for this node
        const nodeColor = getNodeColor(payload.name, payload.group);
        const hasChildren = payload.children && payload.children.length > 0;

        return (
            <Layer key={`node-${index}`}>
                <Rectangle
                    x={x}
                    y={y}
                    width={width}
                    height={minHeight}
                    fill={nodeColor}
                    fillOpacity={0.9}
                    style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                    onClick={() => handleNodeClick(payload)}
                />
                <text
                    x={xPos}
                    y={yPos}
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    fill={textColor}
                    fontSize={10}
                    fontWeight="600"
                    style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                    onClick={() => handleNodeClick(payload)}
                >
                    {payload.name}
                    {hasChildren && ' ▸'}
                </text>
            </Layer>
        );
    };

    // Custom Link with gradient from SOURCE to TARGET node colors
    const CustomLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload }) => {
        const gradientId = `linkGradient${index}`;
        const width = Math.max(linkWidth || 1, 2);

        // Get colors from source and target nodes
        const sourceNode = sanitizedData.nodes[payload.source];
        const targetNode = sanitizedData.nodes[payload.target];
        const sourceColor = getNodeColor(sourceNode?.name, sourceNode?.group);
        const targetColor = getNodeColor(targetNode?.name, targetNode?.group);

        return (
            <Layer key={`link-${index}`}>
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={sourceColor} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={targetColor} stopOpacity={0.5} />
                    </linearGradient>
                </defs>
                <path
                    d={`
                        M${sourceX},${sourceY}
                        C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
                    `}
                    stroke={`url(#${gradientId})`}
                    strokeWidth={width}
                    fill="none"
                />
            </Layer>
        );
    };

    const categoryCount = sanitizedData.nodes.length - 4;
    const chartHeight = Math.max(400, Math.min(800, categoryCount * 28 + 100));
    const nodePadding = Math.max(8, Math.min(30, 400 / Math.max(categoryCount, 1)));

    return (
        <div className="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex flex-col relative">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 shrink-0">Cash Flow</h3>
            <div className="overflow-auto" style={{ maxHeight: '500px' }}>
                <div style={{ height: `${chartHeight}px`, minHeight: '400px' }}>
                    <Sankey
                        width={1000}
                        height={chartHeight}
                        data={sanitizedData}
                        node={<CustomNode />}
                        link={<CustomLink />}
                        nodePadding={nodePadding}
                        nodeWidth={8}
                        margin={{ left: 100, right: 180, top: 20, bottom: 20 }}
                        iterations={32}
                    >
                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.2)',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                padding: '10px 14px',
                                fontSize: '13px'
                            }}
                            labelStyle={{ color: '#64748b', fontWeight: 600, marginBottom: '4px' }}
                            formatter={(value, name) => [formatCurrency(value), name]}
                        />
                    </Sankey>
                </div>
            </div>

            {/* Drill-down Modal */}
            {selectedNode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedNode(null)}>
                    <div
                        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div
                            className="p-4 flex items-center justify-between"
                            style={{ backgroundColor: getNodeColor(selectedNode.name, selectedNode.group), color: 'white' }}
                        >
                            <div>
                                <h3 className="text-lg font-bold">{selectedNode.name}</h3>
                                <p className="text-sm opacity-80">Subcategory Breakdown</p>
                            </div>
                            <button
                                onClick={() => setSelectedNode(null)}
                                className="p-1 rounded-full hover:bg-white/20 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 max-h-80 overflow-y-auto">
                            {selectedNode.children && selectedNode.children.length > 0 ? (
                                <div className="space-y-3">
                                    {selectedNode.children.map((child, idx) => {
                                        const total = selectedNode.children.reduce((sum, c) => sum + c.amount, 0);
                                        const pct = total > 0 ? (child.amount / total * 100).toFixed(1) : 0;

                                        return (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                            {child.name}
                                                        </span>
                                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                                            {formatCurrency(child.amount)}
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${pct}%`,
                                                                backgroundColor: getNodeColor(selectedNode.name, selectedNode.group)
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-400">{pct}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-center text-slate-400 py-4">No subcategories</p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total</span>
                                <span className="text-lg font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(selectedNode.children?.reduce((sum, c) => sum + c.amount, 0) || 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SankeyChart;
