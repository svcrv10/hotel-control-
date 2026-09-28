// factura.js - Visor/impresión de facturas (usado en Reservaciones y Facturas)
function asegurarModalFactura() {
    if (document.getElementById("modalFactura")) return;
    document.body.insertAdjacentHTML("beforeend", `
    <div class="modal fade" id="modalFactura" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title"><i class="bi bi-receipt"></i> Factura</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
        <div class="modal-body" id="factura-cuerpo"></div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button><button type="button" class="btn btn-primary" onclick="window.print()"><i class="bi bi-printer"></i> Imprimir / PDF</button></div>
    </div></div></div>`);
}

const SELECT_FACTURA = `
    id, total, fecha, reservacion_id,
    huespedes ( nombre_completo, cedula_pasaporte, telefono, email ),
    pagos ( metodo, referencia, fecha_pago ),
    reservaciones ( fecha_entrada, fecha_salida, monto_total, habitaciones ( numero, tipo, precio_noche ) )`;

function nochesEntre(a, b) {
    return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

function htmlFactura(f) {
    const h = f.huespedes || {}, p = f.pagos || {}, r = f.reservaciones || {}, hab = r.habitaciones || {};
    const noches = r.fecha_entrada ? nochesEntre(r.fecha_entrada, r.fecha_salida) : 0;
    return `
    <div class="invoice">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div><h3><i class="bi bi-building"></i> HotelControl</h3><div class="small" style="color:#66766D">Factura de servicios de hospedaje</div></div>
            <div class="text-end"><div class="fw-bold fs-5">${numeroFactura(f.id)}</div><div class="small">${formatoFechaHora(f.fecha)}</div></div>
        </div>
        <hr>
        <div class="row g-3 mb-3">
            <div class="col-sm-6"><div class="small text-uppercase" style="color:#66766D">Cliente</div>
                <div class="fw-semibold">${esc(h.nombre_completo)}</div>
                <div>${esc(h.cedula_pasaporte)}</div>
                <div class="small">${esc(h.telefono || "")} ${esc(h.email || "")}</div></div>
            <div class="col-sm-6"><div class="small text-uppercase" style="color:#66766D">Método de pago</div>
                <div class="fw-semibold">${esc(p.metodo)}</div>
                ${p.referencia ? `<div>Ref.: ${esc(p.referencia)}</div>` : ""}
                <div class="small">${formatoFechaHora(p.fecha_pago)}</div></div>
        </div>
        <table>
            <thead><tr><th>Descripción</th><th class="text-end">Noches</th><th class="text-end">Precio/noche</th><th class="text-end">Importe</th></tr></thead>
            <tbody><tr>
                <td>Habitación ${esc(hab.numero)} (${esc(hab.tipo)})<br><span class="small" style="color:#66766D">${formatoFecha(r.fecha_entrada)} al ${formatoFecha(r.fecha_salida)}</span></td>
                <td class="text-end">${noches}</td>
                <td class="text-end">${formatoMoneda(hab.precio_noche)}</td>
                <td class="text-end">${formatoMoneda(f.total)}</td>
            </tr></tbody>
        </table>
        <hr>
        <div class="d-flex justify-content-between align-items-center"><span class="fw-semibold">TOTAL PAGADO</span><span class="invoice-total">${formatoMoneda(f.total)}</span></div>
        <div class="small mt-3" style="color:#66766D">Gracias por su preferencia.</div>
    </div>`;
}

async function abrirFactura(facturaId) {
    asegurarModalFactura();
    const { data, error } = await supabaseClient.from("facturas").select(SELECT_FACTURA).eq("id", facturaId).maybeSingle();
    if (error || !data) return mostrarAlerta("alertas", "No se pudo cargar la factura.", "danger");
    document.getElementById("factura-cuerpo").innerHTML = htmlFactura(data);
    abrirModal("modalFactura");
}

async function abrirFacturaDeReserva(reservacionId) {
    const { data, error } = await supabaseClient.from("facturas").select("id").eq("reservacion_id", reservacionId).maybeSingle();
    if (error || !data) return mostrarAlerta("alertas", "Esta reservación no tiene factura.", "warning");
    abrirFactura(data.id);
}
