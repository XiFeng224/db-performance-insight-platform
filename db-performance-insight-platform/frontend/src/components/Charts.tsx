import React, { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

interface LineChartProps {
  data: { name: string; value: number }[];
  title?: string;
  height?: string;
}

const LineChartComponent: React.FC<LineChartProps> = ({ data, title, height = '300px' }) => {
  const option: EChartsOption = useMemo(() => ({
    title: {
      text: title,
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map((d) => d.name),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        data: data.map((d) => d.value),
        type: 'line',
        smooth: true,
        areaStyle: {
          opacity: 0.3,
        },
        lineStyle: {
          width: 2,
        },
      },
    ],
  }), [data, title]);

  return <ReactECharts option={option} style={{ height }} notMerge={true} />;
};

export const LineChart = memo(LineChartComponent);

interface BarChartProps {
  data: { name: string; value: number }[];
  title?: string;
  height?: string;
}

const BarChartComponent: React.FC<BarChartProps> = ({ data, title, height = '300px' }) => {
  const option: EChartsOption = useMemo(() => ({
    title: {
      text: title,
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.name),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        data: data.map((d) => d.value),
        type: 'bar',
        itemStyle: {
          color: '#1890ff',
        },
        barWidth: '60%',
      },
    ],
  }), [data, title]);

  return <ReactECharts option={option} style={{ height }} notMerge={true} />;
};

export const BarChart = memo(BarChartComponent);

interface PieChartProps {
  data: { name: string; value: number }[];
  title?: string;
  height?: string;
}

const PieChartComponent: React.FC<PieChartProps> = ({ data, title, height = '300px' }) => {
  const option: EChartsOption = useMemo(() => ({
    title: {
      text: title,
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: title,
        type: 'pie',
        radius: '50%',
        data: data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  }), [data, title]);

  return <ReactECharts option={option} style={{ height }} notMerge={true} />;
};

export const PieChart = memo(PieChartComponent);

interface GaugeChartProps {
  value: number;
  title?: string;
  max?: number;
  height?: string;
}

const GaugeChartComponent: React.FC<GaugeChartProps> = ({ value, title, max = 100, height = '300px' }) => {
  const option: EChartsOption = useMemo(() => ({
    title: {
      text: title,
      left: 'center',
    },
    series: [
      {
        type: 'gauge',
        min: 0,
        max: max,
        axisLine: {
          lineStyle: {
            width: 30,
            color: [
              [0.3, '#67e0e3'],
              [0.7, '#37a2da'],
              [1, '#fd666d'],
            ],
          },
        },
        pointer: {
          itemStyle: {
            color: 'auto',
          },
        },
        axisTick: {
          distance: -30,
          length: 8,
          lineStyle: {
            color: '#fff',
            width: 2,
          },
        },
        splitLine: {
          distance: -30,
          length: 30,
          lineStyle: {
            color: '#fff',
            width: 4,
          },
        },
        axisLabel: {
          color: 'auto',
          distance: 40,
          fontSize: 12,
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: 'auto',
          fontSize: 20,
        },
        data: [
          {
            value: value,
            name: '',
          },
        ],
      },
    ],
  }), [value, title, max]);

  return <ReactECharts option={option} style={{ height }} notMerge={true} />;
};

export const GaugeChart = memo(GaugeChartComponent);
