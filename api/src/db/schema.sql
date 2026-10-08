-- Idempotent schema, applied on boot.
create extension if not exists vector;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  content text not null,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists documents_tenant_idx on documents (tenant_id, created_at desc);

create table if not exists chunks (
  id bigserial primary key,
  document_id uuid not null references documents(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  ordinal int not null,
  content text not null,
  embedding vector(1536) not null,
  unique (document_id, ordinal)
);
create index if not exists chunks_tenant_idx on chunks (tenant_id);
create index if not exists chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
