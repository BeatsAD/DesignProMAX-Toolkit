export type RegionName={adcode:number;name:string;level:string;parentAdcode?:number};
export const VECTOR_MAP_ITEMS:RegionName[]=[];
export function hydrateRegionNames(items:RegionName[]){VECTOR_MAP_ITEMS.splice(0,VECTOR_MAP_ITEMS.length,...items);}
