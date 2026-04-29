"use client";

import { useState } from "react";
import Navbar from "../components/Navbar";
import CanvasArea from "../components/CanvasArea";
import TaskBoard from "../components/TaskBoard";
import EventLog from "../components/EventLog";

export default function Home() {

 const [tasks] = useState<any[]>([]);

 return (
  <div className="min-h-screen flex flex-col">

   <Navbar />

   <div className="flex flex-1">

    {/* Canvas is now self-contained (no props) */}
    <CanvasArea />

    <TaskBoard tasks={tasks} />

   </div>

   <EventLog />

  </div>
 );
}