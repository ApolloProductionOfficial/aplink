CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



SET default_table_access_method = heap;

--
-- Name: news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    source text,
    url text,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    language text DEFAULT 'en'::text NOT NULL
);

ALTER TABLE ONLY public.news REPLICA IDENTITY FULL;


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: idx_news_language; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_language ON public.news USING btree (language);


--
-- Name: idx_news_language_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_language_published ON public.news USING btree (language, published_at DESC);


--
-- Name: idx_news_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_published_at ON public.news USING btree (published_at DESC);


--
-- Name: news News are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "News are viewable by everyone" ON public.news FOR SELECT USING (true);


--
-- Name: news; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


