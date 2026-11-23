import { Component, Input } from '@angular/core';
export interface QuantityBar { key:string;label:string;quantity:number;detail?:string }
@Component({selector:'app-quantity-chart',standalone:true,template:`
 @if(vertical){<div class="quantity-column-scroll"><svg class="quantity-columns" viewBox="0 0 720 240" role="img" [attr.aria-label]="label"><title>{{label}}</title><desc>{{description}}</desc>
  @for(t of [0,.5,1];track t){<line x1="42" x2="710" [attr.y1]="196-t*168" [attr.y2]="196-t*168" stroke="#dfe7df"/><text x="35" [attr.y]="200-t*168" text-anchor="end" class="quantity-axis">{{number(limit*t)}}</text>}
  @for(r of rows;track r.key;let i=$index){<g><title>{{r.label}}: {{number(r.quantity)}}</title><rect [attr.x]="46+i*step" [attr.y]="196-r.quantity/limit*168" [attr.width]="barWidth" [attr.height]="r.quantity/limit*168" rx="3" [attr.fill]="r.quantity===maximum&&maximum>0?'#196451':'#74a991'" [attr.data-quantity]="r.quantity"/>
   @if(i%labelEvery===0||i===rows.length-1){<text [attr.x]="46+i*step+barWidth/2" y="218" text-anchor="middle" class="quantity-axis">{{r.label}}</text>}
  </g>}
 </svg></div>}@else{<ol class="quantity-bars" [attr.aria-label]="label">
  @for(r of rows;track r.key){<li><div class="quantity-bar-heading"><div><strong>{{r.label}}</strong>@if(r.detail){<small>{{r.detail}}</small>}</div><b>{{number(r.quantity)}}</b></div><div class="quantity-rail" aria-hidden="true"><span [style.width.%]="maximum?r.quantity/maximum*100:0"></span></div></li>}
 </ol>}
`})
export class QuantityChartComponent {
 @Input() rows:QuantityBar[]=[];@Input() label='Cantidades vendidas';@Input() vertical=false;
 get maximum(){return Math.max(0,...this.rows.map(r=>r.quantity));}
 get limit(){return this.maximum||1;}
 get step(){return 660/Math.max(this.rows.length,1);}
 get barWidth(){return Math.max(2,this.step-7);}
 get labelEvery(){return Math.max(1,Math.ceil(this.rows.length/10));}
 get description(){return this.rows.map(r=>r.label+': '+this.number(r.quantity)).join('; ');}
 number(n:number){return new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(n);}
}
