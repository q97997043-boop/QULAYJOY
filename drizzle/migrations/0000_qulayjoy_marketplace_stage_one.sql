CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 first_name text NOT NULL DEFAULT '' CHECK (char_length(first_name)<=80),
 last_name text NOT NULL DEFAULT '' CHECK (char_length(last_name)<=80),
 phone text NOT NULL DEFAULT '' CHECK (char_length(phone)<=25),
 avatar_path text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_read_own ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK (id=auth.uid());
CREATE FUNCTION public.create_signup_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.profiles(id,first_name,last_name,phone) VALUES(NEW.id,left(coalesce(NEW.raw_user_meta_data->>'first_name',''),80),left(coalesce(NEW.raw_user_meta_data->>'last_name',''),80),left(coalesce(NEW.raw_user_meta_data->>'phone',''),25));
 RETURN NEW;
END; $$;
CREATE TRIGGER qulayjoy_signup_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_signup_profile();
CREATE TABLE public.listings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 160),
 description text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 5000),
 category text NOT NULL CHECK (category IN ('hotel','hostel','apartment_daily','apartment_weekly','apartment_monthly','long_term','roommate','room','hostel_bed','house')),
 city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 80),
 district text NOT NULL DEFAULT '' CHECK (char_length(district)<=100),
 address text NOT NULL DEFAULT '' CHECK (char_length(address)<=250),
 latitude numeric CHECK (latitude BETWEEN -90 AND 90), longitude numeric CHECK (longitude BETWEEN -180 AND 180),
 price bigint NOT NULL CHECK (price>=0 AND price<=100000000000),
 payment_period text NOT NULL CHECK (payment_period IN ('daily','weekly','monthly')),
 available_places integer NOT NULL CHECK (available_places BETWEEN 1 AND 1000),
 total_places integer NOT NULL CHECK (total_places BETWEEN 1 AND 1000 AND total_places>=available_places),
 rooms integer NOT NULL DEFAULT 1 CHECK (rooms BETWEEN 1 AND 100),
 floor integer CHECK (floor BETWEEN -5 AND 100),
 room_number text CHECK (char_length(room_number)<=30),
 available_from date, available_to date,
 amenities text[] NOT NULL DEFAULT '{}',
 house_rules text NOT NULL DEFAULT '' CHECK (char_length(house_rules)<=1500),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY listings_public_read ON public.listings FOR SELECT TO anon,authenticated USING(status='active');
CREATE POLICY listings_owner_read ON public.listings FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY listings_owner_create ON public.listings FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
CREATE POLICY listings_owner_update ON public.listings FOR UPDATE TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY listings_owner_delete ON public.listings FOR DELETE TO authenticated USING(owner_id=auth.uid());
CREATE INDEX listings_search ON public.listings(status,city,category,price);
CREATE INDEX listings_owner ON public.listings(owner_id);
CREATE TABLE public.listing_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
 storage_path text NOT NULL CHECK (char_length(storage_path)<=500), media_type text NOT NULL DEFAULT 'image' CHECK(media_type IN ('image','video')),
 position integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.listing_images TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.listing_images TO authenticated;
GRANT ALL ON public.listing_images TO service_role;
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_public_read ON public.listing_images FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.listings l WHERE l.id=listing_id AND l.status='active'));
CREATE POLICY media_owner_all ON public.listing_images FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM public.listings l WHERE l.id=listing_id AND l.owner_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM public.listings l WHERE l.id=listing_id AND l.owner_id=auth.uid()) AND split_part(storage_path,'/',1)=auth.uid()::text);
CREATE POLICY listing_storage_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='listing-media' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY listing_storage_owner_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='listing-media' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY listing_storage_owner_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='listing-media' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY listing_storage_public_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='listing-media' AND EXISTS(SELECT 1 FROM public.listing_images i JOIN public.listings l ON l.id=i.listing_id WHERE i.storage_path=name AND l.status='active'));