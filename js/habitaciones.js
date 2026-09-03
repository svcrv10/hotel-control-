// ============================================================
// habitaciones.js - CRUD de habitaciones
// ============================================================

function badgeEstado(estado) {
    if (estado === "Disponible") return `<span class="badge bg-success">Disponible</span>`;
    if (estado === "Ocupada") return `<span class="badge bg-danger">Ocupada</span>`;
    return `<span class="badge bg-warning text-dark">Mantenimiento</span>`;
}

function selectorEstado(id, estadoActual) {
    const opciones = ["Disponible", "Ocupada", "Mantenimiento"]
        .map((op) => `<option value="${op}" ${op === estadoActual ? "selected" : ""}>${op}</option>`)
        .join("");
    return `
        <select class="form-select form-select-sm d-inline w-auto selector-estado" data-id="${id}">
            ${opciones}
        </select>
    `;
}

async function cargarHabitaciones() {
    const tabla = document.getElementById("tabla-habitaciones");

    const { data, error } = await supabaseClient
        .from("habitaciones")
        .select("*")
        .order("numero");

    if (error) {
        mostrarAlerta("alertas", "Error al cargar habitaciones: " + error.message, "danger");
        return;
    }

    if (!data.length) {
        tabla.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay habitaciones registradas.</td></tr>`;
        return;
    }

    tabla.innerHTML = data.map((h) => `
        <tr>
            <td class="fw-semibold">${h.numero}</td>
            <td>${h.tipo}</td>
            <td>${formatoMoneda(h.precio_noche)}</td>
            <td>${badgeEstado(h.estado)}</td>
            <td class="text-end">${selectorEstado(h.id, h.estado)}</td>
        </tr>
    `).join("");

    // Listeners para cambiar el estado desde el <select>
    document.querySelectorAll(".selector-estado").forEach((select) => {
        select.addEventListener("change", async (e) => {
            const id = e.target.getAttribute("data-id");
            const nuevoEstado = e.target.value;
            const { error: errUpd } = await supabaseClient
                .from("habitaciones")
                .update({ estado: nuevoEstado })
                .eq("id", id);

            if (errUpd) {
                mostrarAlerta("alertas", "Error al actualizar estado: " + errUpd.message, "danger");
                return;
            }
            mostrarAlerta("alertas", "Estado de la habitación actualizado.", "success");
            cargarHabitaciones();
        });
    });
}

async function crearHabitacion(event) {
    event.preventDefault();

    const numero = document.getElementById("numero").value.trim();
    const tipo = document.getElementById("tipo").value;
    const precio_noche = parseFloat(document.getElementById("precio_noche").value);

    if (!numero || !tipo || isNaN(precio_noche)) {
        mostrarAlerta("alertas", "Todos los campos son obligatorios.", "danger");
        return;
    }

    const { error } = await supabaseClient
        .from("habitaciones")
        .insert({ numero, tipo, precio_noche, estado: "Disponible" });

    if (error) {
        mostrarAlerta("alertas", "Error al registrar la habitación: " + error.message, "danger");
        return;
    }

    mostrarAlerta("alertas", `Habitación ${numero} registrada correctamente.`, "success");
    document.getElementById("form-nueva-habitacion").reset();
    bootstrap.Modal.getInstance(document.getElementById("modalNuevaHabitacion")).hide();
    cargarHabitaciones();
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;

    cargarHabitaciones();
    document.getElementById("form-nueva-habitacion").addEventListener("submit", crearHabitacion);
});
