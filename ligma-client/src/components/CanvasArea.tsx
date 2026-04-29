"use client";

import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

import { addEvent } from "../lib/eventStore";
import { addLink, getLinks } from "../lib/linkStore";

type Task = {
 id: string;
 title: string;
 author: string;
 type: string;
};

export default function CanvasArea({
 tasks,
 setTasks
}: {
 tasks: Task[];
 setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}) {

 const [input, setInput] = useState("");
 const [links, setLinks] = useState<any[]>([]);

 // refresh links UI
 useEffect(() => {
  const interval = setInterval(() => {
   setLinks([...getLinks()]);
  }, 500);

  return () => clearInterval(interval);
 }, []);

 const classify = (text: string) => {
  const lower = text.toLowerCase();

  if (lower.includes("build") || lower.includes("create")) {
   return "Action Item";
  }

  if (lower.includes("decide") || lower.includes("finalize")) {
   return "Decision";
  }

  if (lower.includes("why") || lower.includes("what if")) {
   return "Question";
  }

  return "Idea";
 };

 const addTask = () => {
  if (!input.trim()) return;

  const type = classify(input);

  const newTask = {
   id: uuidv4(),
   title: input,
   author: "Sarim",
   type
  };

  setTasks([...tasks, newTask]);

  addEvent({
   id: uuidv4(),
   type: "TASK_CREATED",
   payload: newTask,
   timestamp: Date.now()
  });

  setInput("");
 };

 // DEMO LINK (we simulate linking manually for now)
 const createDemoLink = () => {
  const link = {
   id: uuidv4(),
   from: "nodeA",
   to: "nodeB"
  };

  addLink(link);
 };

 return (
  <div className="flex-1 p-4 bg-gray-50 relative">

   <h2 className="text-xl font-semibold mb-3">
    Phase 6 — Visual Dependency Graph
   </h2>

   {/* INPUT */}
   <div className="flex gap-2 mb-3">

    <input
     className="border p-2 flex-1 rounded"
     value={input}
     onChange={(e) => setInput(e.target.value)}
     placeholder="Type idea..."
    />

    <button
     onClick={addTask}
     className="bg-black text-white px-3 rounded"
    >
     Add Task
    </button>

    <button
     onClick={createDemoLink}
     className="border px-3 rounded"
    >
     Link Demo
    </button>

   </div>

   {/* CANVAS */}
   <div className="h-[600px] border rounded-2xl overflow-hidden relative">

    <Tldraw />

    {/* SVG LAYER (ARROWS) */}
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">

     {links.map((l, i) => (
      <line
       key={i}
       x1={100 + i * 20}
       y1={100}
       x2={300}
       y2={300}
       stroke="black"
       strokeWidth="2"
      />
     ))}

    </svg>

   </div>

   {/* TASKS */}
   <div className="mt-3 p-3 border rounded bg-white">

    <h3 className="font-bold mb-2">Tasks</h3>

    {tasks.map(t => (
     <div key={t.id} className="text-sm">
      {t.title} ({t.type})
     </div>
    ))}

   </div>

  </div>
 );
}