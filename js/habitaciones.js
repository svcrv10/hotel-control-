// habitaciones.js - Gestión de habitaciones (Administrador y Recepcionista)
function badgeEstado(estado) {
    if (estado === "Disponible") return `<span class="badge bg-success">Disponible</span>`;
    if (estado === "Ocupada") return `<span class="badge bg-danger">Ocupada</span>`;
    return `<span class="badge bg-warning">Mantenimiento</span>`;
}

async function cargarHabitaciones() {
    const tabla = document.getElementById("tabla-habitaciones");
    const { data, error } = await supabaseClient.from("habitaciones").select("*").order("numero");
    if (error) return mostrarAlerta("alertas", "Error al cargar habitaciones: " + error.message, "danger");
    if (!data.length) {
        tabla.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay habitaciones registradas.</td></tr>`;
        return;
    }
    tabla.innerHTML = data.map((h) => `
        <tr>
            <td class="fw-semibold">${esc(h.numero)}</td>
            <td>${esc(h.tipo)}</td>
            <td>${formatoMoneda(h.precio_noche)}</td>
            <td>${badgeEstado(h.estado)}</td>
            <td class="text-end">
                <select class="form-select form-select-sm d-inline w-auto selector-estado" data-id="${h.id}" aria-label="Estado de la habitación ${esc(h.numero)}">
                    ${["Disponible", "Ocupada", "Mantenimiento"].map((o) => `<option ${o === h.estado ? "selected" : ""}>${o}</option>`).join("")}
                </select>
            </td>
        </tr>`).join("");
}

async function crearHabitacion(e) {
    e.preventDefault();
    const numero = document.getElementById("numero").value.trim();
    const tipo = document.getElementById("tipo").value;
    const precio_noche = parseFloat(document.getElementById("precio_noche").value);
    if (!numero || !(precio_noche > 0)) return mostrarAlerta("alertas", "Completa todos los campos con valores válidos.", "danger");
    const { error } = await supabaseClient.from("habitaciones").insert({ numero, tipo, precio_noche, estado: "Disponible" });
    if (error) {
        const dup = error.code === "23505";
        return mostrarAlerta("alertas", dup ? `Ya existe la habitación ${numero}.` : "Error al registrar: " + error.message, "danger");
    }
    mostrarAlerta("alertas", `Habitación ${numero} registrada correctamente.`, "success");
    e.target.reset();
    cerrarModal("modalNuevaHabitacion");
    cargarHabitaciones();
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await iniciarPagina([ROL_ADMIN, ROL_RECEP], "Habitaciones");
    if (!sesion) return;
    cargarHabitaciones();
    document.getElementById("form-nueva-habitacion").addEventListener("submit", crearHabitacion);
    document.getElementById("tabla-habitaciones").addEventListener("change", async (e) => {
        const sel = e.target.closest(".selector-estado");
        if (!sel) return;
        const { error } = await supabaseClient.from("habitaciones").update({ estado: sel.value }).eq("id", sel.dataset.id);
        if (error) return mostrarAlerta("alertas", "Error al actualizar estado: " + error.message, "danger");
        mostrarAlerta("alertas", "Estado de la habitación actualizado.", "success");
        cargarHabitaciones();
    });
});
