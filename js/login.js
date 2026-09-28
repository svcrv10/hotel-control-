// ============================================================
// login.js - Inicio de sesión, registro y recuperación
// ============================================================

let modoRecuperacion = false;

// Debe registrarse de inmediato: Supabase dispara este evento al abrir
// el enlace del correo de "recuperar contraseña".
supabaseClient.auth.onAuthStateChange((evento) => {
    if (evento === "PASSWORD_RECOVERY") {
        modoRecuperacion = true;
        mostrarPanel("nueva");
    }
});

const PANELES = ["login", "registro", "confirmar", "recuperar", "nueva"];

function mostrarPanel(nombre) {
    limpiarAlertas("alertas");
    PANELES.forEach((p) => { document.getElementById(`panel-${p}`).hidden = p !== nombre; });
    document.querySelectorAll(".login-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === nombre));
    if (nombre === "registro") history.replaceState(null, "", "#registro");
    else if (nombre === "login") history.replaceState(null, "", location.pathname);
}

function urlDeRetorno() {
    return location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html";
}

// ---------- Validaciones ----------
function edadEnAnios(fechaIso) {
    const nac = new Date(fechaIso + "T00:00:00");
    const hoy = new Date();
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
}

// ---------- Iniciar sesión ----------
async function manejarLogin(e) {
    e.preventDefault();
    limpiarAlertas("alertas");
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    if (!email || !password) return mostrarAlerta("alertas", "Ingresa tu correo y contraseña.", "warning");

    await conBoton(e.submitter, async () => {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            const sinConfirmar = /not confirmed/i.test(error.message);
            return mostrarAlerta("alertas", sinConfirmar
                ? "Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada (y el spam)."
                : "Correo o contraseña incorrectos.", "danger");
        }
        const perfil = await obtenerPerfil(data.user.id);
        if (!perfil) {
            await supabaseClient.auth.signOut();
            return mostrarAlerta("alertas", "Esta cuenta ya no existe en el sistema. Puedes registrarte de nuevo.", "danger");
        }
        sessionStorage.setItem("bienvenida", "1");
        window.location.replace(rutaInicial(perfil.rol));
    });
}

// ---------- Registro ----------
async function manejarRegistro(e) {
    e.preventDefault();
    limpiarAlertas("alertas");

    const nombre = document.getElementById("reg-nombre").value.trim();
    const apellido = document.getElementById("reg-apellido").value.trim();
    const cedulaNum = document.getElementById("reg-cedula").value.trim();
    const cedula = `${document.getElementById("reg-cedula-tipo").value}-${cedulaNum}`;
    const telNum = document.getElementById("reg-telefono").value.trim();
    const nacimiento = document.getElementById("reg-nacimiento").value;
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;

    const errores = [];
    if (!nombre || !apellido) errores.push("Nombre y apellido son obligatorios.");
    if (!/^\d{6,9}$/.test(cedulaNum)) errores.push("La cédula debe tener entre 6 y 9 dígitos.");
    if (!/^\d{10}$/.test(telNum)) errores.push("El teléfono debe tener 10 dígitos después de +58 (ej. 4141234567).");
    if (!nacimiento) errores.push("Indica tu fecha de nacimiento.");
    else if (edadEnAnios(nacimiento) < 18 || edadEnAnios(nacimiento) > 100) errores.push("Debes ser mayor de 18 años.");
    if (!/^\S+@\S+\.\S+$/.test(email)) errores.push("Ingresa un correo válido.");
    if (password.length < 6) errores.push("La contraseña debe tener mínimo 6 caracteres.");
    if (errores.length) return errores.forEach((m) => mostrarAlerta("alertas", m, "danger"));

    await conBoton(e.submitter, async () => {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: urlDeRetorno(),
                data: { nombre, apellido, cedula, telefono: "+58" + telNum, fecha_nacimiento: nacimiento },
            },
        });

        if (error) {
            const msg = /already registered/i.test(error.message)
                ? "Ese correo ya está registrado."
                : /database error/i.test(error.message)
                    ? "No se pudo registrar: la cédula ya está registrada en el sistema."
                    : /password/i.test(error.message)
                        ? "La contraseña no cumple los requisitos (mínimo 6 caracteres)."
                        : "No se pudo crear la cuenta: " + error.message;
            return mostrarAlerta("alertas", msg, "danger");
        }
        // Con confirmación activada, un correo ya existente devuelve identities vacío
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            return mostrarAlerta("alertas", "Ese correo ya está registrado.", "danger");
        }
        // Si el proyecto NO exige confirmar correo, ya hay sesión
        if (data.session) {
            sessionStorage.setItem("bienvenida", "1");
            return window.location.replace("pendiente.html");
        }
        document.getElementById("correo-enviado").textContent = email;
        document.getElementById("form-registro").reset();
        mostrarPanel("confirmar");
    });
}

// ---------- Recuperar contraseña ----------
async function manejarRecuperar(e) {
    e.preventDefault();
    limpiarAlertas("alertas");
    const email = document.getElementById("rec-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return mostrarAlerta("alertas", "Ingresa un correo válido.", "warning");
    await conBoton(e.submitter, async () => {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: urlDeRetorno() });
        if (error) return mostrarAlerta("alertas", "No se pudo enviar el enlace: " + error.message, "danger");
        mostrarAlerta("alertas", "Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.", "success");
    });
}

async function manejarNuevaClave(e) {
    e.preventDefault();
    limpiarAlertas("alertas");
    const p1 = document.getElementById("nueva-password").value;
    const p2 = document.getElementById("nueva-password2").value;
    if (p1.length < 6) return mostrarAlerta("alertas", "La contraseña debe tener mínimo 6 caracteres.", "danger");
    if (p1 !== p2) return mostrarAlerta("alertas", "Las contraseñas no coinciden.", "danger");
    await conBoton(e.submitter, async () => {
        const { error } = await supabaseClient.auth.updateUser({ password: p1 });
        if (error) return mostrarAlerta("alertas", "No se pudo actualizar: " + error.message, "danger");
        await supabaseClient.auth.signOut();
        modoRecuperacion = false;
        mostrarPanel("login");
        mostrarAlerta("alertas", "Contraseña actualizada. Ya puedes iniciar sesión.", "success");
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    document.addEventListener("click", (e) => {
        const t = e.target.closest("[data-tab]");
        if (t) mostrarPanel(t.dataset.tab);
    });
    document.getElementById("form-login").addEventListener("submit", manejarLogin);
    document.getElementById("form-registro").addEventListener("submit", manejarRegistro);
    document.getElementById("form-recuperar").addEventListener("submit", manejarRecuperar);
    document.getElementById("form-nueva").addEventListener("submit", manejarNuevaClave);

    // Solo dígitos en cédula y teléfono
    ["reg-cedula", "reg-telefono"].forEach((id) => {
        document.getElementById(id).addEventListener("input", (ev) => { ev.target.value = ev.target.value.replace(/\D/g, ""); });
    });
    document.getElementById("reg-nacimiento").max = new Date().toISOString().split("T")[0];

    if (location.hash === "#registro") mostrarPanel("registro");

    // Si ya hay sesión (p. ej. tras confirmar el correo), va a su pantalla
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && !modoRecuperacion && !location.hash.includes("type=recovery")) {
        const perfil = await obtenerPerfil(session.user.id);
        if (perfil) {
            sessionStorage.setItem("bienvenida", "1");
            window.location.replace(rutaInicial(perfil.rol));
        } else {
            await supabaseClient.auth.signOut();
        }
    }
});
