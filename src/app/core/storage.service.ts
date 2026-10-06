import { Injectable, signal } from '@angular/core';
import { Data, emptyData } from './models';
import { environment } from '../../environments/environment';
@Injectable({providedIn:'root'})
export class StorageService {
 readonly data=signal<Data>(emptyData()); readonly ready=signal(false); private db?:IDBDatabase;
 async init() { this.db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(environment.dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const saved=await new Promise<Data|undefined>((resolve,reject)=>{const r=this.db!.transaction('state').objectStore('state').get('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 if(saved)this.data.set(saved);this.ready.set(true); }
 async update(change:(data:Data)=>void) {
 if(!this.db)throw Error('Almacenamiento no disponible');
 // Read + mutation + write occur in one IndexedDB transaction, including across tabs.
 const result=await new Promise<Data>((resolve,reject)=>{
 const tx=this.db!.transaction('state','readwrite');const store=tx.objectStore('state');let next:Data;
 const r=store.get('data');r.onsuccess=()=>{try{next=structuredClone(r.result??emptyData());change(next);store.put(next,'data');}catch(e){tx.abort();reject(e);}};
 tx.oncomplete=()=>resolve(next);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('Operación cancelada'));});this.data.set(result);
 }
}
