# Supabase Configuration

This directory contains Supabase migration files and configuration.

## Setup Instructions

### 1. Create Supabase Project
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project (name: `principal-finance`)
3. Note down: Project URL, Anon Key, Service Role Key

### 2. Install Supabase CLI
```bash
npm install -g supabase
```

### 3. Link to Project
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### 4. Run Migrations
```bash
supabase db push
```

## Directory Structure
- `migrations/` - SQL migration files
- `seed.sql` - Seed data for development
- `config.toml` - Supabase CLI configuration
