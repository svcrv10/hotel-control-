// ============================================================
// CONFIGURACIÓN DE SUPABASE
// ------------------------------------------------------------
// 1. Ve a tu proyecto en https://app.supabase.com
// 2. Entra a "Project Settings" > "API"
// 3. Copia "Project URL" y pégalo en SUPABASE_URL
// 4. Copia la clave "anon public" y pégala en SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU-CLAVE-ANON-PUBLICA";

// Cliente global de Supabase, reutilizado por toda la app.
// (requiere el <script> de supabase-js cargado antes que este archivo)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
