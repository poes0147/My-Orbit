alter table private.nfc_bind_attempts
  add column id bigint generated always as identity primary key;
