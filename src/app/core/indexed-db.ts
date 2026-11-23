import { Data, Sale, Session, PriceAuditEntry, PriceAuditSource, emptyData } from './models';
import { validateData } from './domain';
import { productAuditChanges, validatePriceAudit, samePriceAudit } from './price-audit';
import { HistoryFilter, HistoryPage, dayBounds, paginateSales } from './history';
import { MetricsAccumulator, MetricsFilter, MetricsSnapshot, validateMetricsFilter } from './metrics';

const STORES=['meta','products','categories','sales','sessions','weeks','priceAudit','productFamilies'] as const;
export interface Meta {
 key:'app'; nextSaleNumber:number; salesCount:number; cancelledCount:number; total:number;
 unassignedCount:number; revision:number; categoryOrder:string[];
 entityOrder:Record<'products'|'categories'|'sessions'|'weeks',string[]>&{productFamilies?:string[]};
}
export interface Scope { priceSource?:PriceAuditSource; saleId?:string; sessionId?:string; weekId?:string; fromDate?:string }
export interface View { data:Data; meta:Meta }
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const completion=(tx:IDBTransaction)=>{const done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('Operación cancelada'));tx.onerror=()=>reject(tx.error??Error('Error al guardar datos'));});void done.catch(()=>{});return done;};
const distinct=(sales:Sale[])=>[...new Map(sales.map(s=>[s.id,s])).values()];
export function metadata(data:Data,revision=0):Meta {
 const meta:Meta={key:'app',nextSaleNumber:1,salesCount:0,cancelledCount:0,total:0,unassignedCount:0,revision,categoryOrder:[...data.categories],entityOrder:{products:data.products.map(p=>p.id),categories:(data.categoryDetails??[]).map(c=>c.id),sessions:data.sessions.map(s=>s.id),weeks:data.weeks.map(w=>w.id)}};
 if(data.productFamilies!==undefined)meta.entityOrder.productFamilies=data.productFamilies.map(f=>f.id);
 for(const sale of data.sales){meta.nextSaleNumber=Math.max(meta.nextSaleNumber,sale.number+1);if(sale.cancellation)meta.cancelledCount++;else{meta.salesCount++;meta.total+=sale.total;}if(!sale.weekId)meta.unassignedCount++;}return meta;
}
function writeAll(tx:IDBTransaction,data:Data,meta:Meta):void {
 tx.objectStore('meta').put(meta);
 for(const name of ['products','sales','sessions','weeks'] as const)for(const row of data[name])tx.objectStore(name).put(row);
 for(const row of data.categoryDetails??[])tx.objectStore('categories').put(row);
 for(const row of data.priceAudit??[])tx.objectStore('priceAudit').put(row);
 for(const row of data.productFamilies??[])tx.objectStore('productFamilies').put(row);
}
export class PosDatabase {
 private constructor(private db:IDBDatabase) {}
 static async open(name:string,onBlocked?:()=>void,onVersionChange?:()=>void):Promise<PosDatabase> {
  return new Promise((resolve,reject)=>{
   const r=indexedDB.open(name,4);let failure:unknown;
   r.onblocked=()=>onBlocked?.();
   r.onupgradeneeded=(event)=>{
    const db=r.result,tx=r.transaction!;
    for(const name of STORES)if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:name==='meta'?'key':'id'});
    if(!tx.objectStore('priceAudit').indexNames.contains('byAt'))tx.objectStore('priceAudit').createIndex('byAt','at');
    if(event.oldVersion>=2)return;
    const sales=tx.objectStore('sales');
    sales.createIndex('byNumber','number',{unique:true});sales.createIndex('bySession','sessionId');sales.createIndex('byWeek','weekId');sales.createIndex('byAt','at');sales.createIndex('byCancellationAt','cancellation.at');
    const populate=(saved:unknown)=>{try{const data=validateData(saved??emptyData());writeAll(tx,data,metadata(data));if(db.objectStoreNames.contains('state'))db.deleteObjectStore('state');}catch(e){failure=e;tx.abort();}};
    if(db.objectStoreNames.contains('state')){const old=tx.objectStore('state').get('data');old.onsuccess=()=>populate(old.result);}else populate(undefined);
   };
   r.onerror=()=>reject(failure??r.error);
   r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();onVersionChange?.();};resolve(new PosDatabase(r.result));};
  });
 }
 close(){this.db.close();}
 private async base(tx:IDBTransaction):Promise<View> {
  const [meta,products,categoryDetails,sessions,weeks,productFamilies]=await Promise.all([
   request<Meta>(tx.objectStore('meta').get('app')),request(tx.objectStore('products').getAll()),request(tx.objectStore('categories').getAll()),request(tx.objectStore('sessions').getAll()),request(tx.objectStore('weeks').getAll()),request(tx.objectStore('productFamilies').getAll())
  ]);
  if(!meta)throw Error('Faltan metadatos del almacenamiento');
  const ordered=<T extends {id:string}>(rows:T[],name:keyof Meta['entityOrder'])=>{const positions=new Map((meta.entityOrder[name]??[]).map((id,n)=>[id,n]));return rows.sort((a,b)=>(positions.get(a.id)??Infinity)-(positions.get(b.id)??Infinity));};
  return {meta,data:{version:1,...(productFamilies.length||meta.entityOrder.productFamilies!==undefined?{productFamilies:ordered(productFamilies,'productFamilies')}:{}),categories:[...meta.categoryOrder],categoryDetails:ordered(categoryDetails,'categories'),products:ordered(products,'products'),sessions:ordered(sessions,'sessions'),weeks:ordered(weeks,'weeks'),sales:[]}};
 }
 async view():Promise<View> {
  const tx=this.db.transaction([...STORES]),done=completion(tx);const view=await this.base(tx),sales=tx.objectStore('sales'),reads:Promise<Sale[]>[]=[];
  const session=view.data.sessions.find(s=>!s.closing),week=view.data.weeks.find(w=>!w.closing);
  if(session)reads.push(request(sales.index('bySession').getAll(session.id)));
  if(week)reads.push(request(sales.index('byWeek').getAll(week.id)));
  reads.push(request(sales.index('byCancellationAt').getAll()));
  view.data.sales=distinct((await Promise.all(reads)).flat()).sort((a,b)=>a.number-b.number);await done;return view;
 }
 private historyRows(tx:IDBTransaction,page:number,size:number):Promise<Sale[]> {
  return new Promise<Sale[]>((resolve,reject)=>{const result:Sale[]=[];let skip=(page-1)*size;const r=tx.objectStore('sales').index('byNumber').openCursor(null,'prev');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const c=r.result;if(!c){resolve(result);return;}if(skip){const n=skip;skip=0;c.advance(n);return;}result.push(c.value);if(result.length===size)resolve(result);else c.continue();};});
 }
 async queryHistory(filter:HistoryFilter,page:number,size=25):Promise<HistoryPage> {
  if(!Number.isInteger(page)||page<1||!Number.isInteger(size)||size<1||size>100)throw Error('Página inválida');
  const bounds=filter.kind==='day'?dayBounds(filter.date):undefined;
  const tx=this.db.transaction(['meta','sales','sessions']),done=completion(tx);
  try{
   let result:HistoryPage;const sales=tx.objectStore('sales');
   if(filter.kind==='all'){
    const meta=await request<Meta>(tx.objectStore('meta').get('app'));const totals={salesCount:meta.salesCount,cancelledCount:meta.cancelledCount,total:meta.total},totalRows=totals.salesCount+totals.cancelledCount,pages=Math.max(1,Math.ceil(totalRows/size));page=Math.min(page,pages);
    result={rows:await this.historyRows(tx,page,size),page,pages,totalRows,totals};
   }else{
    let rows:Sale[]=[];
    if(filter.kind==='day')rows=await request(sales.index('byAt').getAll(IDBKeyRange.bound(bounds![0],bounds![1],false,true)));
    else{const id=filter.kind==='current'?(await request(tx.objectStore('sessions').getAll())).find(s=>!s.closing)?.id:filter.sessionId;
     if(id)rows=await request(sales.index('bySession').getAll(id));}
    result=paginateSales(rows,page,size);
   }
   await done;return result;
  }catch(e){try{tx.abort();}catch{}await done.catch(()=>{});throw e;}
 }
 async history(page:number,size=25):Promise<Sale[]> {const result=await this.queryHistory({kind:'all'},page,size);return page>result.pages?[]:result.rows;}
 async queryMetrics(filter:MetricsFilter,timeZone:string,now=new Date().toISOString(),signal?:AbortSignal):Promise<MetricsSnapshot> {
  validateMetricsFilter(filter);
  if(signal?.aborted)throw new DOMException('Consulta cancelada','AbortError');
  const tx=this.db.transaction(['meta','products','productFamilies','sales'],'readonly'),done=completion(tx);
  const abort=()=>{try{tx.abort();}catch{}};signal?.addEventListener('abort',abort,{once:true});
  try{
   const [meta,products,productFamilies]=await Promise.all([request<Meta>(tx.objectStore('meta').get('app')),request(tx.objectStore('products').getAll()),request(tx.objectStore('productFamilies').getAll())]);
   const accumulator=new MetricsAccumulator(filter,{products,productFamilies,categories:meta.categoryOrder},timeZone,now);
   // Scan every historical record, not just the current session/week cache.
   // Date filtering happens in local time; even imported ISO offsets are exact.
   await new Promise<void>((resolve,reject)=>{const r=tx.objectStore('sales').index('byAt').openCursor();r.onerror=()=>reject(r.error);r.onsuccess=()=>{const c=r.result;if(!c){resolve();return;}try{accumulator.add(c.value as Sale);c.continue();}catch(e){reject(e);}};tx.addEventListener('abort',()=>reject(tx.error??new DOMException('Consulta cancelada','AbortError')),{once:true});});
   await done;return {report:accumulator.finish(),revision:meta.revision};
  }catch(e){abort();await done.catch(()=>{});if(signal?.aborted)throw new DOMException('Consulta cancelada','AbortError');throw e;}finally{signal?.removeEventListener('abort',abort);}
 }
 async update(change:(data:Data,context:{nextSaleNumber:number})=>void,scope:Scope={}):Promise<View> {
  const tx=this.db.transaction([...STORES],'readwrite'),done=completion(tx);
  try{
   const view=await this.base(tx),sales=tx.objectStore('sales'),reads:Promise<Sale[]>[]=[];
   if(scope.saleId)reads.push(request<Sale|undefined>(sales.get(scope.saleId)).then(s=>s?[s]:[]));
   if(scope.sessionId)reads.push(request(sales.index('bySession').getAll(scope.sessionId)));
   if(scope.weekId)reads.push(request(sales.index('byWeek').getAll(scope.weekId)));
   if(scope.fromDate)reads.push(request(sales.index('byAt').getAll(IDBKeyRange.lowerBound(scope.fromDate))));
   view.data.sales=distinct((await Promise.all(reads)).flat()).sort((a,b)=>a.number-b.number);
   const before=structuredClone(view.data);change(view.data,{nextSaleNumber:view.meta.nextSaleNumber});
   if(view.data.priceAudit!==undefined)throw Error('El historial de precios no se puede editar con esta operación');
   const priceChanges=productAuditChanges(before.products,view.data.products,scope.priceSource??'PRODUCT_EDIT',before.productFamilies,view.data.productFamilies);
   const meta={...metadata({...view.data,sales:[]},view.meta.revision+1),nextSaleNumber:view.meta.nextSaleNumber,salesCount:view.meta.salesCount,cancelledCount:view.meta.cancelledCount,total:view.meta.total,unassignedCount:view.meta.unassignedCount};
   for(const name of ['products','sessions','weeks','sales','categoryDetails','productFamilies'] as const){
    const old=new Map((before[name]??[]).map(row=>[row.id,row]));
    const next=view.data[name]??[];if([...old.keys()].some(id=>!next.some(row=>row.id===id)))throw Error('No se pueden borrar registros históricos con esta operación');
    for(const row of next){const previous=old.get(row.id);if(JSON.stringify(previous)===JSON.stringify(row))continue;
     if(name==='sales'){
      const sale=row as Sale,prev=previous as Sale|undefined;
      // Insert numbering and counters are protected by the same transaction as the sale.
      if(!prev){if(sale.number!==meta.nextSaleNumber)throw Error('Número de ticket inválido');meta.nextSaleNumber++;}
      else if(sale.number!==prev.number)throw Error('No se puede cambiar el número del ticket');
      if(prev){if(prev.cancellation)meta.cancelledCount--;else{meta.salesCount--;meta.total-=prev.total;}if(!prev.weekId)meta.unassignedCount--;}
      if(sale.cancellation)meta.cancelledCount++;else{meta.salesCount++;meta.total+=sale.total;}if(!sale.weekId)meta.unassignedCount++;
     }
     const store=tx.objectStore(name==='categoryDetails'?'categories':name);if(previous)store.put(row);else store.add(row);
    }
   }
   await this.appendPriceAudit(tx,priceChanges);
   tx.objectStore('meta').put(meta);await done;return {data:view.data,meta};
  }catch(e){try{tx.abort();}catch{}await done.catch(()=>{});throw e;}
 }
 private async appendPriceAudit(tx:IDBTransaction,changes:Omit<PriceAuditEntry,'id'|'at'>[]):Promise<void> {
  if(!changes.length)return;
  const store=tx.objectStore('priceAudit'),last=await request<IDBCursorWithValue|null>(store.index('byAt').openCursor(null,'prev'));
  let at=Math.max(Date.now(),last?Date.parse(last.value.at)+1:0);
  const entries=changes.map(change=>({...change,id:crypto.randomUUID(),at:new Date(at++).toISOString()}));validatePriceAudit(entries);
  for(const entry of entries)store.add(entry);
 }
 async sessionDetails(id:string):Promise<{session:Session;sales:Sale[]}> {
  const tx=this.db.transaction(['sessions','sales']),done=completion(tx);
  try{const [session,sales]=await Promise.all([request<Session|undefined>(tx.objectStore('sessions').get(id)),request<Sale[]>(tx.objectStore('sales').index('bySession').getAll(id))]);await done;if(!session)throw Error('Turno no encontrado');return {session,sales:sales.sort((a,b)=>a.number-b.number)};}catch(e){await done.catch(()=>{});throw e;}
 }
 async queryPriceAudit(page:number,size=25):Promise<{rows:PriceAuditEntry[];page:number;pages:number;total:number}> {
  if(!Number.isInteger(page)||page<1||!Number.isInteger(size)||size<1||size>100)throw Error('Página de precios inválida');
  const tx=this.db.transaction('priceAudit'),done=completion(tx),store=tx.objectStore('priceAudit'),total=await request<number>(store.count()),pages=Math.max(1,Math.ceil(total/size));page=Math.min(page,pages);
  const rows=await new Promise<PriceAuditEntry[]>((resolve,reject)=>{const rows:PriceAuditEntry[]=[];let skip=(page-1)*size;const r=store.index('byAt').openCursor(null,'prev');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const c=r.result;if(!c){resolve(rows);return;}if(skip){const n=skip;skip=0;c.advance(n);return;}rows.push(c.value);if(rows.length===size)resolve(rows);else c.continue();};});
  await done;return {rows,page,pages,total};
 }
 async exportData():Promise<Data> {
  const tx=this.db.transaction([...STORES]),done=completion(tx),view=await this.base(tx);
  const [sales,audit]=await Promise.all([request<Sale[]>(tx.objectStore('sales').getAll()),request<PriceAuditEntry[]>(tx.objectStore('priceAudit').getAll())]);view.data.sales=sales.sort((a,b)=>a.number-b.number);if(audit.length)view.data.priceAudit=audit.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));await done;return view.data;
 }
 async restore(input:unknown):Promise<void> {
  const data=validateData(input),tx=this.db.transaction([...STORES],'readwrite'),done=completion(tx);
  try{const current=await this.base(tx);if(current.data.sessions.some(s=>!s.closing))throw Error('Cerrá caja antes de restaurar');
   const auditStore=tx.objectStore('priceAudit');
   for(const entry of data.priceAudit??[]){const existing=await request<PriceAuditEntry|undefined>(auditStore.get(entry.id));if(existing&&!samePriceAudit(existing,entry))throw Error('El respaldo contiene un registro de precios distinto con el mismo ID');if(!existing)auditStore.add(entry);}
   const changes=productAuditChanges(current.data.products,data.products,'BACKUP_RESTORE',current.data.productFamilies,data.productFamilies);
   changes.push({action:'BACKUP_RESTORED',source:'BACKUP_RESTORE',productId:null,productName:'Respaldo completo',gridoName:'',category:'',previousPrice:null,newPrice:null});
   for(const name of STORES)if(name!=='priceAudit')tx.objectStore(name).clear();
   writeAll(tx,{...data,priceAudit:undefined},metadata(data,current.meta.revision+1));await this.appendPriceAudit(tx,changes);await done;
  }catch(e){try{tx.abort();}catch{}await done.catch(()=>{});throw e;}
 }
}
