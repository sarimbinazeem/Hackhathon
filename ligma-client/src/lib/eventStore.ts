export type Event = {
    id: string;
    type: string;
    payload: any;
    timestamp: number;
   };
   
   let events: Event[] = [];
   
   export const addEvent = (event: Event) => {
    events.push(event);
    console.log("EVENT:", event);
   };
   
   export const getEvents = () => events;