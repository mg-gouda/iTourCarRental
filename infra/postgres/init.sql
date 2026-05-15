-- Enable pg_trgm for fuzzy text search on combo-box lookup endpoints
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Enable btree_gist for exclusion constraints (booking overlap)
CREATE EXTENSION IF NOT EXISTS btree_gist;
