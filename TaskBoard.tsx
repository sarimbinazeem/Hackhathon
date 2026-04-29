const tasks=[
{
 id:"1",
 title:"Design login page",
 author:"Amna"
},
{
 id:"2",
 title:"Setup database",
 author:"Warisha"
}
]

export default function TaskBoard(){
 return(
<div className="w-80 border-l p-4">

<h2 className="text-xl font-semibold mb-4">
 Task Board
</h2>

{tasks.map(task=>(
<div
key={task.id}
className="border rounded-xl p-3 mb-3"
>
<h3 className="font-medium">
{task.title}
</h3>
<p className="text-sm text-gray-500">
By {task.author}
</p>
</div>
))}

</div>
)
}