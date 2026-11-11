import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { listingSchema } from './marketplace';

export const getPublicListings=createServerFn({method:'GET'}).inputValidator((data:{id?:string})=>z.object({id:z.string().uuid().optional()}).parse(data)).handler(async({data})=>{
 const key=process.env['SUPABASE_PUBLISHABLE_KEY']; const url=process.env['SUPABASE_URL'];
 if(!key||!url) throw new Error('E’lonlar xizmati vaqtincha mavjud emas');
 const client=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const headers=new Headers(init?.headers); if(key.startsWith('sb_')&&headers.get('Authorization')===`Bearer ${key}`)headers.delete('Authorization'); headers.set('apikey',key);return fetch(input,{...init,headers});}}});
 let query=client.from('listings').select('*, listing_images(*)').eq('status','active').order('created_at',{ascending:false}).limit(200);
 if(data.id)query=query.eq('id',data.id);
 const result=await query; if(result.error)throw new Error('E’lonlarni olishning iloji bo‘lmadi');
 return Promise.all((result.data??[]).map(async listing=>({...listing,media:await Promise.all(listing.listing_images.map(async image=>{const signed=await client.storage.from('listing-media').createSignedUrl(image.storage_path,3600);return {...image,url:signed.data?.signedUrl??null};}))})));
});
export const saveListing=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string().uuid().optional(),listing:listingSchema}).parse(input)).handler(async({data,context})=>{
 const query=data.id?context.supabase.from('listings').update(data.listing).eq('id',data.id).eq('owner_id',context.userId):context.supabase.from('listings').insert({...data.listing,owner_id:context.userId});
 const result=await query.select('id').single();if(result.error)throw new Error('E’lon saqlanmadi. Ma’lumotlarni tekshiring.');return result.data;
});
export const publicListingsOptions={queryKey:['public-listings'],queryFn:()=>getPublicListings({data:{}}),staleTime:0};