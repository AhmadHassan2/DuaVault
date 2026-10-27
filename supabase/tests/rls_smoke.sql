-- RLS smoke test: user B must not see or modify user A's data.
grant all on all tables in schema public to authenticated;
grant all on storage.objects to authenticated;
grant execute on all functions in schema public to authenticated;
grant usage on schema extensions to authenticated;
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111','a@x.test'),('22222222-2222-2222-2222-222222222222','b@x.test');
select count(*) as profiles_created from public.profiles;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into public.saved_items (id, title, content_type, subcategory, english_text, arabic_normalized)
  values ('aaaaaaaa-0000-0000-0000-000000000001','Dua for patience','dua','hardship','O Allah grant me patience in hardship','اللهم صبرا');
insert into public.collections (id, name) values ('cccccccc-0000-0000-0000-00000000000a','A collection');
insert into public.collection_items (collection_id, item_id) values ('cccccccc-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001');
select public.record_practice('aaaaaaaa-0000-0000-0000-000000000001','practiced');
select practice_count, last_reviewed_at is not null as reviewed from public.saved_items;
select id from public.search_saved_items('patience');
insert into storage.objects (bucket_id, name) values ('screenshots','11111111-1111-1111-1111-111111111111/x.png');

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select count(*) as b_sees_items from public.saved_items;
select count(*) as b_sees_search from public.search_saved_items('patience');
update public.saved_items set title='hacked';
select count(*) as b_sees_objects from storage.objects;
insert into public.collections (id, name) values ('cccccccc-0000-0000-0000-00000000000b','B collection');
\set ON_ERROR_STOP 0
insert into public.collection_items (collection_id, item_id) values ('cccccccc-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name) values ('screenshots','11111111-1111-1111-1111-111111111111/evil.png');
insert into public.saved_items (owner_id, title, content_type, subcategory) values ('11111111-1111-1111-1111-111111111111','spoof','dua','other');
insert into public.saved_items (title, content_type, subcategory) values ('bad category','dua','morning');
\set ON_ERROR_STOP 1
reset role;
select title from public.saved_items;
