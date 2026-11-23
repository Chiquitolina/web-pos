import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService } from './core/storage.service';
import { METRIC_WEEKDAYS, MetricsFilter, MetricsPreset, MetricsReport, metricsPresetDates, validateMetricsFilter } from './core/metrics';
import { QuantityBar, QuantityChartComponent } from './quantity-chart.component';
import { environment } from '../environments/environment';

@Component({selector:'app-metrics',standalone:true,imports:[FormsModule,QuantityChartComponent],template:`
 <section class="card metrics-intro"><div><h2>Qué se vende y en qué momentos</h2><p>Explorá las cantidades del historial, incluidos turnos y semanas cerrados. Las ventas anuladas se excluyen.</p></div><span class="metrics-volume-badge">CANTIDADES VENDIDAS</span></section>
 <form class="card metrics-filters" (ngSubmit)="applyFilters()" aria-label="Filtros de métricas">
  <div class="metrics-filter-grid">
   <label>Período<select name="metrics-period" aria-label="Período de métricas" [(ngModel)]="preset" (ngModelChange)="changePreset()"><option value="today">Hoy</option><option value="week">Esta semana (lunes a hoy)</option><option value="7days">Últimos 7 días</option><option value="30days">Últimos 30 días</option><option value="month">Este mes</option><option value="all">Todo el historial</option><option value="custom">Fechas personalizadas</option></select></label>
   <label>Desde<input name="metrics-from" aria-label="Métricas desde" type="date" [(ngModel)]="draft.from" (ngModelChange)="preset='custom'" [disabled]="preset==='all'" [required]="preset!=='all'"></label>
   <label>Hasta<input name="metrics-to" aria-label="Métricas hasta" type="date" [(ngModel)]="draft.to" (ngModelChange)="preset='custom'" [disabled]="preset==='all'" [required]="preset!=='all'"></label>
   <label>Categoría<select name="metrics-category" aria-label="Categoría de métricas" [(ngModel)]="draft.category"><option value="">Todas las categorías</option>@for(c of categories;track c){<option [value]="c">{{c}}</option>}</select></label>
   <label>Presentación<select name="metrics-presentation" aria-label="Presentación de métricas" [(ngModel)]="draft.presentation"><option value="all">Todas las presentaciones</option><option value="unit">Por unidad</option><option value="box">Por caja (ambos tamaños)</option></select></label>
   <label>Producto o código<input name="metrics-search" aria-label="Producto o código en métricas" type="search" [(ngModel)]="draft.search" placeholder="Ej.: limón, bombón o código Grido"></label>
  </div>
  <details class="metrics-more-filters"><summary>Filtrar por día de semana y franja horaria</summary><div class="metrics-filter-grid">
   <label>Día de semana<select name="metrics-weekday" aria-label="Día de semana de métricas" [(ngModel)]="draft.weekday"><option [ngValue]="null">Todos los días</option>@for(day of days;track day;let i=$index){<option [ngValue]="i">{{day}}</option>}</select></label>
   <label>Desde las<select name="metrics-hour-from" aria-label="Hora desde de métricas" [(ngModel)]="draft.hourFrom">@for(h of startHours;track h){<option [ngValue]="h">{{hour(h)}}</option>}</select></label>
   <label>Hasta las<select name="metrics-hour-to" aria-label="Hora hasta de métricas" [(ngModel)]="draft.hourTo">@for(h of endHours;track h){<option [ngValue]="h">{{hour(h)}}</option>}</select></label>
  </div><small>La hora de fin queda fuera de la franja: 18:00 a 24:00 incluye toda la noche de ese día.</small></details>
  <div class="metrics-filter-actions"><button class="primary" type="submit">Aplicar filtros</button><button type="button" (click)="reset()">Restablecer filtros</button>@if(pending){<small>Hay cambios sin aplicar.</small>}@else{<small>Aplicá los filtros para actualizar los gráficos.</small>}</div>
  @if(validationError()){<p class="catalog-error" role="alert">{{validationError()}}</p>}
 </form>
 @if(loading()){<section class="card metrics-loading" role="status" aria-live="polite">Calculando cantidades del historial…</section>}
 @else if(error()){<section class="card"><p class="catalog-error" role="alert">{{error()}}</p><button type="button" (click)="refresh()">Volver a cargar métricas</button></section>}
 @else if(report();as r){
  <div class="metrics-scope" aria-live="polite"><strong>{{date(r.from)}} al {{date(r.to)}}</strong><span>{{filterSummary}}</span><small>Hora local: {{r.timeZone}}</small></div>
  <p class="metrics-count-note">Una caja cuenta como 1 presentación vendida; un producto individual cuenta como 1. Usá el filtro de presentación para compararlos por separado.</p>
  @if(!r.quantity){<section class="card metrics-empty" role="status"><h2>No hay cantidades para estos filtros</h2><p>Probá otro período, categoría, presentación o nombre.</p></section>}
  @else{
   <div class="metrics-stats">
    <article><small>Cantidad vendida</small><strong data-metric="quantity">{{number(r.quantity)}}</strong><span>presentaciones</span></article>
    <article><small>Productos distintos</small><strong data-metric="products">{{number(r.uniqueProducts)}}</strong><span>caja y unidad por separado</span></article>
    <article><small>Día más fuerte</small><strong class="metrics-peak" data-metric="weekday" [title]="dayLeader.label">{{shortLeader(dayLeader)}}</strong><span>{{number(dayLeader.quantity)}} {{weekdayMode==='average'?'por día calendario':'en el período'}}{{dayLeader.ties>1?' · empate':''}}</span></article>
    <article><small>Hora más fuerte</small><strong class="metrics-peak" data-metric="hour" [title]="hourLeader.label">{{shortLeader(hourLeader)}}</strong><span>{{number(hourLeader.quantity)}} presentaciones{{hourLeader.ties>1?' · empate':''}}</span></article>
   </div>
   <div class="metrics-chart-grid">
    <section class="card metrics-chart-card"><div class="metrics-card-heading"><div><h2>Días de la semana</h2><small>Detectá en qué días se vende más.</small></div><label>Comparar<select aria-label="Comparación por día" [(ngModel)]="weekdayMode"><option value="average">Promedio por día calendario</option><option value="total">Cantidad acumulada</option></select></label></div>
     <app-quantity-chart [rows]="weekdayBars" label="Cantidades por día de semana"></app-quantity-chart><p class="metrics-chart-note">El promedio divide por la cantidad de lunes, martes, etc. del período. Incluye los días sin ventas; el sistema no registra qué días abrió el local.</p>
    </section>
    <section class="card metrics-chart-card"><div class="metrics-card-heading"><div><h2>Horas del día</h2><small>Cantidad acumulada en cada franja de una hora.</small></div></div>
     <app-quantity-chart [rows]="r.hours" [vertical]="true" label="Cantidades por hora del día"></app-quantity-chart><details class="metrics-data"><summary>Ver cantidades por hora</summary><div class="metrics-table-scroll"><table><thead><tr><th>Franja</th><th>Cantidad</th></tr></thead><tbody>@for(h of r.hours;track h.key){<tr><td>{{h.label}} a {{hour(+h.key+1)}}</td><td>{{number(h.quantity)}}</td></tr>}</tbody></table></div></details>
    </section>
    <section class="card metrics-chart-card metrics-wide"><div class="metrics-card-heading"><div><h2>Evolución por {{r.trendUnit}}</h2><small>Cantidades del período. Los días sin ventas aparecen en cero; los períodos largos se agrupan para facilitar la lectura.</small></div></div><app-quantity-chart [rows]="r.trend" [vertical]="true" [label]="'Evolución de cantidades por '+r.trendUnit"></app-quantity-chart>
     <details class="metrics-data"><summary>Ver cantidades de la evolución</summary><div class="metrics-table-scroll"><table><thead><tr><th>Inicio del {{r.trendUnit}}</th><th>Cantidad</th></tr></thead><tbody>@for(p of r.trend;track p.key){<tr><td>{{date(p.key)}}</td><td>{{number(p.quantity)}}</td></tr>}</tbody></table></div></details>
    </section>
    <section class="card metrics-chart-card"><div class="metrics-card-heading"><div><h2>Productos más vendidos</h2><small>Ranking por cantidad; caja y unidad conservan su código propio.</small></div><label>Mostrar<select aria-label="Cantidad del ranking de productos" [(ngModel)]="top">@for(n of [5,10,20,50];track n){<option [ngValue]="n">Primeros {{n}}</option>}</select></label></div>
     <app-quantity-chart [rows]="productBars" label="Productos más vendidos por cantidad"></app-quantity-chart><small>Mostrando {{productBars.length}} de {{r.products.length}} productos.</small>
     <details class="metrics-data"><summary>Ver todos los productos y su participación</summary><div class="metrics-table-scroll"><table aria-label="Cantidades por producto"><thead><tr><th>Producto</th><th>Cantidad</th><th>Participación</th></tr></thead><tbody>@for(p of r.products;track p.key){<tr [attr.data-product-id]="p.key"><td><strong>{{p.label}}</strong><small>{{p.presentation}} · {{p.categories.join(', ')}}</small>@if(p.code){<small>Grido: {{p.code}}</small>}</td><td>{{number(p.quantity)}}</td><td>{{number(p.share)}} %</td></tr>}</tbody></table></div></details>
    </section>
    <section class="card metrics-chart-card"><div class="metrics-card-heading"><div><h2>Categorías más vendidas</h2><small>Qué parte de las cantidades corresponde a cada categoría.</small></div></div><app-quantity-chart [rows]="categoryBars" label="Categorías más vendidas por cantidad"></app-quantity-chart>
     <details class="metrics-data"><summary>Ver todas las categorías</summary><div class="metrics-table-scroll"><table aria-label="Cantidades por categoría"><thead><tr><th>Categoría</th><th>Cantidad</th><th>Participación</th></tr></thead><tbody>@for(c of r.categories;track c.key){<tr><td>{{c.label}}</td><td>{{number(c.quantity)}}</td><td>{{number(c.share)}} %</td></tr>}</tbody></table></div></details>
    </section>
    <section class="card metrics-chart-card metrics-wide"><div class="metrics-card-heading"><div><h2>Mapa de días y horas</h2><small>Más oscuro significa más cantidad vendida. Pasá sobre una celda para ver el detalle.</small></div><span class="metrics-heat-legend">Menos <i></i> Más</span></div>
     <div class="metrics-heat-scroll"><table class="metrics-heatmap" aria-label="Cantidades por día y hora"><thead><tr><th>Día</th>@for(h of startHours;track h){<th>{{h}} h</th>}</tr></thead><tbody>@for(row of r.heatmap;track $index;let day=$index){<tr><th>{{days[day]}}</th>@for(q of row;track $index;let h=$index){<td [style.background]="heatColor(q)" [style.color]="q&&q/heatMaximum>.55?'#fff':'#244b3b'" [attr.title]="days[day]+', '+hour(h)+' a '+hour(h+1)+': '+number(q)" [attr.aria-label]="days[day]+', '+hour(h)+': '+number(q)+' presentaciones'" [attr.data-quantity]="q">{{q?number(q):'·'}}</td>}</tr>}</tbody></table></div>
    </section>
   </div>
  }
  <p class="metrics-method-note">Las categorías conservan el nombre del momento de la venta. Caja y unidad se separan según su presentación actual o el rótulo histórico si todavía no se configuró. Las semanas y meses de los extremos pueden estar incompletos.</p>
 }
`})
export class MetricsComponent {
 private readonly store=inject(StorageService);
 readonly days=METRIC_WEEKDAYS;readonly startHours=Array.from({length:24},(_,i)=>i);readonly endHours=Array.from({length:24},(_,i)=>i+1);
 readonly loading=signal(false);readonly error=signal('');readonly validationError=signal('');readonly report=signal<MetricsReport|null>(null);
 preset:MetricsPreset='30days';draft:MetricsFilter=this.defaults();private applied:MetricsFilter={...this.draft};
 weekdayMode:'average'|'total'='average';top=10;categories:string[]=[];
 private controller?:AbortController;private request=0;private destroyed=false;
 constructor(){
  effect(()=>{if(this.store.ready()){this.store.stats().revision;untracked(()=>void this.refresh());}});
  inject(DestroyRef).onDestroy(()=>{this.destroyed=true;this.request++;this.controller?.abort();});
 }
 private defaults():MetricsFilter{return {...metricsPresetDates('30days',new Date().toISOString(),environment.timeZone),category:'',presentation:'all',search:'',weekday:null,hourFrom:0,hourTo:24};}
 changePreset(){this.validationError.set('');if(this.preset==='custom'){if(!this.draft.from||!this.draft.to){const dates=metricsPresetDates('today',new Date().toISOString(),environment.timeZone);this.draft={...this.draft,...dates};}}else this.draft={...this.draft,...metricsPresetDates(this.preset,new Date().toISOString(),environment.timeZone)};}
 applyFilters(){try{if(this.preset!=='custom')this.changePreset();this.applied=validateMetricsFilter({...this.draft});this.validationError.set('');void this.refresh();}catch(e){this.validationError.set(e instanceof Error?e.message:'Revisá los filtros.');}}
 reset(){this.preset='30days';this.draft=this.defaults();this.applyFilters();}
 get pending(){return JSON.stringify(this.draft)!==JSON.stringify(this.applied);}
 async refresh(){
  this.controller?.abort();const controller=new AbortController();this.controller=controller;const token=++this.request;
  this.loading.set(true);this.error.set('');this.report.set(null);
  try{const result=await this.store.queryMetrics({...this.applied},environment.timeZone,controller.signal);if(token!==this.request||this.destroyed)return;this.categories=[...new Set([...result.report.availableCategories,...(this.applied.category?[this.applied.category]:[])])].sort((a,b)=>a.localeCompare(b,'es'));this.report.set(result.report);}
  catch(e){if(token===this.request&&!this.destroyed&&!controller.signal.aborted)this.error.set(e instanceof Error?e.message:'No se pudieron calcular las métricas.');}
  finally{if(token===this.request&&!this.destroyed)this.loading.set(false);}
 }
 get filterSummary(){const f=this.applied;return [f.category||'Todas las categorías',f.presentation==='box'?'Por caja':f.presentation==='unit'?'Por unidad':'Todas las presentaciones',...(f.search?[`Producto: «${f.search}»`]:[]),...(f.weekday!==null?[this.days[f.weekday]]:[]),...(f.hourFrom!==0||f.hourTo!==24?[this.hour(f.hourFrom)+' a '+this.hour(f.hourTo)]:[])].join(' · ');}
 get weekdayBars():QuantityBar[]{return (this.report()?.weekdays??[]).map(d=>({key:d.key,label:d.label,quantity:this.weekdayMode==='average'?d.average:d.quantity,detail:d.days?`${d.days} ${d.days===1?'día calendario incluido':'días calendario incluidos'} · ${this.number(d.quantity)} en total`:'Sin días incluidos'}));}
 get productBars():QuantityBar[]{return (this.report()?.products??[]).slice(0,this.top).map(p=>({...p,detail:[p.presentation,p.code||p.key,this.number(p.share)+' %'].join(' · ')}));}
 get categoryBars():QuantityBar[]{return (this.report()?.categories??[]).slice(0,10).map(p=>({...p,detail:this.number(p.share)+' % de las cantidades'}));}
 private leader(rows:QuantityBar[]){const maximum=Math.max(0,...rows.map(r=>r.quantity)),leaders=rows.filter(r=>maximum>0&&r.quantity===maximum);return {label:leaders.length?leaders.map(r=>r.label).join(', '):'Sin datos',quantity:maximum,ties:leaders.length,first:leaders[0]?.label??'Sin datos'};}
 get dayLeader(){return this.leader(this.weekdayBars);}
 get hourLeader(){return this.leader((this.report()?.hours??[]).map(h=>({...h,label:h.label+'–'+this.hour(+h.key+1)})));}
 shortLeader(p:ReturnType<MetricsComponent['leader']>){return p.first+(p.ties>1?' +'+(p.ties-1):'');}
 get heatMaximum(){return Math.max(0,...(this.report()?.heatmap??[]).flat());}
 heatColor(q:number){return q&&this.heatMaximum?'rgba(25,100,81,'+(.12+.88*q/this.heatMaximum)+')':'#f1f5ee';}
 hour(n:number){return String(n).padStart(2,'0')+':00';}
 date(value:string){return value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4);}
 number(n:number){return new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(n);}
}
