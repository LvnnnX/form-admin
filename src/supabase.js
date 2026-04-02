import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client using environment variables
// - VITE_SUPABASE_URL: Supabase project URL
// - VITE_SUPABASE_ANON_KEY: anon/public key
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase };
export default supabase;
