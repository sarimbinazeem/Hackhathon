"use client";

import { useEffect, useState } from "react";
import { getEvents } from "../lib/eventStore";

export default function EventLog() {
 const [events, setEvents] = useState<any[]>([]);

 useEffect(() => {
  const interval = setInterval(() => {
   setEvents([...getEvents()]);
  }, 500);

  return () => clearInterval(interval);
 }, []);

 return (
  <div className="w-full border-t p-3 bg-gray-100">

   <h3 className="font-semibold mb-2">
    Event Log (Live)
   </h3>

   <div className="text-sm space-y-1 max-h-24 overflow-auto">

    {events.length === 0 && (
     <p className="text-gray-400">
      No events yet
     </p>
    )}

    {events.map((e) => (
     <div key={e.id}>
      {e.type} → {JSON.stringify(e.payload)}
     </div>
    ))}

   </div>

  </div>
 );
}