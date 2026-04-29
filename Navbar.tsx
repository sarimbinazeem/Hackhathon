export default function Navbar(){
 return(
  <div className="w-full p-4 border-b flex justify-between items-center">
   <h1 className="text-2xl font-bold">
    LIGMA Workspace
   </h1>

   <div className="flex gap-4">
    <button className="border px-4 py-2 rounded-xl">
      Share
    </button>

    <button className="border px-4 py-2 rounded-xl">
      Export
    </button>
   </div>
  </div>
 )
}