-- ==========================================
-- TELECOM INTELLIGENCE PLATFORM (TIP)
-- Migration 01: Initial Infrastructure
-- ==========================================

CREATE TABLE IF NOT EXISTS public.telecom_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'viewer' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.telecom_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploader_id UUID REFERENCES public.telecom_users(id),
    network_type VARCHAR(50) NOT NULL,
    signal_strength DECIMAL(10,2),
    call_drop_rate DECIMAL(5,2),
    latency_ms INT,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.llm_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.telecom_users(id),
    prompt TEXT NOT NULL,
    response TEXT,
    query_duration_ms INT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.telecom_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telecom_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data" ON public.telecom_metrics FOR SELECT USING (auth.uid() = uploader_id);
CREATE POLICY "Users can insert their own data" ON public.telecom_metrics FOR INSERT WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Users can view their own queries" ON public.llm_queries FOR SELECT USING (auth.uid() = user_id);
