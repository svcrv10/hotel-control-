// facturas.js - Historial de facturas (Administrador)
let facturas = [];

function pintarFacturas() {
    const q = document.getElementById("buscar-factura").value.trim().toLowerCase();
    const filtradas = facturas.filter((f) =>
        numeroFactura(f.id).toLowerCase().includes(q) || (f.huespedes?.nombre_completo || "").toLowerCase().includes(q));
    const tabla = document.getElementById("tabla-facturas");
    document.getElementById("f-cantidad").textContent = facturas.length;
    document.getElementById("f-total").textContent = formatoMoneda(facturas.reduce((s, f) => s + Number(f.total), 0));
    if (!filtradas.length) {
        tabla.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No hay facturas.</td></tr>`;
        return;
    }
    tabla.innerHTML = filtradas.map((f) => `
        <tr>
            <td class="fw-semibold">${numeroFactura(f.id)}</td>
            <td>${formatoFechaHora(f.fecha)}</td>
            <td>${esc(f.huespedes?.nombre_completo)}</td>
            <td>${esc(f.reservaciones?.habitaciones?.numero)}</td>
            <td>${esc(f.pagos?.metodo)}</td>
            <td>${formatoMoneda(f.total)}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-id="${f.id}" aria-label="Ver factura ${numeroFactura(f.id)}"><i class="bi bi-receipt"></i> Ver</button></td>
        </tr>`).join("");
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await iniciarPagina([ROL_ADMIN], "Facturas");
    if (!sesion) return;
    asegurarModalFactura();
    const { data, error } = await supabaseClient.from("facturas").select(`
        id, total, fecha, huespedes ( nombre_completo ), pagos ( metodo ),
        reservaciones ( habitaciones ( numero ) )`).order("id", { ascending: false });
    if (error) return mostrarAlerta("alertas", "Error al cargar facturas: " + error.message, "danger");
    facturas = data;
    pintarFacturas();
    document.getElementById("buscar-factura").addEventListener("input", pintarFacturas);
    document.getElementById("tabla-facturas").addEventListener("click", (e) => {
        const b = e.target.closest("button[data-id]");
        if (b) abrirFactura(Number(b.dataset.id));
    });
});
