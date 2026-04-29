export interface CanvasNode {
 id:string;
 type:"sticky" | "shape" | "text";
 x:number;
 y:number;
 content:string;
 author:string;
}