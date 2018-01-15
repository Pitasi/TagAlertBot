ALTER TABLE public.users ADD firstName VARCHAR(256) NULL;
ALTER TABLE public.users ADD lastName VARCHAR(256) NULL;
ALTER TABLE public.users ADD language VARCHAR(256) NULL;
ALTER TABLE public.users ALTER COLUMN username SET NOT NULL;