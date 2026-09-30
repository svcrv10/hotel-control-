// ============================================================
// CONFIGURACIÓN DE SUPABASE
// ------------------------------------------------------------
// 1. Ve a tu proyecto en https://app.supabase.com
// 2. Entra a "Project Settings" > "API"
// 3. Copia "Project URL" y pégalo en SUPABASE_URL
// 4. Copia la clave "anon public" y pégala en SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL = "https://xbyogswquwojiefsizrs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhieW9nc3dxdXdvamllZnNpenJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTU2NjQsImV4cCI6MjEwMzk3MTY2NH0.5IXapwiofxCq6txc2A91VYVXozly4KwPtw8trgQ_fqA;

// Cliente global de Supabase, reutilizado por toda la app.
// (requiere el <script> de supabase-js cargado antes que este archivo)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
