import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, { MiniMap, Controls, Background, useNodesState, useEdgesState } from 'react-flow-renderer';
import 'react-flow-renderer/dist/style.css';
import dagre from 'dagre';
import { useEffect } from 'react';

export default function GraphPage() {
  const { id } = useParams<{ id: string }>();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { data: graphData, isLoading, error } = useQuery<{ nodes: any[], edges: any[] }>({
    queryKey: ["/api/books", id, "graph"],
    queryFn: () => fetch(`/api/books/${id}/graph`).then(res => res.json()),
    enabled: !!id,
  });

  useEffect(() => {
    if (graphData) {
      console.log("Graph data received:", graphData);
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph({ rankdir: 'TB' });

      graphData.nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 150, height: 50 });
      });

      graphData.edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
      });

      dagre.layout(dagreGraph);

      const layoutedNodes = graphData.nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
          id: node.id,
          data: { label: node.title || 'Untitled' },
          position: { x: nodeWithPosition.x, y: nodeWithPosition.y },
        };
      });

      const layoutedEdges = graphData.edges.map(edge => ({
        id: `e${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: true,
      }));

      console.log("Layouted nodes:", layoutedNodes);
      console.log("Layouted edges:", layoutedEdges);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [graphData, setNodes, setEdges]);


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load graph</p>
          <button
            onClick={() => window.location.href = `/book/${id}`}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
          >
            Back to Book
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-inter antialiased">
      <div className="flex-1" style={{ height: '100vh' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}
