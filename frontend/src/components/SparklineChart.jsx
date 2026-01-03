import React from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

/**
 * SparklineChart - A mini column chart for showing spending history
 * Uses Recharts for proper bar rendering
 */
export default function SparklineChart({ data = [], height = 40, className = '' }) {
    if (!data || data.length === 0) {
        return (
            <div className={`flex items-center justify-center ${className}`} style={{ height }}>
                <span className="text-xs text-slate-400">No history</span>
            </div>
        );
    }

    // Find max for highlighting - use reduce instead of spread to avoid stack overflow with large arrays
    const amounts = data.map(d => d.amount || 0);
    const maxAmount = amounts.length > 0 ? amounts.reduce((max, val) => Math.max(max, val), -Infinity) : 0;

    // Custom tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            return (
                <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg">
                    <span className="font-medium">{item.month}</span>: ${item.amount?.toLocaleString() || 0}
                </div>
            );
        }
        return null;
    };

    return (
        <div className={className} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        interval={0}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }} />
                    <Bar
                        dataKey="amount"
                        radius={[2, 2, 0, 0]}
                        maxBarSize={24}
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={index === data.length - 1 ? '#6366f1' : '#cbd5e1'}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
