interface Task {
    id: string;
    title: string;
    author: string;
    type: string;
   }
   
   export default function TaskBoard({ tasks }: { tasks: Task[] }) {
    return (
     <div className="w-80 border-l p-4 bg-white">
   
      <h2 className="text-xl font-semibold mb-4">
       Task Board
      </h2>
   
      {tasks.length === 0 && (
       <p className="text-gray-400 text-sm">
        No tasks yet
       </p>
      )}
   
      {tasks.map((task) => (
       <div
        key={task.id}
        className="border rounded-xl p-3 mb-3"
       >
        <h3 className="font-medium">
         {task.title}
        </h3>
   
        <p className="text-xs text-gray-500">
         {task.type} • by {task.author}
        </p>
       </div>
      ))}
   
     </div>
    );
   }