import React, { useMemo } from 'react';
import { Sankey, Tooltip, Layer, Rectangle } from 'recharts';

const SankeyChart = ({ data }) => {
    // Validate and sanitize data to prevent Recharts stack overflow
    const sanitizedData = useMemo(() => {
        if (!data || !data.nodes || !data.links) {
            return null;
        }

        // Limit nodes and links to prevent stack overflow in Recharts layout algorithm
        const MAX_NODES = 50;
        const MAX_LINKS = 100;

        let nodes = data.nodes.slice(0, MAX_NODES);
        let links = data.links
            .filter(link =>
                link.source < nodes.length &&
                link.target < nodes.length &&
                link.source !== link.target && // Prevent self-referencing
                link.value > 0 // Only positive values
            )
            .slice(0, MAX_LINKS);

        // Ensure all link indices are valid
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

    // Custom Node with labels outside
    const CustomNode = ({ x, y, width, height, index, payload, containerWidth }) => {
        const isLeft = x < containerWidth / 2;
        const textAnchor = isLeft ? 'end' : 'start';
        const xPos = isLeft ? x - 6 : x + width + 6;
        const yPos = y + height / 2;
        const minHeight = Math.max(height, 4);

        // Detect dark mode from document class
        const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        const textColor = isDarkMode ? '#e2e8f0' : '#334155'; // slate-200 for dark, slate-700 for light

        return (
            <Layer key={`node-${index}`}>
                <Rectangle
                    x={x}
                    y={y}
                    width={width}
                    height={minHeight}
                    fill="#6366f1"
                    fillOpacity={0.9}
                />
                <text
                    x={xPos}
                    y={yPos}
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    fill={textColor}
                    fontSize={10}
                    fontWeight="600"
                >
                    {payload.name}
                </text>
            </Layer>
        );
    };

    // Custom Link with gradient fill
    const CustomLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload }) => {
        const gradientId = `linkGradient${index}`;
        // Ensure minimum visible width
        const width = Math.max(linkWidth || 1, 2);

        return (
            <Layer key={`link-${index}`}>
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.4} />
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
                    strokeOpacity={0.7}
                />
            </Layer>
        );
    };

    // Calculate height based on number of destination nodes (categories)
    // Count unique target nodes (excluding the source nodes like Income, Savings, etc)
    const categoryCount = sanitizedData.nodes.length - 4; // Subtract source nodes (Income, Non-Disc, Disc, Savings)
    const chartHeight = Math.max(400, Math.min(800, categoryCount * 28 + 100));
    const nodePadding = Math.max(8, Math.min(30, 400 / Math.max(categoryCount, 1)));

    return (
        <div className="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex flex-col">
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
        </div>
    );
};

export default SankeyChart;

