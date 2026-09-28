// caja.js - Cierre de caja diario por método de pago (Administrador)
let pagosSinCerrar = [];
let cierres = [];

function pagosDeFecha(fecha) {
    return pagosSinCerrar.filter((p) => fechaLocalDe(p.fecha_pago) === fecha);
}

function agruparPorMetodo(pagos) {
    const g = {};
    pagos.forEach((p) => {
        g[p.metodo] = g[p.metodo] || { metodo: p.metodo, cantidad: 0, total: 0 };
        g[p.metodo].cantidad++;
        g[p.metodo].total += Number(p.monto);
    });
    return Object.values(g).sort((a, b) => a.metodo.localeCompare(b.metodo));
}

function pintarCaja() {
    const fecha = document.getElementById("caja-fecha").value;
    const pagos = pagosDeFecha(fecha);
    const grupos = agruparPorMetodo(pagos);
    const total = pagos.reduce((s, p) => s + Number(p.monto), 0);

    document.getElementById("caja-resumen").innerHTML = grupos.length
        ? grupos.map((g) => `<tr><td>${esc(g.metodo)}</td><td class="text-end">${g.cantidad}</td><td class="text-end">${formatoMoneda(g.total)}</td></tr>`).join("")
        : `<tr><td colspan="3" class="text-center text-muted py-3">Sin pagos pendientes de cierre en esta fecha.</td></tr>`;
    document.getElementById("caja-cant").textContent = pagos.length;
    document.getElementById("caja-total").textContent = formatoMoneda(total);

    document.getElementById("caja-pagos").innerHTML = pagos.length
        ? pagos.map((p) => `<tr>
            <td>${new Date(p.fecha_pago).toLocaleTimeString("es-VE", { timeZone: ZONA_HORARIA, hour: "2-digit", minute: "2-digit" })}</td>
            <td>${esc(p.reservaciones?.huespedes?.nombre_completo)}</td>
            <td>${esc(p.reservaciones?.habitaciones?.numero)}</td>
            <td>${esc(p.metodo)}</td><td>${esc(p.referencia) || "—"}</td>
            <td class="text-end">${formatoMoneda(p.monto)}</td></tr>`).join("")
        : `<tr><td colspan="6" class="text-center text-muted py-3">Sin pagos.</td></tr>`;

    document.getElementById("btn-cerrar-caja").disabled = pagos.length === 0;

    const otros = pagosSinCerrar.length - pagos.length;
    document.getElementById("aviso-otros").innerHTML = otros > 0
        ? `<div class="alert alert-warning mb-0"><i class="bi bi-exclamation-triangle"></i> Hay ${otros} pago(s) de otras fechas que aún no tienen cierre de caja. Cambia la fecha para cerrarlos.</div>` : "";
}

function pintarCierres() {
    document.getElementById("tabla-cierres").innerHTML = cierres.length
        ? cierres.map((c) => `<tr>
            <td class="fw-semibold">C-${String(c.id).padStart(4, "0")}</td>
            <td>${formatoFecha(c.fecha)}</td>
            <td>${formatoFechaHora(c.created_at)}</td>
            <td class="text-end">${c.cantidad_pagos}</td>
            <td class="text-end">${formatoMoneda(c.total)}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-id="${c.id}" aria-label="Ver reporte del cierre ${c.id}"><i class="bi bi-file-earmark-text"></i> Ver</button></td></tr>`).join("")
        : `<tr><td colspan="6" class="text-center text-muted py-3">Aún no se han realizado cierres.</td></tr>`;
}

function verReporteCierre(c) {
    const filas = (c.detalle || []).map((d) =>
        `<tr><td>${esc(d.metodo)}</td><td class="text-end">${d.cantidad}</td><td class="text-end">${formatoMoneda(d.total)}</td></tr>`).join("");
    document.getElementById("cierre-cuerpo").innerHTML = `
    <div class="invoice">
        <div class="d-flex justify-content-between flex-wrap gap-2">
            <div><h3><i class="bi bi-building"></i> HotelControl</h3><div class="small" style="color:#66766D">Cierre de caja</div></div>
            <div class="text-end"><div class="fw-bold fs-5">C-${String(c.id).padStart(4, "0")}</div><div class="small">Fecha: ${formatoFecha(c.fecha)}</div><div class="small">Emitido: ${formatoFechaHora(c.created_at)}</div></div>
        </div>
        <hr>
        <table><thead><tr><th>Método de pago</th><th class="text-end">Pagos</th><th class="text-end">Total</th></tr></thead><tbody>${filas}</tbody></table>
        <hr>
        <div class="d-flex justify-content-between align-items-center"><span class="fw-semibold">TOTAL DEL DÍA (${c.cantidad_pagos} pagos)</span><span class="invoice-total">${formatoMoneda(c.total)}</span></div>
    </div>`;
    abrirModal("modalCierre");
}

async function cargarDatos() {
    const [p, c] = await Promise.all([
        supabaseClient.from("pagos").select(`id, metodo, monto, referencia, fecha_pago,
            reservaciones ( huespedes ( nombre_completo ), habitaciones ( numero ) )`)
            .is("cierre_id", null).order("fecha_pago"),
        supabaseClient.from("cierres_caja").select("*").order("id", { ascending: false }),
    ]);
    if (p.error || c.error) return mostrarAlerta("alertas", "Error al cargar la caja: " + (p.error || c.error).message, "danger");
    pagosSinCerrar = p.data;
    cierres = c.data;
    pintarCaja();
    pintarCierres();
}

async function cerrarCaja() {
    const fecha = document.getElementById("caja-fecha").value;
    const pagos = pagosDeFecha(fecha);
    const total = pagos.reduce((s, p) => s + Number(p.monto), 0);
    if (!confirm(`¿Cerrar la caja del ${formatoFecha(fecha)}?\n${pagos.length} pago(s) por ${formatoMoneda(total)}.\nEsta acción no se puede deshacer.`)) return;
    await conBoton(document.getElementById("btn-cerrar-caja"), async () => {
        const { data: id, error } = await supabaseClient.rpc("cerrar_caja", { p_fecha: fecha });
        if (error) return mostrarAlerta("alertas", "No se pudo cerrar la caja: " + error.message, "danger");
        mostrarAlerta("alertas", "Cierre de caja realizado correctamente.", "success");
        await cargarDatos();
        const nuevo = cierres.find((x) => x.id === id);
        if (nuevo) verReporteCierre(nuevo);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await iniciarPagina([ROL_ADMIN], "Cierre de caja");
    if (!sesion) return;
    const f = document.getElementById("caja-fecha");
    f.value = hoyLocal();
    f.addEventListener("change", pintarCaja);
    document.getElementById("btn-cerrar-caja").addEventListener("click", cerrarCaja);
    document.getElementById("tabla-cierres").addEventListener("click", (e) => {
        const b = e.target.closest("button[data-id]");
        const c = b && cierres.find((x) => x.id === Number(b.dataset.id));
        if (c) verReporteCierre(c);
    });
    cargarDatos();
});
