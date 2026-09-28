// ============================================================
// utils.js - Utilidades compartidas por todas las páginas
// ============================================================

const ZONA_HORARIA = "America/Caracas";
const METODOS_PAGO = [
    { valor: "Efectivo", icono: "bi-cash-stack", requiereReferencia: false },
    { valor: "Tarjeta", icono: "bi-credit-card-2-front", requiereReferencia: true },
    { valor: "Transferencia", icono: "bi-bank", requiereReferencia: true },
    { valor: "Pago móvil", icono: "bi-phone", requiereReferencia: true },
    { valor: "Zelle", icono: "bi-currency-dollar", requiereReferencia: true },
];

/** Escapa texto para insertarlo de forma segura dentro de innerHTML. */
function esc(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

/**
 * Muestra un mensaje tipo "flash" en el contenedor indicado.
 * El mensaje se inserta como TEXTO (seguro ante datos de usuarios).
 * categoria: 'success' | 'danger' | 'warning' | 'info'
 */
function mostrarAlerta(contenedorId, mensaje, categoria = "info") {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    const alerta = document.createElement("div");
    alerta.className = `alert alert-${categoria} alert-dismissible fade show`;
    alerta.setAttribute("role", "alert");
    alerta.append(document.createTextNode(mensaje));
    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "btn-close";
    cerrar.setAttribute("data-bs-dismiss", "alert");
    cerrar.setAttribute("aria-label", "Cerrar");
    alerta.appendChild(cerrar);
    contenedor.appendChild(alerta);
    if (categoria === "success" || categoria === "info") {
        setTimeout(() => alerta.remove(), 7000);
    }
}

function limpiarAlertas(contenedorId) {
    const c = document.getElementById(contenedorId);
    if (c) c.innerHTML = "";
}

function formatoMoneda(valor) {
    return `$${Number(valor || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' sin desfases de zona horaria. */
function formatoFecha(iso) {
    if (!iso) return "—";
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
}

function formatoFechaHora(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("es-VE", {
        timeZone: ZONA_HORARIA, day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

/** Fecha de hoy ('YYYY-MM-DD') en la zona horaria del hotel. */
function hoyLocal() {
    return new Date().toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA });
}

function fechaLocalDe(ts) {
    return new Date(ts).toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA });
}

function numeroFactura(id) {
    return "F-" + String(id).padStart(6, "0");
}

function iniciales(nombre) {
    return String(nombre || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function badgeRol(rol) {
    if (rol === "Administrador") return `<span class="badge bg-primary">Administrador</span>`;
    if (rol === "Recepcionista") return `<span class="badge bg-success">Recepcionista</span>`;
    return `<span class="badge bg-warning">En espera</span>`;
}

function abrirModal(id) {
    bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show();
}
function cerrarModal(id) {
    const inst = bootstrap.Modal.getInstance(document.getElementById(id));
    if (inst) inst.hide();
}

/** Deshabilita un botón mientras corre una operación asíncrona. */
async function conBoton(boton, fn) {
    if (boton) boton.disabled = true;
    try { return await fn(); } finally { if (boton) boton.disabled = false; }
}
