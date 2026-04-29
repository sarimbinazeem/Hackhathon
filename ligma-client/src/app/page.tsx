import Navbar from "../components/Navbar";
import CanvasArea from "../components/CanvasArea";
import TaskBoard from "../components/TaskBoard";
import EventLog from "../components/EventLog";

export default function Home(){
return(
<div className="min-h-screen flex flex-col">

<Navbar/>

<div className="flex flex-1">
<CanvasArea/>
<TaskBoard/>
</div>

<EventLog/>

</div>
)
}