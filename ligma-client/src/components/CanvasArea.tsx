"use client";

import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

export default function CanvasArea(){

return(
<div className="flex-1 p-4 bg-gray-50">

<h2 className="text-xl font-semibold mb-3">
Conflict Negotiation Canvas
</h2>

<div className="relative h-[700px] rounded-2xl overflow-hidden border">

<div className="absolute top-6 left-6 z-10 bg-red-200 p-4 rounded-xl shadow">
🟥 Red Zone
Risk / Constraints
</div>

<div className="absolute top-6 right-6 z-10 bg-green-200 p-4 rounded-xl shadow">
🟩 Green Zone
Approved Solutions
</div>

<Tldraw />

</div>

</div>
)
}