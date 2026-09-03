// ============================================================
// utils.js - Utilidades compartidas por todas las páginas
// ============================================================

/**
 * Muestra un mensaje tipo "flash" (igual que los de Flask) dentro
 * del contenedor con el id indicado.
 * categoria: 'success' | 'danger' | 'warning' | 'info'
 */
function mostrarAlerta(contenedorId, mensaje, categoria = "info") {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    const alerta = document.createElement("div");
    alerta.className = `alert alert-${categoria} alert-dismissible fade show`;
    alerta.role = "alert";
    alerta.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    contenedor.appendChild(alerta);
}

function formatoMoneda(valor) {
    const numero = Number(valor || 0);
    return `$${numero.toFixed(2)}`;
}

/**
 * Marca como "active" el link del sidebar que corresponde a la
 * página actual (compara con el atributo data-nav de cada <a>).
 */
function marcarNavActivo() {
    const pagina = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav]").forEach((link) => {
        if (link.getAttribute("data-nav") === pagina) {
            link.classList.add("active");
        }
    });
}

document.addEventListener("DOMContentLoaded", marcarNavActivo);
