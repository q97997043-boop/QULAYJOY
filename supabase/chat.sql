-- QULAYJOY: sayt ichidagi chat (mijoz <-> e'lon egasi).
-- Supabase -> SQL Editor da BIR MARTA ishga tushiring. schema.sql dan keyin.

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_name text NOT NULL DEFAULT '',
  owner_name text NOT NULL DEFAULT '',
  last_message text NOT NULL DEFAULT '',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id),
  CHECK (buyer_id <> owner_id)
);
CREATE INDEX IF NOT EXISTS conversations_buyer ON public.conversations(buyer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_owner ON public.conversations(owner_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS messages_conv ON public.messages(conversation_id, created_at);

-- Faqat ism (telefon emas!) suhbatga yoziladi; telefon raqami pullik xizmat bo'lgani uchun ochiq emas.
CREATE OR REPLACE FUNCTION public.conversation_fill() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT l.owner_id INTO NEW.owner_id FROM public.listings l WHERE l.id = NEW.listing_id;
  IF NEW.owner_id IS NULL THEN RAISE EXCEPTION 'listing not found'; END IF;
  NEW.buyer_id := auth.uid();
  SELECT left(coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), 'Mijoz'), 80) INTO NEW.buyer_name FROM public.profiles p WHERE p.id = NEW.buyer_id;
  SELECT left(coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), 'E''lon egasi'), 80) INTO NEW.owner_name FROM public.profiles p WHERE p.id = NEW.owner_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS conversation_fill ON public.conversations;
CREATE TRIGGER conversation_fill BEFORE INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.conversation_fill();

CREATE OR REPLACE FUNCTION public.message_touch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message = left(NEW.body, 200), last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS message_touch ON public.messages;
CREATE TRIGGER message_touch AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.message_touch();

GRANT SELECT, INSERT ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.conversations, public.messages TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conv_read ON public.conversations FOR SELECT TO authenticated USING (auth.uid() IN (buyer_id, owner_id));
CREATE POLICY conv_create ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid() AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.status = 'active' AND l.owner_id <> auth.uid()));
CREATE POLICY msg_read ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.buyer_id, c.owner_id)));
CREATE POLICY msg_send ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.buyer_id, c.owner_id)));
-- Faqat qabul qiluvchi "o'qildi" belgisini qo'ya oladi
CREATE POLICY msg_mark_read ON public.messages FOR UPDATE TO authenticated
  USING (sender_id <> auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.buyer_id, c.owner_id)))
  WITH CHECK (sender_id <> auth.uid());
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

-- Egasi chat orqali e'lon nomi/rasmini ko'rishi uchun (to'xtatilgan e'lon bo'lsa ham) — faqat suhbat ishtirokchilari
CREATE POLICY listings_chat_read ON public.listings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.listing_id = id AND auth.uid() IN (c.buyer_id, c.owner_id)));

-- Rasm saqlash uchun bucket (agar hali yo'q bo'lsa)
INSERT INTO storage.buckets (id, name, public) VALUES ('listing-media', 'listing-media', false) ON CONFLICT (id) DO NOTHING;
