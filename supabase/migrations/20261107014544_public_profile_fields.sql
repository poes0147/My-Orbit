alter table public.profiles
  add column display_name text check (length(display_name) <= 120),
  add column avatar_url text check (length(avatar_url) <= 2048 and avatar_url ~ '^https://'),
  add column contact_email text check (length(contact_email) <= 254 and contact_email !~ '[[:cntrl:]]'),
  add column contact_phone text check (contact_phone ~ '^[+0-9(). -]{1,40}$');
