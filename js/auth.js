// ============================================================
// auth.js - Autenticación con Supabase Auth
// ============================================================

/**
 * Protege una página: si no hay sesión activa, redirige al login.
 * Devuelve { user, perfil } si todo está bien.
 * Debe llamarse al inicio de cada página protegida (dashboard,
 * habitaciones, huespedes, reservas).
 */
async function requerirSesion() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = "index.html";
        return null;
    }

    const { data: perfil } = await supabaseClient
        .from("perfiles")
        .select("username, rol")
        .eq("id", session.user.id)
        .single();

    // Pinta el nombre/rol del usuario en el sidebar si existen los elementos
    const nombreEl = document.querySelector("[data-user-name]");
    const rolEl = document.querySelector("[data-user-rol]");
    if (nombreEl) nombreEl.textContent = perfil ? perfil.username : session.user.email;
    if (rolEl) rolEl.textContent = perfil ? perfil.rol : "";

    return { user: session.user, perfil };
}

/**
 * Cierra sesión y vuelve al login.
 */
async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

/**
 * Maneja el envío del formulario de login (index.html).
 */
async function manejarLogin(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        mostrarAlerta("login-alertas", "Usuario o contraseña incorrectos.", "danger");
        return;
    }

    window.location.href = "dashboard.html";
}

// Engancha los listeners del formulario de login si existe en la página
document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("form-login");
    if (formLogin) {
        formLogin.addEventListener("submit", manejarLogin);
    }

    document.querySelectorAll("[data-logout]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    });
});
