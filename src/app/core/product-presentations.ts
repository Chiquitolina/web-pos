import { Data } from './models';
import { categoryKey, categoryName, findCategory } from './categories';
import { addFamily, renameFamily, catalogFamilies } from './product-families';
import { saveProduct, validateCatalog } from './catalog';
import { setUnitsPerBox, setBoxesPerPack, validUnitsPerBox } from './box-equivalents';

import { StandardPresentation, standardPresentation } from './presentation-kinds';
export { StandardPresentation, standardPresentation } from './presentation-kinds';
export interface BaseProductDraft {
 baseName:string;category:string;familyId?:string;unitsPerBox?:number|null;boxesPerPack?:number|null;
 existing?:{productId:string;kind:StandardPresentation};
 rows:(PresentationProductDraft&{active:boolean;productId?:string})[];
}
export type PresentationProductDraft = {
 kind:StandardPresentation; name:string; gridoName:string; price:number;
 vatRate?:number|null; iceCreamGrams?:number|null; iceCreamScoops?:number|null;unitsPerBox?:number|null;
};
export interface ProductPresentationsDraft {
 baseName:string; category:string; familyId?:string;
 existing?:{productId:string;kind:StandardPresentation};
 presentations:PresentationProductDraft[];
}
export const presentationName=(base:string,kind:StandardPresentation,units?:number|null)=>
 categoryName(base)+(kind==='Unidad'?' por unidad':units?' caja x'+units:kind==='Caja 2'?' caja adicional':' caja');

// Validate on a copy so a bad second presentation cannot leave the first one,
// an empty family, or an existing product partially modified.
export function createProductPresentations(data:Data,draft:ProductPresentationsDraft,newId:()=>string=()=>crypto.randomUUID()):{familyId:string;productIds:string[]} {
 if(!Array.isArray(draft.presentations)||!draft.presentations.length||draft.presentations.length>3)throw Error('Elegí al menos una presentación para crear');
 const kinds=draft.presentations.map(p=>p.kind);
 if(kinds.some(k=>!['Caja','Caja 2','Unidad'].includes(k))||new Set(kinds).size!==kinds.length)throw Error('Presentaciones inválidas o repetidas');
 const next=structuredClone(data),category=findCategory(next,draft.category);
 const id=()=>{const value=newId();if(typeof value!=='string'||!value||next.products.some(p=>p.id===value)||(next.productFamilies??[]).some(f=>f.id===value))throw Error('ID de catálogo duplicado');return value;};
 let family=draft.familyId?catalogFamilies(next).find(f=>f.id===draft.familyId):undefined;
 if(draft.familyId&&!family)throw Error('La familia ya no está disponible');
 if(!family){const name=categoryName(draft.baseName);if(!name)throw Error('Ingresá el nombre base del producto');if(catalogFamilies(next).some(f=>categoryKey(f.name)===categoryKey(name)))throw Error('Esta familia ya existe. Elegila en Familia o usá Agregar presentación.');family=addFamily(next,id(),name);}
 if(draft.existing){
  const {productId,kind}=draft.existing;
  if(!['Caja','Caja 2','Unidad'].includes(kind))throw Error('Indicá si el producto existente es caja o unidad');
  const current=next.products.find(p=>p.id===productId&&!p.deletedAt);
  if(!current)throw Error('El producto existente ya no está disponible');
  if(current.category!==category)throw Error('Cambió la categoría del producto existente. Volvé a abrir Agregar presentación.');
  if(current.familyId&&current.familyId!==family.id)throw Error('El producto ya pertenece a otra familia. Revisá su asignación.');
  if(current.presentation&&standardPresentation(current.presentation)!==kind)throw Error('El producto ya tiene otra presentación. Revisala desde Editar.');
  if(next.products.some(p=>!p.deletedAt&&p.id!==current.id&&p.familyId===family!.id&&standardPresentation(p.presentation)===kind))throw Error('La familia ya tiene una presentación '+kind.toLowerCase());
  current.familyId=family.id;current.presentation=kind;
 }
 const productIds:string[]=[];
 for(const row of draft.presentations){
  if(next.products.some(p=>!p.deletedAt&&p.familyId===family!.id&&standardPresentation(p.presentation)===row.kind))throw Error('La familia ya tiene una presentación '+row.kind.toLowerCase()+'. Editá el producto existente.');
  if(row.kind==='Caja 2'&&!validUnitsPerBox(row.unitsPerBox))throw Error('Indicá cuántas unidades trae la segunda caja');
  const name=categoryName(row.name);
  if(next.products.some(p=>!p.deletedAt&&p.category===category&&categoryKey(p.name)===categoryKey(name)))throw Error('Ya existe un producto llamado '+name+' en esta categoría. Editalo o vinculalo desde Asignar familia.');
  const productId=id();
  saveProduct(next,productId,{name,gridoName:row.gridoName,price:row.price,category,familyId:family.id,presentation:row.kind,vatRate:row.vatRate,iceCreamGrams:row.iceCreamGrams,iceCreamScoops:row.iceCreamScoops,unitsPerBox:row.kind==='Caja 2'?row.unitsPerBox:row.kind==='Caja'?null:undefined});
  productIds.push(productId);
 }
 validateCatalog(next);
 data.products=next.products;data.productFamilies=next.productFamilies;
 return {familyId:family.id,productIds};
}

// A base can exist with no sale presentations. Disabling preserves the SKU and
// its commercial data; enabling it again uses the exact same product ID.
export function saveBaseProduct(data:Data,draft:BaseProductDraft,newId:()=>string=()=>crypto.randomUUID()):{familyId:string;productIds:string[]} {
 if(!Array.isArray(draft.rows)||![2,3].includes(draft.rows.length)||new Set(draft.rows.map(r=>r.kind)).size!==draft.rows.length||!draft.rows.some(r=>r.kind==='Caja')||!draft.rows.some(r=>r.kind==='Unidad')||draft.rows.some(r=>!['Caja','Caja 2','Unidad'].includes(r.kind)||typeof r.active!=='boolean'))throw Error('Revisá las opciones de caja y unidad');
 const next=structuredClone(data),category=findCategory(next,draft.category);
 const id=()=>{const value=newId();if(typeof value!=='string'||!value||next.products.some(p=>p.id===value)||(next.productFamilies??[]).some(f=>f.id===value))throw Error('ID de catálogo duplicado');return value;};
 let family=draft.familyId?catalogFamilies(next).find(f=>f.id===draft.familyId):undefined;
 if(draft.familyId&&!family)throw Error('El producto ya no está disponible. Volvé a abrir la ficha.');
 if(family&&next.products.some(p=>!p.deletedAt&&p.familyId===family!.id&&p.category!==category))throw Error('Esta agrupación tiene productos de distintas categorías. Revisalos desde Más opciones antes de guardar.');
 if(!family&&catalogFamilies(next).some(f=>categoryKey(f.name)===categoryKey(draft.baseName)))throw Error('Ya existe un producto con ese nombre. Abrí su ficha para editarlo.');
 if(family){renameFamily(next,family.id,draft.baseName);}else{family=addFamily(next,id(),draft.baseName);}
 family.category=category;
 setUnitsPerBox(family,draft.unitsPerBox);
 setBoxesPerPack(family,draft.boxesPerPack);
 if(draft.existing){
  const {productId,kind}=draft.existing,current=next.products.find(p=>p.id===productId&&!p.deletedAt);
  if(!current||current.category!==category||!['Caja','Caja 2','Unidad'].includes(kind))throw Error('Revisá el producto existente y su presentación');
  if(current.familyId&&current.familyId!==family.id)throw Error('El producto ya pertenece a otro producto base');
  if(current.presentation&&standardPresentation(current.presentation)!==kind)throw Error('El producto ya tiene otra presentación');
  current.familyId=family.id;current.presentation=kind;
 }
 const productIds:string[]=[];
 for(const row of draft.rows){
  const matches=next.products.filter(p=>!p.deletedAt&&p.familyId===family!.id&&standardPresentation(p.presentation)===row.kind);
  if(matches.length>1)throw Error('Hay varios productos '+row.kind.toLowerCase()+' vinculados. Revisá la asignación antes de guardar.');
  const current=matches[0];
  if((row.productId&&current?.id!==row.productId)||(!row.productId&&current))throw Error('Cambió una presentación. Volvé a abrir la ficha.');
  if(!row.active){if(current){current.active=false;productIds.push(current.id);}continue;}
  if(row.kind==='Caja 2'&&!validUnitsPerBox(row.unitsPerBox))throw Error('Indicá cuántas unidades trae la segunda caja');
  const name=categoryName(row.name);
  if(next.products.some(p=>!p.deletedAt&&p.id!==current?.id&&p.category===category&&categoryKey(p.name)===categoryKey(name)))throw Error('Ya existe '+name+'. Usá Agrupar productos existentes o editá el que ya tenés.');
  const saved=saveProduct(next,current?.id??id(),{name,gridoName:row.gridoName,price:row.price,category,familyId:family.id,presentation:row.kind,vatRate:row.vatRate,iceCreamGrams:row.iceCreamGrams,iceCreamScoops:row.iceCreamScoops,unitsPerBox:row.kind==='Caja 2'?row.unitsPerBox:row.kind==='Caja'?null:undefined});
  saved.active=true;productIds.push(saved.id);
 }
 validateCatalog(next);data.products=next.products;data.productFamilies=next.productFamilies;
 return {familyId:family.id,productIds};
}
