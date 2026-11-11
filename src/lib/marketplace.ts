import { z } from 'zod';
export const categories = [
  {id:'hotel',name:'Mehmonxona',period:'daily'}, {id:'hostel',name:'Hostel',period:'daily'},
  {id:'apartment_daily',name:'Kunlik kvartira',period:'daily'}, {id:'apartment_weekly',name:'Haftalik kvartira',period:'weekly'},
  {id:'apartment_monthly',name:'Oylik kvartira',period:'monthly'}, {id:'long_term',name:'Uzoq muddatli ijara',period:'monthly'},
  {id:'roommate',name:'Sherik topish',period:'monthly'}, {id:'room',name:'Bo‘sh xona',period:'monthly'},
  {id:'hostel_bed',name:'Hostelda joy',period:'daily'}, {id:'house',name:'Uy ijarasi',period:'monthly'},
] as const;
export const cities=['Toshkent','Samarqand','Buxoro','Xiva','Andijon','Farg‘ona','Namangan','Nukus','Qarshi','Termiz','Jizzax','Guliston','Navoiy'];
export const cityCoords:Record<string,[number,number]>={Toshkent:[41.2995,69.2401],Samarqand:[39.6542,66.9597],Buxoro:[39.7747,64.4286],Xiva:[41.3783,60.3639],Andijon:[40.7821,72.3442],'Farg‘ona':[40.3864,71.7864],Namangan:[40.9983,71.6726],Nukus:[42.4531,59.6103],Qarshi:[38.8606,65.7891],Termiz:[37.2242,67.2783],Jizzax:[40.1158,67.8422],Guliston:[40.4897,68.7842],Navoiy:[40.1039,65.3739]};
export const UZBEKISTAN_CENTER:[number,number]=[41.3,64.5];
export type ListingPoint={id:string;lat:number;lng:number;approx:boolean};
function hash(id:string){let h=0;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))|0;return Math.abs(h);}
/** Exact coordinates when the owner set them; otherwise the city centre with a small stable offset so pins do not stack. */
export function listingPoint(l:{id:string;city:string;latitude?:number|string|null;longitude?:number|string|null}):ListingPoint|null{
 const lat=l.latitude==null?NaN:Number(l.latitude),lng=l.longitude==null?NaN:Number(l.longitude);
 if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180)return {id:l.id,lat,lng,approx:false};
 const c=cityCoords[l.city];if(!c)return null;
 const h=hash(l.id);return {id:l.id,lat:c[0]+(((h%200)-100)/100)*0.025,lng:c[1]+((((h>>8)%200)-100)/100)*0.025,approx:true};
}
export const periods:Record<string,string>={daily:'kun',weekly:'hafta',monthly:'oy'};
export const listingSchema=z.object({
 title:z.string().trim().min(5).max(160), description:z.string().trim().min(20).max(5000),
 category:z.enum(['hotel','hostel','apartment_daily','apartment_weekly','apartment_monthly','long_term','roommate','room','hostel_bed','house']),
 city:z.string().trim().min(2).max(80), district:z.string().trim().max(100), address:z.string().trim().max(250),
 price:z.coerce.number().int().min(0).max(100000000000), payment_period:z.enum(['daily','weekly','monthly']),
 available_places:z.coerce.number().int().min(1).max(1000), total_places:z.coerce.number().int().min(1).max(1000), rooms:z.coerce.number().int().min(1).max(100),
 floor:z.number().int().min(-5).max(100).nullable(), room_number:z.string().max(30),
 available_from:z.string().nullable(), available_to:z.string().nullable(), amenities:z.array(z.string().max(60)).max(30),
 latitude:z.number().min(-90).max(90).nullable().default(null),longitude:z.number().min(-180).max(180).nullable().default(null),
 house_rules:z.string().max(1500),status:z.enum(['draft','active','paused']),
}).refine(d=>d.total_places>=d.available_places,{message:'err.placesExceed',path:['available_places']})
.refine(d=>!d.available_from||!d.available_to||d.available_to>=d.available_from,{message:'err.datesInvalid',path:['available_to']});
export type ListingInput=z.infer<typeof listingSchema>;
export const formatPrice=(value:number,locale='uz-UZ')=>new Intl.NumberFormat(locale).format(value);
export const listingPublicationFee=()=>0;
export function pageHead(title:string,description:string){return {meta:[{title:`${title} — QULAYJOY`},{name:'description',content:description},{property:'og:title',content:`${title} — QULAYJOY`},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]};}