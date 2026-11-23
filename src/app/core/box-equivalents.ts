import { ProductFamily } from './models';
import { categoryKey } from './categories';

export const validUnitsPerBox=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;

export function setUnitsPerBox(family:ProductFamily,value:number|null|undefined):void {
 if(value===undefined)return;
 if(value===null){delete family.unitsPerBox;return;}
 if(!validUnitsPerBox(value))throw Error('Unidades por caja: ingresá un número entero mayor que cero');
 family.unitsPerBox=value;
}

export function setBoxesPerPack(family:ProductFamily,value:number|null|undefined):void {
 if(value===undefined)return;
 if(value===null){delete family.boxesPerPack;return;}
 if(!validUnitsPerBox(value))throw Error('Cajas por pack: ingresá un número entero mayor que cero');
 family.boxesPerPack=value;
}

export interface BoxEquivalence {
 unitsPerBox:number;
 boxes:number;
 looseUnits:number;
 unconvertedUnits:number;
 totalBoxes:number;
 totalUnits:number;
 boxesPerPack?:number;
 totalPacks?:number;
 partial:boolean;
}

// A derived quantity for reports. The current explicit catalog setting applies
// to older sales too; recorded sale quantities, prices and closings never change.
export function boxEquivalence(rows:{quantity:number;presentation?:string;unitsPerBox?:number}[],unitsPerBox:number,boxesPerPack?:number):BoxEquivalence {
 if(!validUnitsPerBox(unitsPerBox))throw Error('Unidades por caja inválidas');
 if(boxesPerPack!==undefined&&!validUnitsPerBox(boxesPerPack))throw Error('Cajas por pack inválidas');
 let boxes=0,looseUnits=0,unconvertedUnits=0,totalUnits=0;
 for(const row of rows){
  const kind=categoryKey(row.presentation??'');
  if(kind==='caja'||kind==='caja 2'){
   const capacity=row.unitsPerBox??(kind==='caja'?unitsPerBox:undefined);
   if(capacity===undefined){unconvertedUnits+=row.quantity;continue;}
   if(!validUnitsPerBox(capacity))throw Error('Unidades de la presentación de caja inválidas');
   boxes+=row.quantity;totalUnits+=row.quantity*capacity;
  }else if(kind==='unidad'){looseUnits+=row.quantity;totalUnits+=row.quantity;}
  else unconvertedUnits+=row.quantity;
 }
 const totalBoxes=totalUnits/unitsPerBox;
 return {unitsPerBox,boxes,looseUnits,unconvertedUnits,totalBoxes,totalUnits,...(boxesPerPack!==undefined?{boxesPerPack,totalPacks:totalBoxes/boxesPerPack}:{}),partial:unconvertedUnits>0};
}
