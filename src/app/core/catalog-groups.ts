import { Data, Product } from './models';
import { categoryKey, findCategory } from './categories';
import { addFamily, archiveFamily, catalogFamilies, renameFamily } from './product-families';
import { deleteProduct, validateCatalog } from './catalog';
import { standardPresentation, StandardPresentation } from './product-presentations';
import { setUnitsPerBox, setBoxesPerPack, validUnitsPerBox } from './box-equivalents';

export interface ExistingProductGroupDraft {
 name:string;
 category:string;
 familyId?:string;
 boxProductId?:string;
 unitProductId?:string;
 secondBoxProductId?:string;secondBoxUnitsPerBox?:number|null;
 unitsPerBox?:number|null;
 boxesPerPack?:number|null;
}

// Link the selected IDs directly. Never infer a match from names or regenerate
// commercial fields: even inactive SKUs and old sales retain their identity.
export function groupExistingProducts(data:Data,draft:ExistingProductGroupDraft,newId:()=>string=()=>crypto.randomUUID()):string {
 const next=structuredClone(data),category=findCategory(next,draft.category);
 const selections:[StandardPresentation,string|undefined][]=[['Caja',draft.boxProductId],['Caja 2',draft.secondBoxProductId],['Unidad',draft.unitProductId]];
 const ids=selections.map(([,id])=>id).filter((id):id is string=>!!id);
 if(!ids.length)throw Error('Elegí al menos un producto ya cargado');
 if(new Set(ids).size!==ids.length)throw Error('Caja y unidad deben ser productos distintos');
 let family=draft.familyId?catalogFamilies(next).find(f=>f.id===draft.familyId):undefined;
 if(draft.familyId&&!family)throw Error('Este producto ya no está disponible. Volvé a abrir la ficha.');
 if(family?.category&&family.category!==category)throw Error('Cambió la categoría. Volvé a abrir la ficha.');
 const products=ids.map(id=>next.products.find(p=>p.id===id&&!p.deletedAt));
 if(products.some(p=>!p||p.category!==category))throw Error('Uno de los productos ya no está en esta categoría. Volvé a seleccionarlo.');
 if(products.some(p=>p!.familyId&&p!.familyId!==family?.id))throw Error('Uno de los productos ya está agrupado. Separalo desde su ficha antes de volver a agruparlo.');
 if(family){
  // A stale form must not replace an already-linked presentation.
  for(const [kind,id] of selections){
   if(kind==='Caja 2'&&draft.secondBoxProductId===undefined)continue;
   const current=next.products.filter(p=>!p.deletedAt&&p.familyId===family!.id&&standardPresentation(p.presentation)===kind);
   if(current.length>1||current.length===1&&current[0].id!==id)throw Error('Cambió la venta por '+kind.toLowerCase()+'. Volvé a abrir la ficha.');
  }
  renameFamily(next,family.id,draft.name);
 }else{
  if(catalogFamilies(next).some(f=>categoryKey(f.name)===categoryKey(draft.name)))throw Error('Ya existe un producto con ese nombre. Abrí su ficha para vincular los que faltan.');
  const id=newId();if(!id||next.products.some(p=>p.id===id)||(next.productFamilies??[]).some(f=>f.id===id))throw Error('ID de catálogo duplicado');
  family=addFamily(next,id,draft.name);
 }
 family.category=category;
 setUnitsPerBox(family,draft.unitsPerBox);
 setBoxesPerPack(family,draft.boxesPerPack);
 for(const [kind,id] of selections){
  if(!id)continue;
  const p=next.products.find(p=>p.id===id)!;
  if(p.presentation&&standardPresentation(p.presentation)!==kind)throw Error('Ese producto ya tiene otra forma de venta. Separalo antes de cambiarla.');
  if(kind==='Caja 2'){const capacity=draft.secondBoxUnitsPerBox===undefined?p.unitsPerBox:draft.secondBoxUnitsPerBox;if(!validUnitsPerBox(capacity))throw Error('Indicá cuántas unidades trae la segunda caja');p.unitsPerBox=capacity;}
  p.familyId=family.id;p.presentation=kind;
 }
 validateCatalog(next);
 data.products=next.products;data.productFamilies=next.productFamilies;
 return family.id;
}

// Undo a grouping without deleting, repricing or activating any sale product.
export function separateProductGroup(data:Data,familyId:string,at=new Date().toISOString()):void {
 const next=structuredClone(data);
 for(const p of next.products)if(!p.deletedAt&&p.familyId===familyId){delete p.familyId;delete p.presentation;}
 archiveFamily(next,familyId,at);validateCatalog(next);
 data.products=next.products;data.productFamilies=next.productFamilies;
}

export function deleteProductGroup(data:Data,familyId:string,at=new Date().toISOString()):void {
 const next=structuredClone(data);
 for(const p of next.products)if(!p.deletedAt&&p.familyId===familyId)deleteProduct(next,p.id,at);
 archiveFamily(next,familyId,at);validateCatalog(next);
 data.products=next.products;data.productFamilies=next.productFamilies;
}

export interface CatalogEntry {key:string;name:string;familyId?:string;products:Product[]}
const collator=new Intl.Collator('es',{sensitivity:'base',numeric:true});
const searchKey=(value:string)=>categoryKey(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function catalogEntries(data:Data,category:string,query=''):CatalogEntry[] {
 const products=data.products.filter(p=>!p.deletedAt&&p.category===category),result:CatalogEntry[]=[];
 const order=(p:Product)=>standardPresentation(p.presentation)==='Caja'?0:standardPresentation(p.presentation)==='Caja 2'?1:standardPresentation(p.presentation)==='Unidad'?2:3;
 for(const f of catalogFamilies(data)){
  const children=products.filter(p=>p.familyId===f.id);
  if(children.length||f.category===category||!f.category&&category===data.categories[0]&&!data.products.some(p=>!p.deletedAt&&p.familyId===f.id))
   result.push({key:'group:'+f.id,name:f.name,familyId:f.id,products:children.sort((a,b)=>order(a)-order(b)||collator.compare(a.name,b.name))});
 }
 for(const p of products)if(!p.familyId)result.push({key:'product:'+p.id,name:p.name,products:[p]});
 const needle=searchKey(query.trim());
 return result.filter(e=>!needle||searchKey([e.name,...e.products.flatMap(p=>[p.name,p.gridoName??''])].join(' ')).includes(needle)).sort((a,b)=>collator.compare(a.name,b.name)||a.key.localeCompare(b.key));
}
