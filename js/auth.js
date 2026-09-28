// ============================================================
// auth.js - Sesión, perfil y control de acceso por rol
// ============================================================

const ROL_ESPERA = "En espera";
const ROL_ADMIN = "Administrador";
const ROL_RECEP = "Recepcionista";

/** Página a la que va cada rol al iniciar sesión. */
function rutaInicial(rol) {
    if (rol === ROL_ADMIN) return "dashboard.html";
    if (rol === ROL_RECEP) return "reservas.html";
    return "pendiente.html";
}

async function obtenerPerfil(userId) {
    const { data } = await supabaseClient
        .from("perfiles")
        .select("id, username, nombre, apellido, cedula, telefono, email, rol")
        .eq("id", userId)
        .maybeSingle();
    return data;
}

/**
 * Protege una página. Devuelve { user, perfil } o null si redirige.
 * rolesPermitidos: lista de roles que pueden ver la página.
 */
async function requerirSesion(rolesPermitidos) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace("index.html");
        return null;
    }
    const perfil = await obtenerPerfil(session.user.id);
    // Sin perfil = cuenta eliminada (despido): se cierra la sesión local
    if (!perfil) {
        await supabaseClient.auth.signOut();
        window.location.replace("index.html");
        return null;
    }
    if (!rolesPermitidos.includes(perfil.rol)) {
        window.location.replace(rutaInicial(perfil.rol));
        return null;
    }
    return { user: session.user, perfil };
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.replace("index.html");
}

document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-logout]");
    if (btn) {
        e.preventDefault();
        cerrarSesion();
    }
});
