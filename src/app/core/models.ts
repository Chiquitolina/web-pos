export type Payment = 'CASH' | 'MP' | 'CARD';
export interface Product { id:string; name:string; category:string; price:number; active:boolean }
export interface Item { productId:string; name:string; quantity:number; unitPrice:number; subtotal:number }
export interface Sale { id:string; number:number; sessionId:string; at:string; items:Item[]; total:number; payment:Payment; received:number; change:number }
export interface Movement { id:string; at:string; type:'IN'|'OUT'; amount:number; reason:string }
export interface Closing { at:string; counted:number; expected:number; difference:number; salesCount:number; total:number; payments:Record<Payment,number>; products:{id:string;name:string;quantity:number;total:number}[] }
export interface Session { id:string; openedAt:string; opening:number; movements:Movement[]; closing?:Closing }
export interface Data { version:1; products:Product[]; sales:Sale[]; sessions:Session[] }
export const emptyData = ():Data => ({version:1,products:[['Cucurucho 1 bocha','Granel',3500],['Cucurucho 2 bochas','Granel',5000],['1/4 kg','Granel',6000],['1/2 kg','Granel',10000],['1 kg','Granel',18000],['Bombón Escocés','Envasados',8500]].map(([name,category,price],i)=>({id:'p'+i,name:String(name),category:String(category),price:Number(price)*100,active:true})),sales:[],sessions:[]});
