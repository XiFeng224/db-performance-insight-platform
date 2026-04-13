import React, { useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Card, Empty } from 'antd';
import type {
  ExecutionPlanVisualization as ExecPlanViz,
  ExecutionPlanNode,
  ExecutionPlanEdge,
} from '../services/api';

interface ExecutionPlanVisualizationProps {
  data: ExecPlanViz | null;
}

export const ExecutionPlanVisualization: React.FC<ExecutionPlanVisualizationProps> = ({
  data,
}: ExecutionPlanVisualizationProps) => {
  const chartRef = useRef<any>(null);

  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <Card>
        <Empty description="暂无执行计划数据" />
      </Card>
    );
  }

  const nodes = data.nodes.map((node: ExecutionPlanNode) => ({
    id: String(node.id),
    name: node.label,
    symbolSize: 60,
    itemStyle: {
      color: getNodeColor(node.type),
    },
    label: {
      show: true,
      fontSize: 10,
    },
  }));

  const edges = data.edges.map((edge: ExecutionPlanEdge) => ({
    source: String(edge.from),
    target: String(edge.to),
    lineStyle: {
      width: 2,
      curveness: 0.2,
    },
  }));

  const option: EChartsOption = {
    title: {
      text: '执行计划可视化',
      left: 'center',
    },
    tooltip: {
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          // params.data.id 现在是字符串，需要转换为数字来查找原始节点
          const nodeId = typeof params.data.id === 'string' 
            ? parseInt(params.data.id, 10) 
            : params.data.id;
          const node = data.nodes.find((n: ExecutionPlanNode) => n.id === nodeId);
          if (node) {
            const table = node.table ?? '-';
            const type = node.type ?? '-';
            const rows = node.rows ?? 0;
            const cost = node.cost ?? 0;
            return `
              <div>
                <strong>${table}</strong><br/>
                类型: ${type}<br/>
                行数: ${rows}<br/>
                代价: ${cost}
              </div>
            `;
          }
        }
        return '';
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: edges,
        roam: true,
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
        },
        force: {
          repulsion: 300,
          edgeLength: 100,
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3,
        },
      },
    ],
  };

  return (
    <Card>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: '500px' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </Card>
  );
};

function getNodeColor(type: string): string {
  const colorMap: { [key: string]: string } = {
    ALL: '#ff4d4f',
    index: '#52c41a',
    range: '#1890ff',
    ref: '#faad14',
    eq_ref: '#722ed1',
    const: '#13c2c2',
    system: '#eb2f96',
  };
  return colorMap[type] || '#8c8c8c';
}
