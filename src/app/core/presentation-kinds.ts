import { categoryKey } from './categories';
import { Product, ProductFamily } from './models';

export type StandardPresentation='Caja'|'Caja 2'|'Unidad';
export function standardPresentation(value?:string):StandardPresentation|undefined {
 const key=categoryKey(value??'');
 return key==='caja'?'Caja':key==='caja 2'?'Caja 2':key==='unidad'?'Unidad':undefined;
}
export const presentationOrder=(value?:string)=>value==='Caja'?0:value==='Caja 2'?1:value==='Unidad'?2:3;
export function boxUnits(product:Pick<Product,'presentation'|'unitsPerBox'>,family?:Pick<ProductFamily,'unitsPerBox'>):number|undefined {
 const kind=standardPresentation(product.presentation);
 return kind==='Caja'?family?.unitsPerBox??product.unitsPerBox:kind==='Caja 2'?product.unitsPerBox:undefined;
}
export function presentationCaption(value?:string,units?:number):string {
 const kind=standardPresentation(value),label=kind==='Caja'?'Caja principal':kind==='Caja 2'?'Segunda caja':value??'Presentación sin indicar';
 return (kind==='Caja'||kind==='Caja 2')&&units!==undefined?label+' · '+units+' unidades':label;
}
