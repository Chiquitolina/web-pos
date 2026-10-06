import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService } from './core/storage.service';
import { Item, Payment, Sale } from './core/models';
import { money, closeSession, validateData } from './core/domain';
import { environment } from '../environments/environment';
@Component({selector:'app-root',standalone:true,imports:[FormsModule],templateUrl:'./app.component.html'})
export class AppComponent {
 store=inject(StorageService); title=environment.storeName; tab='Venta'; tabs=['Venta','Productos','Caja','Cierres','Historial','Respaldo'];
 cart=signal<Item[]>([]); busy=signal(false); message=signal(''); receipt=signal<Sale|null>(null);
 payment:Payment='CASH';received=0;opening=0;counted=0;amount=0;reason='';type:'IN'|'OUT'='OUT';name='';category='Granel';price=0;
 constructor(){this.store.init().catch(e=>this.message.set('No se pudo abrir almacenamiento: '+e.message));}
 get session(){return this.store.data().sessions.find(s=>!s.closing);}
 get total(){return this.cart().reduce((n,i)=>n+i.subtotal,0);}
 get expected(){return this.session?closeSession(this.store.data(),this.session,0).expected:0;}
 fmt(n:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n/100);}
 date(s:string){return new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:environment.timeZone}).format(new Date(s));}
 async run(fn:()=>Promise<void>){if(this.busy())return;this.busy.set(true);this.message.set('');try{await fn();this.message.set('Guardado correctamente');}catch(e){this.message.set(e instanceof Error?e.message:'Error al guardar');}finally{this.busy.set(false);}}
 add(id:string){const p=this.store.data().products.find(p=>p.id===id);if(!p)return;const items=structuredClone(this.cart());const i=items.find(i=>i.productId===id);if(i){i.quantity++;i.subtotal=i.quantity*i.unitPrice;}else items.push({productId:id,name:p.name,quantity:1,unitPrice:p.price,subtotal:p.price});this.cart.set(items);}
 remove(id:string){this.cart.update(items=>items.flatMap(i=>i.productId!==id?[i]:i.quantity>1?[{...i,quantity:i.quantity-1,subtotal:(i.quantity-1)*i.unitPrice}]:[]));}
 open(){this.run(()=>this.store.update(d=>{if(d.sessions.some(s=>!s.closing))throw Error('Ya hay caja abierta');d.sessions.push({id:crypto.randomUUID(),openedAt:new Date().toISOString(),opening:money(this.opening),movements:[]});}));}
 charge(){this.run(async()=>{const id=this.session?.id,items=structuredClone(this.cart()),payment=this.payment,total=this.total,received=payment==='CASH'?money(this.received):total;if(!id||!items.length)throw Error('Abrí caja y agregá productos');if(received<total)throw Error('Efectivo insuficiente');let sale:Sale|undefined;await this.store.update(d=>{if(!d.sessions.some(s=>s.id===id&&!s.closing))throw Error('Caja cerrada');for(const i of items){const p=d.products.find(p=>p.id===i.productId);if(!p?.active||p.price!==i.unitPrice)throw Error('Cambió un producto. Vaciá y rehacé la venta');}sale={id:crypto.randomUUID(),number:d.sales.reduce((n,s)=>Math.max(n,s.number),0)+1,sessionId:id,at:new Date().toISOString(),items,total,payment,received,change:received-total};d.sales.push(sale);});this.receipt.set(sale!);this.cart.set([]);this.received=0;});}
 product(){this.run(()=>this.store.update(d=>{const price=money(this.price);if(!this.name.trim()||!this.category.trim()||!price)throw Error('Completá producto y precio positivo');d.products.push({id:crypto.randomUUID(),name:this.name.trim(),category:this.category.trim(),price,active:true});this.name='';this.price=0;}));}
 edit(id:string,value:string){this.run(()=>this.store.update(d=>{const p=d.products.find(p=>p.id===id),price=money(Number(value));if(!p||!price)throw Error('Precio inválido');p.price=price;}));}
 toggle(id:string){this.run(()=>this.store.update(d=>{const p=d.products.find(p=>p.id===id);if(p)p.active=!p.active;}));}
 move(){const id=this.session?.id;this.run(()=>this.store.update(d=>{const s=d.sessions.find(s=>s.id===id&&!s.closing),amount=money(this.amount);if(!s||!amount||!this.reason.trim())throw Error('Ingresá importe, motivo y abrí caja');s.movements.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:this.type,amount,reason:this.reason.trim()});this.reason='';this.amount=0;}));}
 close(){if(!confirm('¿Guardar cierre definitivo?'))return;const id=this.session?.id;this.run(async()=>{await this.store.update(d=>{const s=d.sessions.find(s=>s.id===id&&!s.closing);if(!s)throw Error('Caja cerrada');s.closing=closeSession(d,s,money(this.counted));});this.cart.set([]);this.tab='Cierres';});}
 export(){const url=URL.createObjectURL(new Blob([JSON.stringify({...this.store.data(),exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='heladeria-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async import(e:Event){const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file)return;await this.run(async()=>{if(file.size>50*1024*1024)throw Error('Archivo demasiado grande');const data=validateData(JSON.parse(await file.text()));if(!confirm('Reemplazar todos los datos locales? Exportá antes un respaldo.'))return;await this.store.update(d=>{if(d.sessions.some(s=>!s.closing))throw Error('Cerrá caja antes de restaurar');Object.assign(d,data);});this.cart.set([]);this.receipt.set(null);});input.value='';}
 print(){window.print();}
}
