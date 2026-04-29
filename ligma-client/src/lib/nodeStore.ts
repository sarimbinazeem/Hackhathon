export type NodeType = "idea" | "task" | "decision" | "risk";

export type Node = {
 id: string;
 text: string;
 x: number;
 y: number;
 type: NodeType;
};

let nodes: Node[] = [];

export const addNode = (node: Node) => {
    const exists = nodes.find(n => n.id === node.id);
    if (exists) return; 
   
    nodes.push(node);
   };

export const getNodes = () => nodes;

export const updateNodePosition = (id: string, x: number, y: number) => {
    nodes = nodes.map((n) =>
     n.id === id ? { ...n, x, y } : n
    );
   };