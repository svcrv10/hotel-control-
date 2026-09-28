// ============================================================
// layout.js - Estructura común (sidebar, topbar) según el rol
// ============================================================

const MENU = [
    { pagina: "dashboard.html", texto: "Dashboard", icono: "bi-speedometer2", roles: [ROL_ADMIN] },
    { pagina: "habitaciones.html", texto: "Habitaciones", icono: "bi-door-closed", roles: [ROL_ADMIN, ROL_RECEP] },
    { pagina: "huespedes.html", texto: "Huéspedes", icono: "bi-people", roles: [ROL_ADMIN, ROL_RECEP] },
    { pagina: "reservas.html", texto: "Reservaciones", icono: "bi-calendar-check", roles: [ROL_ADMIN, ROL_RECEP] },
    { pagina: "facturas.html", texto: "Facturas", icono: "bi-receipt", roles: [ROL_ADMIN] },
    { pagina: "caja.html", texto: "Cierre de caja", icono: "bi-safe2", roles: [ROL_ADMIN] },
    { pagina: "empleados.html", texto: "Empleados", icono: "bi-person-badge", roles: [ROL_ADMIN], badgeId: "badge-pendientes" },
];

function menuHtml(rol, paginaActual) {
    return MENU.filter((m) => m.roles.includes(rol)).map((m) => `
        <li>
            <a class="sidebar-link ${m.pagina === paginaActual ? "active" : ""}" href="${m.pagina}">
                <i class="bi ${m.icono}"></i><span>${m.texto}</span>
                ${m.badgeId ? `<span class="nav-badge d-none" id="${m.badgeId}">0</span>` : ""}
            </a>
        </li>`).join("");
}

function pieHtml(perfil) {
    const nombre = esc(perfil.nombre ? `${perfil.nombre} ${perfil.apellido || ""}`.trim() : perfil.username);
    return `
        <div class="sidebar-user">
            <i class="bi bi-person-circle"></i>
            <div><span class="user-name">${nombre}</span><span class="user-role">${esc(perfil.rol)}</span></div>
        </div>
        <a class="sidebar-logout" href="#" data-logout><i class="bi bi-box-arrow-right"></i> Salir</a>`;
}

/**
 * Inicializa una página protegida.
 * @param {string[]} roles   roles que pueden entrar
 * @param {string} titulo    título para la barra superior móvil
 * @returns {Promise<{user, perfil}|null>}
 */
async function iniciarPagina(roles, titulo) {
    const sesion = await requerirSesion(roles);
    if (!sesion) return null;

    const { perfil } = sesion;
    const pagina = window.location.pathname.split("/").pop() || "index.html";
    const contenido = document.getElementById("page-content");
    const nav = menuHtml(perfil.rol, pagina);
    const pie = pieHtml(perfil);

    document.body.insertAdjacentHTML("afterbegin", `
    <div class="app-shell">
        <aside class="sidebar" aria-label="Menú principal">
            <div class="sidebar-brand">
                <i class="bi bi-building"></i>
                <div><span class="brand-name">HotelControl</span><span class="brand-tag">Panel de gestión</span></div>
            </div>
            <ul class="sidebar-nav">${nav}</ul>
            <div class="sidebar-footer">${pie}</div>
        </aside>
        <div class="main-area">
            <header class="topbar">
                <button class="menu-toggle" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileNav" aria-label="Abrir menú"><i class="bi bi-list"></i></button>
                <span class="topbar-title">${esc(titulo)}</span>
            </header>
            <div class="content-wrap" id="contenedor-principal"></div>
        </div>
    </div>
    <div class="offcanvas offcanvas-start sidebar-offcanvas" tabindex="-1" id="mobileNav">
        <div class="offcanvas-header">
            <span class="brand-name"><i class="bi bi-building"></i> HotelControl</span>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
        </div>
        <div class="offcanvas-body p-0 d-flex flex-column">
            <ul class="sidebar-nav">${nav.replace('id="badge-pendientes"', 'id="badge-pendientes-m"')}</ul>
            <div class="sidebar-footer mt-auto">${pie}</div>
        </div>
    </div>`);

    document.getElementById("contenedor-principal").appendChild(contenido);
    contenido.hidden = false;

    // Mensaje de bienvenida con el rol asignado (solo tras iniciar sesión)
    if (sessionStorage.getItem("bienvenida")) {
        sessionStorage.removeItem("bienvenida");
        mostrarAlerta("alertas", `Bienvenido/a. Tu rol asignado es: ${perfil.rol}.`, "success");
    }

    if (perfil.rol === ROL_ADMIN) actualizarPendientes();
    return sesion;
}

/** Muestra en el menú cuántos empleados esperan que se les asigne un rol. */
async function actualizarPendientes() {
    const { count } = await supabaseClient
        .from("perfiles").select("id", { count: "exact", head: true }).eq("rol", ROL_ESPERA);
    ["badge-pendientes", "badge-pendientes-m"].forEach((id) => {
        const b = document.getElementById(id);
        if (!b) return;
        b.textContent = count || 0;
        b.classList.toggle("d-none", !count);
    });
}
