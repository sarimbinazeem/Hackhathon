"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

import type { Node, NodeType } from "../lib/nodeStore";
import { addEvent } from "../lib/eventStore";
import { addNode, getNodes, updateNodePosition } from "../lib/nodeStore";

export default function CanvasArea() {

 const [input, setInput] = useState("");
 const [nodes, setNodes] = useState<Node[]>([]);
 const [draggingId, setDraggingId] = useState<string | null>(null);

 const socketRef = useRef<WebSocket | null>(null);

 // WebSocket (optional safe)
 useEffect(() => {
  const ws = new WebSocket("ws://localhost:8080");

  ws.onmessage = (event) => {
   const data = JSON.parse(event.data);

   if (data.type === "NODE_CREATED") {
    const exists = getNodes().some(n => n.id === data.payload.id);
    if (!exists) {
     addNode(data.payload);
     setNodes([...getNodes()]);
    }
   }

   if (data.type === "NODE_MOVED") {
    updateNodePosition(
     data.payload.id,
     data.payload.x,
     data.payload.y
    );
    setNodes([...getNodes()]);
   }
  };

  socketRef.current = ws;
  return () => ws.close();
 }, []);

 useEffect(() => {
  const interval = setInterval(() => {
   setNodes([...getNodes()]);
  }, 200);

  return () => clearInterval(interval);
 }, []);

 const classify = (text: string): NodeType => {
   const t = text.toLowerCase().trim();
  
   // TASK (action verbs including MAKE)
   if (
    t.includes("build") ||
    t.includes("create") ||
    t.includes("make") ||
    t.includes("prepare") ||
    t.includes("cook") ||
    t.includes("implement") ||
    t.includes("develop") ||
    t.includes("add") ||
    t.includes("fix")
   ) {
    return "task";
   }
  
   // DECISION / PLANNING
   if (
    t.includes("decide") ||
    t.includes("choose") ||
    t.includes("select") ||
    t.includes("finalize") ||
    t.includes("pick")
   ) {
    return "decision";
   }
  
   // RISK / ISSUE
   if (
    t.includes("risk") ||
    t.includes("problem") ||
    t.includes("issue") ||
    t.includes("bug") ||
    t.includes("failure")
   ) {
    return "risk";
   }
  
   // QUESTION → decision (important for brainstorming tools)
   if (
    t.includes("why") ||
    t.includes("how") ||
    t.includes("?")
   ) {
    return "decision";
   }
  
   // fallback
   return "idea";
  };
 const addCanvasNode = () => {
  if (!input.trim()) return;

  const newNode: Node = {
   id: uuidv4(),
   text: input,
   x: Math.random() * 400 + 120,
   y: Math.random() * 300 + 120,
   type: classify(input)
  };

  addNode(newNode);

  addEvent({
   id: uuidv4(),
   type: "NODE_CREATED",
   payload: newNode,
   timestamp: Date.now()
  });

  socketRef.current?.send(
   JSON.stringify({
    type: "NODE_CREATED",
    payload: newNode
   })
  );

  setInput("");
 };

 const handleMouseMove = (e: React.MouseEvent) => {
  if (!draggingId) return;

  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  updateNodePosition(draggingId, x, y);

  socketRef.current?.send(
   JSON.stringify({
    type: "NODE_MOVED",
    payload: { id: draggingId, x, y }
   })
  );

  setNodes([...getNodes()]);
 };

 // 🎨 MODERN COLOR STYLE FUNCTION
 const getNodeStyle = (type: string) => {
  switch (type) {
   case "task":
    return "bg-blue-500 text-white";
   case "decision":
    return "bg-purple-500 text-white";
   case "risk":
    return "bg-red-500 text-white";
   default:
    return "bg-gray-800 text-white";
  }
 };

 return (
  <div className="flex-1 p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">

   <h2 className="text-xl font-bold mb-3 text-cyan-300">
    Phase 10 — Modern Collaborative Canvas
   </h2>

   {/* INPUT */}
   <div className="flex gap-2 mb-3">

    <input
     className="border border-gray-600 bg-gray-900 text-white p-2 flex-1 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400"
     value={input}
     onChange={(e) => setInput(e.target.value)}
     placeholder="Create node..."
    />

    <button
     onClick={addCanvasNode}
     className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 rounded"
    >
     Add
    </button>

   </div>

   {/* CANVAS */}
   <div
    className="h-[650px] border border-gray-700 rounded-2xl relative overflow-hidden bg-gray-950"
    onMouseMove={handleMouseMove}
    onMouseUp={() => setDraggingId(null)}
   >

    <Tldraw />

    {/* NODES */}
    {nodes.map((n) => (
     <div
      key={n.id}
      className={`absolute p-2 rounded shadow cursor-move text-sm font-semibold ${getNodeStyle(n.type)}`}
      style={{
       left: n.x,
       top: n.y
      }}
      onMouseDown={() => setDraggingId(n.id)}
      onMouseUp={() => setDraggingId(null)}
     >
      <div className="text-xs opacity-80">{n.type.toUpperCase()}</div>
      <div>{n.text}</div>
     </div>
    ))}

   </div>

   {/* DEBUG */}
   <div className="mt-3 text-sm border border-gray-700 p-2 bg-gray-900 rounded text-gray-300">

    <h3 className="font-bold text-cyan-300">Nodes</h3>

    {nodes.map(n => (
     <div key={n.id}>
      {n.type}: {n.text}
     </div>
    ))}

   </div>

  </div>
 );
}