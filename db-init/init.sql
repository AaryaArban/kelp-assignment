CREATE TABLE public.users (
  "name" varchar NOT NULL, 
  age int4 NOT NULL,
  address jsonb NULL,
  additional_info jsonb NULL,
  id serial4 NOT NULL
);

INSERT INTO public.users ("name", age, address, additional_info)
VALUES ('Initial Record (for testing)', 99, '{"city": "Docker"}'::jsonb, '{}'::jsonb);