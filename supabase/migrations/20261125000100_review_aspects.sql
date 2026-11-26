-- Redesign: "O que pesou?" na avaliação (chips). Lista fechada, validada no banco.
alter table public.reviews
  add column if not exists aspects text[] not null default '{}'
  constraint reviews_aspects_valid check (
    aspects <@ array['som','lotacao','fila','preco','seguranca','bebida']::text[]
    and cardinality(aspects) <= 6
  );

grant update (rating, body, aspects) on public.reviews to authenticated;
