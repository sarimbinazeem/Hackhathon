"use client";

import { useState } from "react";
import { addEvent } from "../lib/eventStore";
import { v4 as uuidv4 } from "uuid";

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

 // SIMPLE AI CLASSIFIER (RULE BASED)
 const classify = (text: string) => {
  const lower = text.toLowerCase();

  if (
   lower.includes("build") ||
   lower.includes("create") ||
   lower.includes("make") ||
   lower.includes("implement")
  ) {
   return "Action Item";
  }

  if (
   lower.includes("decide") ||
   lower.includes("we will") ||
   lower.includes("finalize")
  ) {
   return "Decision";
  }

  if (
   lower.includes("why") ||
   lower.includes("should we") ||
   lower.includes("what if")
  ) {
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
  
   // EVENT SYSTEM
   addEvent({
    id: uuidv4(),
    type: "TASK_CREATED",
    payload: newTask,
    timestamp: Date.now()
   });
  
   setInput("");
  };


  const linkNodes = (from: string, to: string) => {
   addEvent({
    id: uuidv4(),
    type: "NODE_LINK",
    payload: { from, to },
    timestamp: Date.now()
   });
  };

 return (
  <div className="flex-1 p-4 bg-gray-50">

   <h2 className="text-xl font-semibold mb-3">
    AI Brainstorm → Task Engine (Phase 4)
   </h2>

   {/* INPUT BOX */}
   <div className="flex gap-2 mb-4">

    <input
     className="border p-2 flex-1 rounded"
     placeholder="Type an idea... (e.g. build login page)"
     value={input}
     onChange={(e) => setInput(e.target.value)}
    />

    <button
     onClick={addTask}
     className="bg-black text-white px-4 rounded"
    >
     Add
    </button>

   </div>

   {/* INFO BOX */}
   <div className="p-3 border rounded bg-white">
    <p className="text-sm">
     Try typing:
     <br />
     “Build login page”
     <br />
     “We should decide database”
     <br />
     “Why use microservices?”
    </p>
   </div>

  </div>
 );
}