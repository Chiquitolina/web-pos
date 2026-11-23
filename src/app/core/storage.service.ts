import { Injectable, signal } from '@angular/core';
import { Data, Sale, emptyData } from './models';
import { PosDatabase, Scope, metadata, View } from './indexed-db';
import { HistoryFilter, HistoryTotals } from './history';
import { MetricsFilter } from './metrics';
import { environment } from '../../environments/environment';
@Injectable({providedIn:'root'})
export class StorageService {
 readonly data=signal<Data>(emptyData());readonly ready=signal(false);readonly stats=signal(metadata(emptyData()));
 readonly history=signal<Sale[]>([]);readonly historyFilter=signal<HistoryFilter>({kind:'current'});readonly historyStats=signal<HistoryTotals>({salesCount:0,cancelledCount:0,total:0});readonly historyPageCount=signal(1);readonly historyPage=signal(1);readonly historyLoading=signal(false);readonly status=signal('');
 private db?:PosDatabase;private channel?:BroadcastChannel;private historyRequest=0;private generation=0;
 get historyPages(){return this.historyPageCount();}
 async init(){this.db=await PosDatabase.open(environment.dbName,()=>this.status.set('Cerrá las otras pestañas de la heladería para actualizar la base de datos.'),()=>{this.ready.set(false);this.status.set('El almacenamiento se actualizó en otra pestaña. Recargá esta página.');});
  await this.refresh();this.ready.set(true);this.status.set('');
  if(typeof BroadcastChannel!=='undefined'){this.channel=new BroadcastChannel(environment.dbName+':updates');this.channel.onmessage=()=>{this.refresh().catch(e=>this.status.set(e.message));};}
 }
 private requireDb(){if(!this.db)throw Error('Almacenamiento no disponible');return this.db;}
 private apply(view:View){this.data.set(view.data);this.stats.set(view.meta);}
 private async refresh(){const token=++this.generation;const view=await this.requireDb().view();if(token!==this.generation)return;this.apply(view);await this.loadHistory(this.historyPage());}
 async loadHistory(page:number){const token=++this.historyRequest;page=Math.max(1,page);this.historyLoading.set(true);
  try{const result=await this.requireDb().queryHistory(this.historyFilter(),page);if(token!==this.historyRequest)return;this.history.set(result.rows);this.historyPage.set(result.page);this.historyPageCount.set(result.pages);this.historyStats.set(result.totals);}finally{if(token===this.historyRequest)this.historyLoading.set(false);}
 }
 async setHistoryFilter(filter:HistoryFilter){this.historyFilter.set(filter);this.history.set([]);this.historyStats.set({salesCount:0,cancelledCount:0,total:0});this.historyPage.set(1);this.historyPageCount.set(1);await this.loadHistory(1);}
 async update(change:(data:Data,context:{nextSaleNumber:number})=>void,scope:Scope={}){
  const view=await this.requireDb().update(change,scope);++this.generation;
  // Preserve only live period records plus cancellation audit records in memory.
  // Entity edits read the latest committed records, including changes from other tabs.
  const old=this.data(),oldRevision=this.stats().revision,session=view.data.sessions.find(s=>!s.closing),week=view.data.weeks.find(w=>!w.closing);
  view.data.sales=[...new Map([...old.sales,...view.data.sales].map(s=>[s.id,s])).values()].filter(s=>s.cancellation||s.sessionId===session?.id||!!week&&s.weekId===week.id).sort((a,b)=>a.number-b.number);
  this.apply(view);await this.loadHistory(this.historyPage());this.channel?.postMessage({revision:view.meta.revision});
  // Catch up if another tab committed between our transaction and its notification.
  if(oldRevision!==view.meta.revision-1||old.sessions.find(s=>!s.closing)?.id!==session?.id||old.weeks.find(w=>!w.closing)?.id!==week?.id)await this.refresh();
 }
 sessionDetails(id:string){return this.requireDb().sessionDetails(id);}
 queryPriceAudit(page:number){return this.requireDb().queryPriceAudit(page);}
 queryMetrics(filter:MetricsFilter,timeZone:string,signal?:AbortSignal){return this.requireDb().queryMetrics(filter,timeZone,new Date().toISOString(),signal);}
 exportData(){return this.requireDb().exportData();}
 async restore(data:Data){await this.requireDb().restore(data);await this.refresh();this.channel?.postMessage({restored:true});}
}
