import type {HostNode} from '../main/host-runtime';
import type {ImageSource,ImageResult} from '../../shared/workspace';

export type Matrix = [[number,number,number],[number,number,number]];
type Point = {x:number;y:number};
type Rect = {x:number;y:number;width:number;height:number};
export const identity = ():Matrix=>[[1,0,0],[0,1,0]];
export function multiply(a:Matrix,b:Matrix):Matrix {
  return [0,1].map(i=>[
    a[i][0]*b[0][0]+a[i][1]*b[1][0],
    a[i][0]*b[0][1]+a[i][1]*b[1][1],
    a[i][0]*b[0][2]+a[i][1]*b[1][2]+a[i][2]
  ]) as Matrix;
}
function matrix(value:unknown):Matrix {
  if(!Array.isArray(value)||value.length!==2||value.some(row=>!Array.isArray(row)||row.length!==3||row.some(n=>typeof n!=='number'||!Number.isFinite(n))))throw new Error('IMAGE_TRANSFORM_INVALID');
  return value as Matrix;
}
function inverse(m:Matrix):Matrix {
  const d=m[0][0]*m[1][1]-m[0][1]*m[1][0];
  if(!Number.isFinite(d)||Math.abs(d)<1e-10)throw new Error('IMAGE_TRANSFORM_INVALID');
  return [[m[1][1]/d,-m[0][1]/d,(m[0][1]*m[1][2]-m[1][1]*m[0][2])/d],[-m[1][0]/d,m[0][0]/d,(m[1][0]*m[0][2]-m[0][0]*m[1][2])/d]];
}
function point(m:Matrix,p:Point):Point{return{x:m[0][0]*p.x+m[0][1]*p.y+m[0][2],y:m[1][0]*p.x+m[1][1]*p.y+m[1][2]};}
const corners=(r:Rect):Point[]=>[{x:r.x,y:r.y},{x:r.x+r.width,y:r.y},{x:r.x+r.width,y:r.y+r.height},{x:r.x,y:r.y+r.height}];
function bounds(points:Point[]):Rect {
  if(!points.length)throw new Error('IMAGE_CROP_OUTSIDE_VIEW');
  const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  const width=Math.max(...points.map(p=>p.x))-x,height=Math.max(...points.map(p=>p.y))-y;
  if(![x,y,width,height].every(Number.isFinite)||width<1e-8||height<1e-8)throw new Error('IMAGE_CROP_OUTSIDE_VIEW');
  return{x,y,width,height};
}
// Clip the transformed source bounds against the original node viewport. Using
// a polygon (not intersecting two AABBs) also handles rotated image paints.
function clip(points:Point[]):Point[] {
  for(const [axis,edge,sign]of [['x',0,1],['x',1,-1],['y',0,1],['y',1,-1]] as const){
    const input=points;points=[];
    for(let i=0;i<input.length;i++){
      const a=input[i],b=input[(i+1)%input.length],da=(a[axis]-edge)*sign,db=(b[axis]-edge)*sign;
      if(da>=-1e-10)points.push(a);
      if((da<0)!==(db<0)){const t=da/(da-db);points.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}
    }
  }
  return points;
}
export function relative(node:HostNode):Matrix {
  if(node.relativeTransform)return matrix(node.relativeTransform);
  const a=-(node.rotation??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return [[c,-s,node.x??0],[s,c,node.y??0]];
}
export function absolute(node:HostNode):Matrix {
  if(node.absoluteTransform)return matrix(node.absoluteTransform);
  return node.parent&&node.parent.type!=='PAGE'?multiply(absolute(node.parent),relative(node)):relative(node);
}
export function placementFingerprint(node:HostNode):string {
  const ancestors=[];for(let p=node.parent;p&&p.type!=='DOCUMENT';p=p.parent)ancestors.push([p.id,p.type,p.layoutMode,p.layoutSizingHorizontal,p.layoutSizingVertical]);
  return JSON.stringify([node.parent?.id,node.width,node.height,absolute(node),node.fills,node.type,node.cornerRadius,node.topLeftRadius,node.topRightRadius,node.bottomLeftRadius,node.bottomRightRadius,node.strokes,ancestors]);
}
export function imageFill(node:HostNode):{fill:any;index:number;fills:any[]} {
  const fills=Array.isArray(node.fills)?node.fills:[],indices=fills.map((f:any,i:number)=>f.type==='IMAGE'&&f.visible!==false&&f.isVisible!==false?i:-1).filter(i=>i>=0);
  if(indices.length!==1)throw new Error('IMAGE_FILL_UNSUPPORTED');
  return{fill:fills[indices[0]],index:indices[0],fills};
}
// Figma CROP maps normalized node coordinates to normalized source-image UVs.
// Derive that same mapping for centered FIT/FILL before changing image pixels.
export function imageMapping(node:HostNode,source:ImageSource,fill:any):Matrix {
  if(!(node.width!>0&&node.height!>0&&source.width>0&&source.height>0))throw new Error('IMAGE_TRANSFORM_INVALID');
  if(fill.scaleMode==='CROP'){const t=matrix(fill.imageTransform??identity());inverse(t);return t;}
  const rotations:Record<number,Matrix>={0:identity(),90:[[0,1,0],[-1,0,1]],180:[[-1,0,1],[0,-1,1]],270:[[0,-1,1],[1,0,0]]};
  const angle=((fill.rotation??0)%360+360)%360,rotation=rotations[angle];
  if(!rotation)throw new Error('IMAGE_TRANSFORM_INVALID');
  if(!['FIT','FILL','TILE',undefined].includes(fill.scaleMode))throw new Error('IMAGE_FILL_UNSUPPORTED');
  const swapped=angle===90||angle===270,w=swapped?source.height:source.width,h=swapped?source.width:source.height;
  const scale=fill.scaleMode==='TILE'?(fill.scalingFactor??1):(fill.scaleMode==='FIT'?Math.min:Math.max)(node.width!/w,node.height!/h);
  if(!Number.isFinite(scale)||scale<=0)throw new Error('IMAGE_TRANSFORM_INVALID');
  const dw=w*scale,dh=h*scale;
  return multiply(rotation,[[node.width!/dw,0,(dw-node.width!)/(2*dw)],[0,node.height!/dh,(dh-node.height!)/(2*dh)]]);
}
export function shouldKeepFrame(node:HostNode):boolean {
  for(let p:HostNode|null|undefined=node;p;p=p.parent)if(p.type==='INSTANCE')return true;
  const layout=node.parent?.layoutMode;
  const {fills,index}=imageFill(node);
  return node.type!=='RECTANGLE'||!!(layout&&layout!=='NONE')||[node.cornerRadius,node.topLeftRadius,node.topRightRadius,node.bottomLeftRadius,node.bottomRightRadius].some(n=>typeof n==='number'&&n>0)
    ||fills.some((p:any,i:number)=>i!==index&&p.visible!==false&&p.isVisible!==false)
    ||Array.isArray(node.strokes)&&node.strokes.some((p:any)=>p.visible!==false);
}
export function planPlacement(node:HostNode,source:ImageSource,result:ImageResult,replace:boolean){
  const {fill}=imageFill(node);
  if(replace&&fill.scaleMode==='TILE')throw new Error('IMAGE_TILE_REPLACE_UNSUPPORTED');
  const t=imageMapping(node,source,fill),b:Rect={x:(result.offsetX??0)/source.width,y:(result.offsetY??0)/source.height,width:(result.sourceWidth??result.width)/source.width,height:(result.sourceHeight??result.height)/source.height};
  const mapped=corners(b).map(p=>point(inverse(t),p));
  const keepFrame=replace&&shouldKeepFrame(node);
  const r=keepFrame?{x:0,y:0,width:1,height:1}:bounds(replace?clip(mapped):mapped);
  const local:Matrix=[[1,0,r.x*node.width!],[0,1,r.y*node.height!]];
  const viewport:Matrix=[[r.width,0,r.x],[0,r.height,r.y]];
  const toCropped:Matrix=[[1/b.width,0,-b.x/b.width],[0,1/b.height,-b.y/b.height]];
  return{keepFrame,width:r.width*node.width!,height:r.height*node.height!,transform:multiply(replace?relative(node):absolute(node),local),paintTransform:multiply(toCropped,multiply(t,viewport))};
}
export function worldBounds(transform:Matrix,width:number,height:number):Rect{return bounds(corners({x:0,y:0,width,height}).map(p=>point(transform,p)));}
