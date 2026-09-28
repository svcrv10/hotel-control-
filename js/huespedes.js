// huespedes.js - Gestión y búsqueda de huéspedes (Administrador y Recepcionista)
async function cargarHuespedes() {
    const tabla = document.getElementById("tabla-huespedes");
    const { data, error } = await supabaseClient.from("huespedes").select("*").order("nombre_completo");
    if (error) return mostrarAlerta("alertas", "Error al cargar huéspedes: " + error.message, "danger");
    if (!data.length) {
        tabla.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No hay huéspedes registrados.</td></tr>`;
        return;
    }
    tabla.innerHTML = data.map((h) => `
        <tr>
            <td>${esc(h.cedula_pasaporte)}</td>
            <td class="fw-semibold">${esc(h.nombre_completo)}</td>
            <td>${esc(h.telefono) || "-"}</td>
            <td>${esc(h.email) || "-"}</td>
        </tr>`).join("");
}

async function crearHuesped(e) {
    e.preventDefault();
    const cedula_pasaporte = document.getElementById("cedula_pasaporte").value.trim();
    const nombre_completo = document.getElementById("nombre_completo").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const email = document.getElementById("email_huesped").value.trim();
    if (!cedula_pasaporte || !nombre_completo) {
        return mostrarAlerta("alertas", "La cédula/pasaporte y el nombre son obligatorios.", "danger");
    }
    const { error } = await supabaseClient.from("huespedes")
        .insert({ cedula_pasaporte, nombre_completo, telefono: telefono || null, email: email || null });
    if (error) {
        return mostrarAlerta("alertas", error.code === "23505"
            ? "Ya existe un huésped con esa cédula/pasaporte." : "Error al registrar huésped: " + error.message, "danger");
    }
    mostrarAlerta("alertas", `Huésped ${nombre_completo} registrado correctamente.`, "success");
    e.target.reset();
    cerrarModal("modalNuevoHuesped");
    cargarHuespedes();
}

async function buscarHuesped(e) {
    e.preventDefault();
    const cedula = document.getElementById("busqueda_cedula").value.trim();
    const salida = document.getElementById("resultado-busqueda");
    salida.innerHTML = "";
    if (!cedula) return;
    const { data, error } = await supabaseClient.from("huespedes").select("*").eq("cedula_pasaporte", cedula).maybeSingle();
    if (error) return mostrarAlerta("alertas", "Error en la búsqueda: " + error.message, "danger");
    if (!data) return mostrarAlerta("alertas", "No se encontró ningún huésped con esa cédula/pasaporte.", "warning");
    salida.innerHTML = `<div class="alert alert-info mt-3 mb-0"><strong>${esc(data.nombre_completo)}</strong> — ${esc(data.cedula_pasaporte)}<br>
        Tel: ${esc(data.telefono) || "N/A"} | Email: ${esc(data.email) || "N/A"}</div>`;
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await iniciarPagina([ROL_ADMIN, ROL_RECEP], "Huéspedes");
    if (!sesion) return;
    cargarHuespedes();
    document.getElementById("form-nuevo-huesped").addEventListener("submit", crearHuesped);
    document.getElementById("form-buscar-huesped").addEventListener("submit", buscarHuesped);
});
