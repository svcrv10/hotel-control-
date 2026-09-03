// ============================================================
// huespedes.js - CRUD y búsqueda de huéspedes
// ============================================================

async function cargarHuespedes() {
    const tabla = document.getElementById("tabla-huespedes");

    const { data, error } = await supabaseClient
        .from("huespedes")
        .select("*")
        .order("nombre_completo");

    if (error) {
        mostrarAlerta("alertas", "Error al cargar huéspedes: " + error.message, "danger");
        return;
    }

    if (!data.length) {
        tabla.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No hay huéspedes registrados.</td></tr>`;
        return;
    }

    tabla.innerHTML = data.map((h) => `
        <tr>
            <td>${h.cedula_pasaporte}</td>
            <td class="fw-semibold">${h.nombre_completo}</td>
            <td>${h.telefono || "-"}</td>
            <td>${h.email || "-"}</td>
        </tr>
    `).join("");
}

async function crearHuesped(event) {
    event.preventDefault();

    const cedula_pasaporte = document.getElementById("cedula_pasaporte").value.trim();
    const nombre_completo = document.getElementById("nombre_completo").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const email = document.getElementById("email_huesped").value.trim();

    if (!cedula_pasaporte || !nombre_completo) {
        mostrarAlerta("alertas", "La cédula/pasaporte y el nombre son obligatorios.", "danger");
        return;
    }

    const { error } = await supabaseClient
        .from("huespedes")
        .insert({
            cedula_pasaporte,
            nombre_completo,
            telefono: telefono || null,
            email: email || null,
        });

    if (error) {
        mostrarAlerta("alertas", "Error al registrar huésped: " + error.message, "danger");
        return;
    }

    mostrarAlerta("alertas", `Huésped ${nombre_completo} registrado correctamente.`, "success");
    document.getElementById("form-nuevo-huesped").reset();
    bootstrap.Modal.getInstance(document.getElementById("modalNuevoHuesped")).hide();
    cargarHuespedes();
}

async function buscarHuesped(event) {
    event.preventDefault();

    const cedula = document.getElementById("busqueda_cedula").value.trim();
    const resultadoDiv = document.getElementById("resultado-busqueda");
    resultadoDiv.innerHTML = "";

    const { data, error } = await supabaseClient
        .from("huespedes")
        .select("*")
        .eq("cedula_pasaporte", cedula)
        .maybeSingle();

    if (error) {
        mostrarAlerta("alertas", "Error en la búsqueda: " + error.message, "danger");
        return;
    }

    if (!data) {
        mostrarAlerta("alertas", "No se encontró ningún huésped con esa cédula/pasaporte.", "warning");
        return;
    }

    resultadoDiv.innerHTML = `
        <div class="alert alert-info mt-3 mb-0">
            <strong>${data.nombre_completo}</strong> — ${data.cedula_pasaporte}<br>
            Tel: ${data.telefono || "N/A"} | Email: ${data.email || "N/A"}
        </div>
    `;
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;

    cargarHuespedes();
    document.getElementById("form-nuevo-huesped").addEventListener("submit", crearHuesped);
    document.getElementById("form-buscar-huesped").addEventListener("submit", buscarHuesped);
});
