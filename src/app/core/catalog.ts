import { validUnitsPerBox } from './box-equivalents';
import { Data, Product, Category } from './models';
import { validateFamilies, catalogFamilies } from './product-families';
import { validVatRate } from './receipt';
import { validateIceCreamPortion } from './ice-cream';
import { categoryName, categoryKey, findCategory } from './categories';
export function migrateCatalog(data:Data):Data {
 const next=structuredClone(data);next.categoryDetails??=[];
 for(const name of next.categories)if(!next.categoryDetails.some(c=>!c.deletedAt&&categoryKey(c.name)===categoryKey(name))){
 let id='category:'+encodeURIComponent(categoryKey(name));while(next.categoryDetails.some(c=>c.id===id))id+=':legacy';next.categoryDetails.push({id,name,gridoName:name});
 }
 return next;
}
export function catalogCategories(data:Data):Category[] {return (data.categoryDetails??[]).filter(c=>!c.deletedAt);}
export function validateCatalog(data:Data):void {
 validateFamilies(data);
 for(const p of data.products){if(p.unitsPerBox!==undefined&&!validUnitsPerBox(p.unitsPerBox))throw Error('Unidades de la presentación de caja inválidas');validateIceCreamPortion(p);if(p.vatRate!==undefined&&!validVatRate(p.vatRate))throw Error('IVA de producto inválido');if(p.gridoName!==undefined&&(typeof p.gridoName!=='string'||!p.gridoName.trim()))throw Error('Nombre Grido de producto inválido');if(p.deletedAt!==undefined&&(typeof p.deletedAt!=='string'||!Number.isFinite(Date.parse(p.deletedAt))||p.active))throw Error('Producto eliminado inválido');}
 if(data.categoryDetails===undefined)return;
 if(!Array.isArray(data.categoryDetails)||new Set(data.categoryDetails.map(c=>c?.id)).size!==data.categoryDetails.length)throw Error('Catálogo de categorías inválido');
 for(const c of data.categoryDetails)if(!c||typeof c.id!=='string'||!c.id||typeof c.name!=='string'||!categoryName(c.name)||typeof c.gridoName!=='string'||!categoryName(c.gridoName)||c.deletedAt!==undefined&&(typeof c.deletedAt!=='string'||!Number.isFinite(Date.parse(c.deletedAt))))throw Error('Categoría inválida');
 if(data.categories===undefined)return;
 const live=catalogCategories(data);if(live.length!==data.categories.length||new Set(live.map(c=>categoryKey(c.name))).size!==live.length||live.some(c=>!data.categories.some(n=>categoryKey(n)===categoryKey(c.name))))throw Error('Categorías y nombres visibles inconsistentes');
}
export function saveProduct(data:Data,id:string,changes:{name:string;gridoName:string;category:string;price:number;vatRate?:number|null;iceCreamGrams?:number|null;iceCreamScoops?:number|null;familyId?:string|null;presentation?:string|null;unitsPerBox?:number|null}):Product {
 if(changes.unitsPerBox!=null&&!validUnitsPerBox(changes.unitsPerBox))throw Error('Unidades de la caja: ingresá un entero mayor que cero');
 const name=categoryName(changes.name),gridoName=categoryName(changes.gridoName),category=findCategory(data,changes.category);
 if(!name||!gridoName)throw Error('Completá nombre visible y nombre/código Grido');if(!Number.isSafeInteger(changes.price)||changes.price<=0)throw Error('Precio inválido');
 if(changes.vatRate!=null&&!validVatRate(changes.vatRate))throw Error('IVA inválido: ingresá un porcentaje entre 0 y 100, con hasta dos decimales');
 let p=data.products.find(p=>p.id===id);if(p?.deletedAt)throw Error('El producto fue eliminado');
 const familyId=changes.familyId===undefined?p?.familyId:changes.familyId??undefined;const presentation=changes.presentation===undefined?(changes.familyId===null?undefined:p?.presentation):changes.presentation===null?undefined:categoryName(changes.presentation);if(familyId&&!catalogFamilies(data).some(f=>f.id===familyId))throw Error('Elegí una familia válida');if(presentation&&!familyId)throw Error('Elegí una familia para definir la presentación');if(changes.presentation!=null&&!presentation)throw Error('Presentación inválida');
 const portion:{iceCreamGrams?:number;iceCreamScoops?:number}={...(p?.iceCreamGrams!==undefined?{iceCreamGrams:p.iceCreamGrams}:{}),...(p?.iceCreamScoops!==undefined?{iceCreamScoops:p.iceCreamScoops}:{})};for(const field of ['iceCreamGrams','iceCreamScoops'] as const){if(changes[field]===null)delete portion[field];else if(changes[field]!==undefined)portion[field]=changes[field]!;}validateIceCreamPortion(portion);
 if(p)Object.assign(p,{name,gridoName,category,price:changes.price});else{p={id,name,gridoName,category,price:changes.price,active:true};data.products.push(p);}if(changes.vatRate===null)delete p.vatRate;else if(changes.vatRate!==undefined)p.vatRate=changes.vatRate;for(const field of ['iceCreamGrams','iceCreamScoops'] as const){if(changes[field]===null)delete p[field];else if(changes[field]!==undefined)p[field]=changes[field]!;}validateIceCreamPortion(p);if(changes.unitsPerBox===null)delete p.unitsPerBox;else if(changes.unitsPerBox!==undefined)p.unitsPerBox=changes.unitsPerBox;if(familyId)p.familyId=familyId;else delete p.familyId;if(presentation)p.presentation=presentation;else delete p.presentation;return p;
}
export function deleteProduct(data:Data,id:string,at=new Date().toISOString()):void {
 const p=data.products.find(p=>p.id===id&&!p.deletedAt);if(!p)throw Error('Producto no encontrado');p.active=false;p.deletedAt=at;
}
export function renameCategory(data:Data,id:string,nameInput:string,gridoInput:string):Category {
 const c=data.categoryDetails?.find(c=>c.id===id&&!c.deletedAt);if(!c)throw Error('Categoría no encontrada');
 const name=categoryName(nameInput),gridoName=categoryName(gridoInput);if(!name||!gridoName)throw Error('Completá ambos nombres de categoría');
 if(catalogCategories(data).some(other=>other.id!==id&&categoryKey(other.name)===categoryKey(name)))throw Error('Esa categoría ya existe');
 const oldName=c.name;for(const f of data.productFamilies??[])if(f.category===oldName)f.category=name;data.categories=data.categories.map(n=>n===oldName?name:n);for(const p of data.products)if(p.category===oldName)p.category=name;c.name=name;c.gridoName=gridoName;return c;
}
export function deleteCategory(data:Data,id:string,targetId?:string,at=new Date().toISOString()):void {
 const c=data.categoryDetails?.find(c=>c.id===id&&!c.deletedAt);if(!c)throw Error('Categoría no encontrada');const products=data.products.filter(p=>!p.deletedAt&&p.category===c.name);
 const bases=(data.productFamilies??[]).filter(f=>!f.deletedAt&&f.category===c.name);
 if(products.length||bases.length){const target=data.categoryDetails?.find(c=>c.id===targetId&&!c.deletedAt&&c.id!==id);if(!target)throw Error('Elegí otra categoría para mover sus productos');for(const p of products)p.category=target.name;for(const f of bases)f.category=target.name;}
 data.categories=data.categories.filter(n=>n!==c.name);c.deletedAt=at;
}
