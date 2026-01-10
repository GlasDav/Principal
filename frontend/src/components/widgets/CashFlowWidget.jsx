import React from 'react';
import SankeyChart from '../SankeyChart';

/**
 * CashFlowWidget - Sankey diagram wrapper with exclude one-offs toggle
 */
export default function CashFlowWidget({ data, excludeOneOffs, onToggleExcludeOneOffs }) {
    return (
        <div className="mb-8">
            <SankeyChart
                data={data}
                excludeOneOffs={excludeOneOffs}
                onToggleExcludeOneOffs={onToggleExcludeOneOffs}
            />
        </div>
    );
}
