begin;

create table if not exists public.site_pages (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  draft jsonb not null,
  published jsonb,
  updated_at timestamptz,
  check (slug not in ('api', 'blog', 'robots', 'sitemap', 'index', 'home', 'apps'))
);
alter table public.site_pages enable row level security;
revoke all on table public.site_pages from public, anon, authenticated;

create or replace view public.site_pages_published
with (security_barrier = true) as
select slug, published->>'kind' as kind, published->>'title' as title,
       published->>'body' as body, published->>'seoTitle' as seo_title,
       published->>'description' as description, published->>'image' as image,
       (published->>'footer')::boolean as footer,
       (published->>'indexable')::boolean as indexable, updated_at
from public.site_pages
where published is not null;
revoke all on public.site_pages_published from public, anon, authenticated;
grant select on public.site_pages_published to anon, authenticated;

create or replace function public.admin_site_pages(
  p_secret text, p_action text, p_slug text default null, p_page jsonb default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  auth_result text;
  draft_data jsonb;
begin
  auth_result := trim(both '"' from public.admin_login(p_secret)::text);
  if auth_result is distinct from 'ok' then
    return jsonb_build_object('status', coalesce(auth_result, 'bad'));
  end if;

  if p_action = 'list' then
    return jsonb_build_object('status', 'ok', 'pages', coalesce((
      select jsonb_agg(draft || jsonb_build_object('slug', slug, 'published', published is not null)
                       order by draft->>'title', slug)
      from public.site_pages
    ), '[]'::jsonb));
  end if;

  if p_slug is null or length(p_slug) > 80 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or p_slug in ('api', 'blog', 'robots', 'sitemap', 'index', 'home', 'apps') then
    return '{"status":"invalid_slug"}'::jsonb;
  end if;

  if p_action = 'unpublish' then
    update public.site_pages set published = null, updated_at = null where slug = p_slug;
    if not found then return '{"status":"missing"}'::jsonb; end if;
    return '{"status":"ok"}'::jsonb;
  end if;

  if p_action is null or p_action not in ('create', 'save', 'publish')
     or jsonb_typeof(p_page) is distinct from 'object'
     or coalesce(p_page->>'kind', '') not in ('page', 'post')
     or char_length(btrim(coalesce(p_page->>'title', ''))) not between 1 and 150
     or char_length(coalesce(p_page->>'body', '')) > 60000
     or char_length(coalesce(p_page->>'seoTitle', '')) > 150
     or char_length(coalesce(p_page->>'description', '')) > 320
     or char_length(coalesce(p_page->>'image', '')) > 2048 then
    return '{"status":"invalid"}'::jsonb;
  end if;

  draft_data := jsonb_build_object(
    'kind', p_page->>'kind', 'title', btrim(p_page->>'title'),
    'body', coalesce(p_page->>'body', ''), 'seoTitle', coalesce(p_page->>'seoTitle', ''),
    'description', coalesce(p_page->>'description', ''), 'image', coalesce(p_page->>'image', ''),
    'footer', coalesce(p_page->'footer' = 'true'::jsonb, false),
    'indexable', coalesce(p_page->'indexable' = 'true'::jsonb, true)
  );

  if p_action = 'create' then
    insert into public.site_pages(slug, draft) values (p_slug, draft_data)
    on conflict (slug) do nothing;
    if not found then return '{"status":"duplicate"}'::jsonb; end if;
  elsif p_action = 'publish' then
    update public.site_pages set draft = draft_data, published = draft_data, updated_at = now()
    where slug = p_slug and draft->>'kind' = draft_data->>'kind';
    if not found then return '{"status":"missing"}'::jsonb; end if;
  else
    update public.site_pages set draft = draft_data
    where slug = p_slug and draft->>'kind' = draft_data->>'kind';
    if not found then return '{"status":"missing"}'::jsonb; end if;
  end if;

  return '{"status":"ok"}'::jsonb;
end;
$$;
revoke all on function public.admin_site_pages(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_site_pages(text, text, text, jsonb) to anon;
commit;
