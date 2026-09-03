// ============================================================
// reservas.js - CRUD de reservaciones + check-in/check-out
// ============================================================

function badgeEstadoReserva(estado) {
    if (estado === "Confirmada") return `<span class="badge bg-primary">Confirmada</span>`;
    if (estado === "Check-In") return `<span class="badge bg-success">Check-In</span>`;
    if (estado === "Check-Out") return `<span class="badge bg-secondary">Check-Out</span>`;
    return `<span class="badge bg-danger">Cancelada</span>`;
}

function accionesReserva(r) {
    if (r.estado === "Confirmada") {
        return `
            <button class="btn btn-sm btn-outline-success btn-checkin" data-id="${r.id}" data-hab="${r.habitacion_id}" title="Check-In">
                <i class="bi bi-box-arrow-in-right"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger btn-cancelar" data-id="${r.id}" data-hab="${r.habitacion_id}" title="Cancelar">
                <i class="bi bi-x-circle"></i>
            </button>
        `;
    }
    if (r.estado === "Check-In") {
        return `
            <button class="btn btn-sm btn-outline-secondary btn-checkout" data-id="${r.id}" data-hab="${r.habitacion_id}" title="Check-Out">
                <i class="bi bi-box-arrow-left"></i>
            </button>
        `;
    }
    return `<span class="text-muted small">—</span>`;
}

// ------------------------------------------------------------
// Cargar tabla de reservaciones (con datos de huésped y habitación)
// ------------------------------------------------------------
async function cargarReservas() {
    const tabla = document.getElementById("tabla-reservas");

    const { data, error } = await supabaseClient
        .from("reservaciones")
        .select(`
            id, fecha_entrada, fecha_salida, monto_total, estado, habitacion_id,
            huespedes ( nombre_completo, cedula_pasaporte ),
            habitaciones ( numero, tipo )
        `)
        .order("fecha_entrada", { ascending: false });

    if (error) {
        mostrarAlerta("alertas", "Error al cargar reservaciones: " + error.message, "danger");
        return;
    }

    if (!data.length) {
        tabla.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No hay reservaciones registradas.</td></tr>`;
        return;
    }

    tabla.innerHTML = data.map((r) => `
        <tr>
            <td>
                <div class="fw-semibold">${r.huespedes?.nombre_completo ?? "—"}</div>
                <small class="text-muted">${r.huespedes?.cedula_pasaporte ?? ""}</small>
            </td>
            <td>${r.habitaciones?.numero ?? "—"} <small class="text-muted">(${r.habitaciones?.tipo ?? ""})</small></td>
            <td>${r.fecha_entrada}</td>
            <td>${r.fecha_salida}</td>
            <td>${formatoMoneda(r.monto_total)}</td>
            <td>${badgeEstadoReserva(r.estado)}</td>
            <td class="text-end">${accionesReserva(r)}</td>
        </tr>
    `).join("");

    document.querySelectorAll(".btn-checkin").forEach((btn) => btn.addEventListener("click", () => hacerCheckIn(btn.dataset.id)));
    document.querySelectorAll(".btn-checkout").forEach((btn) => btn.addEventListener("click", () => hacerCheckOut(btn.dataset.id, btn.dataset.hab)));
    document.querySelectorAll(".btn-cancelar").forEach((btn) => btn.addEventListener("click", () => cancelarReserva(btn.dataset.id, btn.dataset.hab)));
}

// ------------------------------------------------------------
// Llenar los <select> del modal (huéspedes y habitaciones disponibles)
// ------------------------------------------------------------
async function cargarOpcionesFormulario() {
    const selectHuesped = document.getElementById("huesped_id");
    const selectHabitacion = document.getElementById("habitacion_id");
    document.getElementById("fecha_entrada").min = new Date().toISOString().split("T")[0];
    document.getElementById("fecha_salida").min = new Date().toISOString().split("T")[0];

    const { data: huespedes, error: errHu } = await supabaseClient
        .from("huespedes")
        .select("id, nombre_completo, cedula_pasaporte")
        .order("nombre_completo");

    if (!errHu) {
        selectHuesped.innerHTML = `<option value="" disabled selected>Seleccione un huésped</option>` +
            huespedes.map((h) => `<option value="${h.id}">${h.nombre_completo} (${h.cedula_pasaporte})</option>`).join("");
    }

    const { data: habitaciones, error: errHab } = await supabaseClient
        .from("habitaciones")
        .select("id, numero, tipo, precio_noche")
        .eq("estado", "Disponible")
        .order("numero");

    if (!errHab) {
        selectHabitacion.innerHTML = `<option value="" disabled selected>Seleccione una habitación</option>` +
            habitaciones.map((h) => `<option value="${h.id}" data-precio="${h.precio_noche}">${h.numero} - ${h.tipo} (${formatoMoneda(h.precio_noche)}/noche)</option>`).join("");
    }
}

// ------------------------------------------------------------
// Crear reservación
// ------------------------------------------------------------
async function crearReserva(event) {
    event.preventDefault();

    const huesped_id = document.getElementById("huesped_id").value;
    const habitacion_id = document.getElementById("habitacion_id").value;
    const fecha_entrada = document.getElementById("fecha_entrada").value;
    const fecha_salida = document.getElementById("fecha_salida").value;

    const entrada = new Date(fecha_entrada);
    const salida = new Date(fecha_salida);
    const noches = Math.round((salida - entrada) / (1000 * 60 * 60 * 24));

    if (!(noches > 0)) {
        mostrarAlerta("alertas", "La fecha de salida debe ser posterior a la fecha de entrada.", "danger");
        return;
    }

    const { data: habitacion, error: errHab } = await supabaseClient
        .from("habitaciones")
        .select("precio_noche")
        .eq("id", habitacion_id)
        .single();

    if (errHab || !habitacion) {
        mostrarAlerta("alertas", "La habitación seleccionada no existe.", "danger");
        return;
    }

    const monto_total = noches * Number(habitacion.precio_noche);

    const { error: errInsert } = await supabaseClient
        .from("reservaciones")
        .insert({
            huesped_id,
            habitacion_id,
            fecha_entrada,
            fecha_salida,
            monto_total,
            estado: "Confirmada",
        });

    if (errInsert) {
        mostrarAlerta("alertas", "Error al crear la reservación: " + errInsert.message, "danger");
        return;
    }

    // Al confirmar la reserva, la habitación pasa a Ocupada
    await supabaseClient.from("habitaciones").update({ estado: "Ocupada" }).eq("id", habitacion_id);

    mostrarAlerta("alertas", `Reservación creada: ${noches} noche(s), monto total ${formatoMoneda(monto_total)}.`, "success");
    document.getElementById("form-nueva-reserva").reset();
    bootstrap.Modal.getInstance(document.getElementById("modalNuevaReserva")).hide();
    cargarReservas();
    cargarOpcionesFormulario();
}

// ------------------------------------------------------------
// Check-in / Check-out / Cancelar
// ------------------------------------------------------------
async function hacerCheckIn(reservacionId) {
    const { error } = await supabaseClient.from("reservaciones").update({ estado: "Check-In" }).eq("id", reservacionId);
    if (error) {
        mostrarAlerta("alertas", "Error al hacer check-in: " + error.message, "danger");
        return;
    }
    mostrarAlerta("alertas", "Check-In realizado correctamente.", "success");
    cargarReservas();
}

async function hacerCheckOut(reservacionId, habitacionId) {
    const { error } = await supabaseClient.from("reservaciones").update({ estado: "Check-Out" }).eq("id", reservacionId);
    if (error) {
        mostrarAlerta("alertas", "Error al hacer check-out: " + error.message, "danger");
        return;
    }
    await supabaseClient.from("habitaciones").update({ estado: "Disponible" }).eq("id", habitacionId);
    mostrarAlerta("alertas", "Check-Out realizado. Habitación liberada.", "success");
    cargarReservas();
    cargarOpcionesFormulario();
}

async function cancelarReserva(reservacionId, habitacionId) {
    const { error } = await supabaseClient.from("reservaciones").update({ estado: "Cancelada" }).eq("id", reservacionId);
    if (error) {
        mostrarAlerta("alertas", "Error al cancelar la reservación: " + error.message, "danger");
        return;
    }
    await supabaseClient.from("habitaciones").update({ estado: "Disponible" }).eq("id", habitacionId);
    mostrarAlerta("alertas", "Reservación cancelada.", "info");
    cargarReservas();
    cargarOpcionesFormulario();
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;

    cargarReservas();
    cargarOpcionesFormulario();
    document.getElementById("form-nueva-reserva").addEventListener("submit", crearReserva);
});
