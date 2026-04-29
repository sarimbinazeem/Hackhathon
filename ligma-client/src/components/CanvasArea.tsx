"use client";

import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

export default function CanvasArea(){

 return(
  <div className="flex-1 p-4 bg-gray-50">

   <h2 className="text-xl font-semibold mb-3">
    Infinite Canvas
   </h2>

   <div className="h-[700px] rounded-2xl overflow-hidden border">
      <Tldraw />
   </div>

  </div>
 )
}