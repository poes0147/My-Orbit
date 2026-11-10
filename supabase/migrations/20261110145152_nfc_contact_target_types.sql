-- Enum values must commit before the next migration uses them in constraints.
alter type public.nfc_target_type add value if not exists 'contact_card';
alter type public.nfc_target_type add value if not exists 'none';
