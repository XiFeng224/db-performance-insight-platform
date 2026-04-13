from typing import List, Dict, Any, Optional
from collections import defaultdict
import json


class FlameGraphGenerator:
    
    def __init__(self):
        self.stack_data = defaultdict(lambda: {'count': 0, 'samples': []})
    
    def add_sample(self, stack: List[str], value: int = 1):
        stack_key = ';'.join(stack)
        self.stack_data[stack_key]['count'] += value
        self.stack_data[stack_key]['samples'].append(stack)
    
    def generate_d3_data(self) -> Dict[str, Any]:
        root = {
            'name': 'root',
            'value': 0,
            'children': []
        }
        
        for stack_key, data in self.stack_data.items():
            stack = stack_key.split(';')
            current = root
            
            for frame in stack:
                found = False
                for child in current['children']:
                    if child['name'] == frame:
                        current = child
                        found = True
                        break
                
                if not found:
                    new_node = {
                        'name': frame,
                        'value': 0,
                        'children': []
                    }
                    current['children'].append(new_node)
                    current = new_node
            
            current['value'] += data['count']
        
        root['value'] = sum(child['value'] for child in root['children'])
        
        return self._collapse_single_children(root)
    
    def _collapse_single_children(self, node: Dict[str, Any]) -> Dict[str, Any]:
        if not node['children']:
            return node
        
        while len(node['children']) == 1:
            child = node['children'][0]
            node['name'] = f"{node['name']}::{child['name']}"
            node['value'] = child['value']
            node['children'] = child['children']
        
        node['children'] = [self._collapse_single_children(child) for child in node['children']]
        return node
    
    def generate_svg(self, width: int = 1200, height: int = 600) -> str:
        data = self.generate_d3_data()
        
        svg_parts = [
            f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">',
            '<style>',
            '  .flame-rect { stroke: white; stroke-width: 1px; }',
            '  .flame-rect:hover { opacity: 0.8; }',
            '</style>'
        ]
        
        total_value = data['value']
        y = 0
        row_height = 20
        
        def render_node(node: Dict[str, Any], x: int, y: int, available_width: int):
            if available_width <= 0:
                return
            
            node_width = (node['value'] / total_value) * width
            color = self._get_color(node['name'])
            
            svg_parts.append(
                f'<rect x="{x}" y="{y}" width="{node_width}" height="{row_height}" '
                f'fill="{color}" class="flame-rect">'
                f'<title>{node["name"]}: {node["value"]}</title></rect>'
            )
            
            if node['children']:
                child_x = x
                for child in node['children']:
                    child_width = (child['value'] / total_value) * width
                    render_node(child, child_x, y + row_height, child_width)
                    child_x += child_width
        
        render_node(data, 0, 0, width)
        svg_parts.append('</svg>')
        
        return '\n'.join(svg_parts)
    
    def _get_color(self, name: str) -> str:
        colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
            '#dfe6e9', '#fd79a8', '#a29bfe', '#6c5ce7', '#00b894'
        ]
        hash_val = hash(name)
        return colors[hash_val % len(colors)]
    
    def parse_perf_output(self, perf_output: str):
        for line in perf_output.split('\n'):
            if not line.strip():
                continue
            
            parts = line.split()
            if len(parts) >= 2:
                count = int(parts[0])
                stack = parts[1:]
                self.add_sample(stack, count)
    
    def parse_mysql_stack(self, stack_trace: str):
        stack = stack_trace.split('\n')
        stack.reverse()
        self.add_sample(stack)
    
    def get_hotspots(self, top_n: int = 10) -> List[Dict[str, Any]]:
        sorted_stacks = sorted(
            self.stack_data.items(),
            key=lambda x: x[1]['count'],
            reverse=True
        )
        
        return [
            {
                'stack': stack_key.split(';'),
                'count': data['count'],
                'percentage': (data['count'] / sum(d['count'] for d in self.stack_data.values())) * 100
            }
            for stack_key, data in sorted_stacks[:top_n]
        ]


class QueryPerformanceSampler:
    
    def __init__(self):
        self.flamegraph = FlameGraphGenerator()
    
    def sample_query_execution(self, query_id: int, execution_time: float, stack_trace: str = None):
        if stack_trace:
            self.flamegraph.parse_mysql_stack(stack_trace)
        else:
            simulated_stack = self._simulate_query_stack(query_id, execution_time)
            self.flamegraph.add_sample(simulated_stack)
    
    def _simulate_query_stack(self, query_id: int, execution_time: float) -> List[str]:
        base_stack = [
            'mysql_query',
            'mysql_execute_command',
            'mysql_parse',
            'mysql_optimizer'
        ]
        
        if execution_time > 1.0:
            base_stack.extend([
                'handler_read',
                'innodb_buffer_pool_read',
                'innodb_row_search'
            ])
        
        if execution_time > 5.0:
            base_stack.extend([
                'innodb_lock_wait',
                'innodb_mutex_enter'
            ])
        
        base_stack.append(f'query_{query_id}')
        return base_stack
    
    def get_flamegraph_data(self) -> Dict[str, Any]:
        return self.flamegraph.generate_d3_data()
    
    def get_flamegraph_svg(self) -> str:
        return self.flamegraph.generate_svg()
    
    def get_hotspots(self) -> List[Dict[str, Any]]:
        return self.flamegraph.get_hotspots()
