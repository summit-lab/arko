-- Agregar 'cta_bio' como fuente de pago válida en sales.
-- El usuario distingue entre "Link en Bio" (click directo al link del perfil)
-- y "CTA Bio" (copy del bio que empuja a un recurso o DM). Son dos fuentes
-- distintas que querés medir por separado en Top fuentes.

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_source_type_check;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_source_type_check
  CHECK (source_type = ANY (ARRAY['reel'::text, 'historia'::text, 'post'::text, 'link_bio'::text, 'cta_bio'::text, 'otro'::text]));
