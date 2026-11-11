import { describe,it,expect } from 'vitest';
import { listingSchema,listingPublicationFee,categories } from '@/lib/marketplace';
const listing={title:'Toshkentda qulay xona',description:'Toshkent markazida ikki kishiga qulay va yorug‘ xona.',category:'roommate',city:'Toshkent',district:'Chilonzor',address:'',price:1000000,payment_period:'monthly',available_places:2,total_places:4,rooms:2,floor:3,room_number:'',available_from:null,available_to:null,amenities:[],house_rules:'',status:'active'};
describe('Marketplace rules',()=>{
 it('ordinary publication and reactivation are free',()=>expect(listingPublicationFee()).toBe(0));
 it('supports all ten requested categories',()=>expect(categories.map(c=>c.id)).toEqual(['hotel','hostel','apartment_daily','apartment_weekly','apartment_monthly','long_term','roommate','room','hostel_bed','house']));
 it('accepts two available places in a four-person property',()=>expect(listingSchema.parse(listing).available_places).toBe(2));
 it('rejects availability above total capacity',()=>expect(listingSchema.safeParse({...listing,available_places:5,total_places:4}).success).toBe(false));
 it('rejects an end date before a start date',()=>expect(listingSchema.safeParse({...listing,available_from:'2026-11-20',available_to:'2026-11-19'}).success).toBe(false));
});