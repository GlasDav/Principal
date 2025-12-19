import React from 'react';
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts';

const SankeyChart = ({ data }) => {
    if (!data || !data.nodes || data.nodes.length === 0 || !data.links || data.links.length === 0) {
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

    // Custom Node
    const renderNode = (props) => {
        const { x, y, width, height, index, payload, containerWidth } = props;
        const isOut = x + width > containerWidth / 2;

        // Configuration
        const isLeft = x < containerWidth / 2;
        const textAnchor = isLeft ? 'end' : 'start';
        const xPos = isLeft ? x - 6 : x + width + 6;
        const yPos = y + height / 2;

        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill="#6366f1"
                    fillOpacity={0.8}
                    rx={4}
                />

                {/* Node Label */}
                <text
                    x={xPos}
                    y={yPos - 6} // Shift up slightly
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    fill="#334155" // Slate-700
                    fontSize={12}
                    fontWeight="bold"
                    className="dark:fill-slate-200"
                    style={{ pointerEvents: 'none' }}
                >
                    {payload.name}
                </text>

                {/* Node Value */}
                <text
                    x={xPos}
                    y={yPos + 8} // Shift down slightly
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    fill="#64748b" // Slate-500
                    fontSize={10}
                    fontWeight="medium"
                    className="dark:fill-slate-400"
                    style={{ pointerEvents: 'none' }}
                >
                    {formatCurrency(payload.value)}
                </text>
            </g>
        );
    };

    return (
        <div className="w-full h-[400px] bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Cash Flow</h3>
            <ResponsiveContainer width="100%" height="100%">
                <Sankey
                    data={data}
                    link={{ stroke: '#818cf8' }}
                    nodePadding={50}
                    margin={{ left: 100, right: 100, top: 20, bottom: 20 }} // Increased margins for labels
                    node={renderNode}
                >
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => formatCurrency(value)}
                    />
                </Sankey>
            </ResponsiveContainer>
        </div>
    );
};

export default SankeyChart;
