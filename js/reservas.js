// reservas.js - Reservaciones, cobro con factura, check-in/out (Administrador y Recepcionista)
let reservas = [];
let reservaEnPago = null;

function badgeEstadoReserva(estado) {
    const clases = { "Confirmada": "bg-primary", "Check-In": "bg-success", "Check-Out": "bg-secondary", "Cancelada": "bg-danger" };
    return `<span class="badge ${clases[estado] || "bg-secondary"}">${esc(estado)}</span>`;
}
function badgePago(r) {
    if (r.estado_pago === "Pagada") return `<span class="badge bg-success"><i class="bi bi-check2-circle"></i> Pagada</span>`;
    if (r.estado === "Cancelada") return `<span class="text-muted small">—</span>`;
    return `<span class="badge bg-warning">Pendiente</span>`;
}

function acciones(r) {
    const b = [];
    const btn = (acc, cls, icono, titulo) =>
        `<button class="btn btn-sm ${cls}" data-accion="${acc}" data-id="${r.id}" title="${titulo}" aria-label="${titulo}"><i class="bi ${icono}"></i></button>`;
    if (r.estado !== "Cancelada" && r.estado_pago === "Pendiente") b.push(btn("cobrar", "btn-outline-primary", "bi-credit-card", "Cobrar"));
    if (r.estado_pago === "Pagada") b.push(btn("factura", "btn-outline-primary", "bi-receipt", "Ver factura"));
    if (r.estado === "Confirmada") b.push(btn("checkin", "btn-outline-success", "bi-box-arrow-in-right", "Check-In"));
    if (r.estado === "Check-In") b.push(btn("checkout", "btn-outline-secondary", "bi-box-arrow-left", "Check-Out"));
    if (r.estado === "Confirmada" && r.estado_pago === "Pendiente") b.push(btn("cancelar", "btn-outline-danger", "bi-x-circle", "Cancelar"));
    b.push(btn("historial", "btn-outline-secondary", "bi-clock-history", "Movimientos"));
    return `<div class="d-inline-flex gap-1 flex-wrap justify-content-end">${b.join("")}</div>`;
}

async function cargarReservas() {
    const tabla = document.getElementById("tabla-reservas");
    const { data, error } = await supabaseClient.from("reservaciones").select(`
        id, fecha_entrada, fecha_salida, monto_total, estado, estado_pago, habitacion_id,
        huespedes ( nombre_completo, cedula_pasaporte ), habitaciones ( numero, tipo )`)
        .order("id", { ascending: false });
    if (error) return mostrarAlerta("alertas", "Error al cargar reservaciones: " + error.message, "danger");
    reservas = data;
    if (!data.length) {
        tabla.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No hay reservaciones registradas.</td></tr>`;
        return;
    }
    tabla.innerHTML = data.map((r) => `
        <tr>
            <td><div class="fw-semibold">${esc(r.huespedes?.nombre_completo) || "—"}</div><small class="text-muted">${esc(r.huespedes?.cedula_pasaporte)}</small></td>
            <td>${esc(r.habitaciones?.numero) || "—"} <small class="text-muted">(${esc(r.habitaciones?.tipo)})</small></td>
            <td>${formatoFecha(r.fecha_entrada)}</td>
            <td>${formatoFecha(r.fecha_salida)}</td>
            <td>${formatoMoneda(r.monto_total)}</td>
            <td>${badgeEstadoReserva(r.estado)}</td>
            <td>${badgePago(r)}</td>
            <td class="text-end">${acciones(r)}</td>
        </tr>`).join("");
}

async function cargarOpcionesFormulario() {
    const hoy = hoyLocal();
    document.getElementById("fecha_entrada").min = hoy;
    document.getElementById("fecha_salida").min = hoy;
    const [hu, ha] = await Promise.all([
        supabaseClient.from("huespedes").select("id, nombre_completo, cedula_pasaporte").order("nombre_completo"),
        supabaseClient.from("habitaciones").select("id, numero, tipo, precio_noche").eq("estado", "Disponible").order("numero"),
    ]);
    if (!hu.error) {
        document.getElementById("huesped_id").innerHTML = `<option value="" disabled selected>Seleccione un huésped</option>` +
            hu.data.map((h) => `<option value="${h.id}">${esc(h.nombre_completo)} (${esc(h.cedula_pasaporte)})</option>`).join("");
    }
    if (!ha.error) {
        document.getElementById("habitacion_id").innerHTML = `<option value="" disabled selected>Seleccione una habitación</option>` +
            ha.data.map((h) => `<option value="${h.id}">${esc(h.numero)} - ${esc(h.tipo)} (${formatoMoneda(h.precio_noche)}/noche)</option>`).join("");
    }
}

// ---------- Crear reservación y pasar al pago ----------
async function crearReserva(e) {
    e.preventDefault();
    const huesped_id = document.getElementById("huesped_id").value;
    const habitacion_id = document.getElementById("habitacion_id").value;
    const fecha_entrada = document.getElementById("fecha_entrada").value;
    const fecha_salida = document.getElementById("fecha_salida").value;
    const noches = nochesEntre(fecha_entrada, fecha_salida);
    if (!huesped_id || !habitacion_id) return mostrarAlerta("alertas", "Selecciona un huésped y una habitación.", "danger");
    if (fecha_entrada < hoyLocal()) return mostrarAlerta("alertas", "La fecha de entrada no puede ser anterior a hoy.", "danger");
    if (!(noches > 0)) return mostrarAlerta("alertas", "La fecha de salida debe ser posterior a la de entrada.", "danger");

    await conBoton(e.submitter, async () => {
        const { data: hab, error: eh } = await supabaseClient.from("habitaciones").select("precio_noche, estado").eq("id", habitacion_id).single();
        if (eh || !hab) return mostrarAlerta("alertas", "La habitación seleccionada no existe.", "danger");
        if (hab.estado !== "Disponible") return mostrarAlerta("alertas", "Esa habitación ya no está disponible.", "danger");

        const monto_total = noches * Number(hab.precio_noche);
        const { data: nueva, error } = await supabaseClient.from("reservaciones")
            .insert({ huesped_id, habitacion_id, fecha_entrada, fecha_salida, monto_total, estado: "Confirmada" })
            .select("id").single();
        if (error) return mostrarAlerta("alertas", "Error al crear la reservación: " + error.message, "danger");

        await supabaseClient.from("habitaciones").update({ estado: "Ocupada" }).eq("id", habitacion_id);
        e.target.reset();
        await Promise.all([cargarReservas(), cargarOpcionesFormulario()]);

        // Fin del registro: se abre el pago
        const modalReserva = document.getElementById("modalNuevaReserva");
        modalReserva.addEventListener("hidden.bs.modal", () => {
            const r = reservas.find((x) => x.id === nueva.id);
            if (r) abrirPago(r);
        }, { once: true });
        cerrarModal("modalNuevaReserva");
    });
}

// ---------- Pago ----------
function abrirPago(r) {
    reservaEnPago = r;
    const noches = nochesEntre(r.fecha_entrada, r.fecha_salida);
    document.getElementById("pago-resumen").textContent =
        `${r.huespedes?.nombre_completo} · Hab. ${r.habitaciones?.numero} · ${noches} noche(s) · ${formatoFecha(r.fecha_entrada)} al ${formatoFecha(r.fecha_salida)}`;
    document.getElementById("pago-total").textContent = formatoMoneda(r.monto_total);
    document.getElementById("metodo-0").checked = true;
    document.getElementById("pago-referencia").value = "";
    actualizarReferencia();
    abrirModal("modalPago");
}

function metodoSeleccionado() {
    return document.querySelector('input[name="metodo"]:checked').value;
}
function actualizarReferencia() {
    const m = METODOS_PAGO.find((x) => x.valor === metodoSeleccionado());
    const grupo = document.getElementById("grupo-referencia");
    grupo.hidden = !m.requiereReferencia;
    document.getElementById("pago-referencia").required = m.requiereReferencia;
}

async function procesarPago(e) {
    e.preventDefault();
    if (!reservaEnPago) return;
    const metodo = metodoSeleccionado();
    const def = METODOS_PAGO.find((x) => x.valor === metodo);
    const referencia = document.getElementById("pago-referencia").value.trim();
    if (def.requiereReferencia && !referencia) return mostrarAlerta("alertas", "Ingresa el número de referencia del pago.", "danger");

    await conBoton(e.submitter, async () => {
        const { data: facturaId, error } = await supabaseClient.rpc("procesar_pago", {
            p_reservacion: reservaEnPago.id, p_metodo: metodo, p_referencia: referencia || null,
        });
        if (error) return mostrarAlerta("alertas", "No se pudo procesar el pago: " + error.message, "danger");
        reservaEnPago = null;
        document.getElementById("modalPago").addEventListener("hidden.bs.modal", () => abrirFactura(facturaId), { once: true });
        cerrarModal("modalPago");
        mostrarAlerta("alertas", "Pago registrado y factura generada.", "success");
        cargarReservas();
    });
}

// ---------- Check-in / out / cancelar / historial ----------
async function cambiarEstado(r, estado, liberaHabitacion) {
    const { error } = await supabaseClient.from("reservaciones").update({ estado }).eq("id", r.id);
    if (error) return mostrarAlerta("alertas", `Error al actualizar la reservación: ${error.message}`, "danger");
    if (liberaHabitacion) await supabaseClient.from("habitaciones").update({ estado: "Disponible" }).eq("id", r.habitacion_id);
    mostrarAlerta("alertas", `Reservación actualizada: ${estado}.`, "success");
    await Promise.all([cargarReservas(), cargarOpcionesFormulario()]);
}

async function verHistorial(r) {
    const cuerpo = document.getElementById("historial-cuerpo");
    cuerpo.innerHTML = `<p class="text-muted">Cargando...</p>`;
    abrirModal("modalHistorial");
    const { data, error } = await supabaseClient.from("movimientos_reserva")
        .select("accion, detalle, fecha").eq("reservacion_id", r.id).order("fecha", { ascending: false });
    if (error) { cuerpo.innerHTML = `<p class="text-danger">No se pudo cargar el historial.</p>`; return; }
    cuerpo.innerHTML = data.length
        ? `<ul class="list-group list-group-flush">${data.map((m) => `
            <li class="list-group-item"><div class="d-flex justify-content-between gap-2"><strong>${esc(m.accion)}</strong><small class="text-muted">${formatoFechaHora(m.fecha)}</small></div>
            <div class="small text-muted">${esc(m.detalle)}</div></li>`).join("")}</ul>`
        : `<p class="text-muted">Sin movimientos registrados.</p>`;
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await iniciarPagina([ROL_ADMIN, ROL_RECEP], "Reservaciones");
    if (!sesion) return;
    asegurarModalFactura();
    cargarReservas();
    cargarOpcionesFormulario();
    document.getElementById("form-nueva-reserva").addEventListener("submit", crearReserva);
    document.getElementById("form-pago").addEventListener("submit", procesarPago);
    document.querySelectorAll('input[name="metodo"]').forEach((i) => i.addEventListener("change", actualizarReferencia));

    document.getElementById("tabla-reservas").addEventListener("click", (e) => {
        const b = e.target.closest("[data-accion]");
        if (!b) return;
        const r = reservas.find((x) => x.id === Number(b.dataset.id));
        if (!r) return;
        switch (b.dataset.accion) {
            case "cobrar": abrirPago(r); break;
            case "factura": abrirFacturaDeReserva(r.id); break;
            case "checkin": cambiarEstado(r, "Check-In", false); break;
            case "checkout": cambiarEstado(r, "Check-Out", true); break;
            case "cancelar": if (confirm("¿Cancelar esta reservación?")) cambiarEstado(r, "Cancelada", true); break;
            case "historial": verHistorial(r); break;
        }
    });
});
