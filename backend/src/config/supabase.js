
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        "Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend/.env"
    );
}

if (!serviceRoleKey) {
    throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY in backend/.env"
    );
}

// Normal client: respects user authentication and RLS.
export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);

// Admin client: backend only, bypasses RLS.
// Use only after performing authorization and validation.
export const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

console.log("Supabase clients initialized successfully");
