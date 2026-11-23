import { Sale } from './models';
import { startOfDate, localDate } from './weeks';
export type HistoryFilter = {kind:'all'} | {kind:'current'} | {kind:'session';sessionId:string} | {kind:'day';date:string};
export interface HistoryTotals { salesCount:number; cancelledCount:number; total:number }
export interface HistoryPage { rows:Sale[]; page:number; pages:number; totalRows:number; totals:HistoryTotals }
export function salesTotals(sales:Sale[]):HistoryTotals {
 return sales.reduce((r,s)=>{if(s.cancellation)r.cancelledCount++;else{r.salesCount++;r.total+=s.total;}return r;},{salesCount:0,cancelledCount:0,total:0});
}
export function dayBounds(date:string):[string,string] {
 const start=startOfDate(date),next=new Date(start);next.setUTCDate(next.getUTCDate()+1);
 return [start,startOfDate(localDate(next.toISOString()))];
}
export function paginateSales(sales:Sale[],page:number,size:number):HistoryPage {
 const pages=Math.max(1,Math.ceil(sales.length/size));page=Math.min(page,pages);
 return {rows:[...sales].sort((a,b)=>b.number-a.number).slice((page-1)*size,page*size),page,pages,totalRows:sales.length,totals:salesTotals(sales)};
}
