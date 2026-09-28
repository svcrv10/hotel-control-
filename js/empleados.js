// empleados.js - Panel de empleados: asignar roles y eliminar (Administrador)
let empleados = [];
let miId = null;
let empleadoAEliminar = null;

function nombreCompleto(e) {
    return e.nombre ? `${e.nombre} ${e.apellido || ""}`.trim() : e.username;
}

function pintarEmpleados() {
    const q = document.getElementById("buscar-empleado").value.trim().toLowerCase();
    const lista = empleados.filter((e) =>
        [nombreCompleto(e), e.cedula, e.email].some((v) => (v || "").toLowerCase().includes(q)));

    const cuenta = (r) => empleados.filter((e) => e.rol === r).length;
    document.getElementById("e-total").textContent = empleados.length;
    document.getElementById("e-espera").textContent = cuenta(ROL_ESPERA);
    document.getElementById("e-admin").textContent = cuenta(ROL_ADMIN);
    document.getElementById("e-recep").textContent = cuenta(ROL_RECEP);

    const tabla = document.getElementById("tabla-empleados");
    if (!lista.length) {
        tabla.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No hay empleados.</td></tr>`;
        return;
    }
    tabla.innerHTML = lista.map((e) => {
        const yo = e.id === miId;
        const nombre = nombreCompleto(e);
        const selector = yo
            ? `${badgeRol(e.rol)} <small class="text-muted">(tú)</small>`
            : `<select class="form-select form-select-sm selector-rol" data-id="${e.id}" aria-label="Rol de ${esc(nombre)}">
                ${[ROL_ESPERA, ROL_RECEP, ROL_ADMIN].map((r) => `<option ${r === e.rol ? "selected" : ""}>${r}</option>`).join("")}
               </select>`;
        return `
        <tr class="${e.rol === ROL_ESPERA ? "row-pending" : ""}">
            <td><div class="d-flex align-items-center gap-2"><span class="avatar">${esc(iniciales(nombre))}</span>
                <div><div class="fw-semibold">${esc(nombre)}</div><small class="text-muted">${esc(e.email)}</small></div></div></td>
            <td>${esc(e.cedula) || "—"}</td>
            <td>${esc(e.telefono) || "—"}</td>
            <td>${e.fecha_nacimiento ? formatoFecha(e.fecha_nacimiento) : "—"}</td>
            <td style="min-width:170px">${selector}</td>
            <td class="text-end">${yo ? "" : `<button class="btn btn-sm btn-outline-danger" data-eliminar="${e.id}" aria-label="Eliminar a ${esc(nombre)}"><i class="bi bi-trash"></i></button>`}</td>
        </tr>`;
    }).join("");
}

async function cargarEmpleados() {
    const { data, error } = await supabaseClient.from("perfiles")
        .select("id, username, nombre, apellido, cedula, telefono, fecha_nacimiento, email, rol, created_at")
        .order("created_at", { ascending: false });
    if (error) return mostrarAlerta("alertas", "Error al cargar empleados: " + error.message, "danger");
    empleados = data;
    pintarEmpleados();
    actualizarPendientes();
}

async function cambiarRol(id, rol) {
    const emp = empleados.find((e) => e.id === id);
    const { error } = await supabaseClient.from("perfiles").update({ rol }).eq("id", id);
    if (error) {
        mostrarAlerta("alertas", "No se pudo cambiar el rol: " + error.message, "danger");
        return cargarEmpleados();
    }
    mostrarAlerta("alertas", `${nombreCompleto(emp)} ahora es: ${rol}.`, "success");
    cargarEmpleados();
}

async function eliminarEmpleado() {
    if (!empleadoAEliminar) return;
    await conBoton(document.getElementById("btn-confirmar-eliminar"), async () => {
        const { error } = await supabaseClient.rpc("eliminar_empleado", { p_id: empleadoAEliminar.id });
        if (error) return mostrarAlerta("alertas", "No se pudo eliminar: " + error.message, "danger");
        mostrarAlerta("alertas", `${nombreCompleto(empleadoAEliminar)} fue eliminado del sistema y de la base de datos.`, "success");
        empleadoAEliminar = null;
        cerrarModal("modalEliminar");
        cargarEmpleados();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await iniciarPagina([ROL_ADMIN], "Empleados");
    if (!sesion) return;
    miId = sesion.user.id;
    cargarEmpleados();
    document.getElementById("buscar-empleado").addEventListener("input", pintarEmpleados);
    document.getElementById("btn-confirmar-eliminar").addEventListener("click", eliminarEmpleado);
    const tabla = document.getElementById("tabla-empleados");
    tabla.addEventListener("change", (e) => {
        const s = e.target.closest(".selector-rol");
        if (s) cambiarRol(s.dataset.id, s.value);
    });
    tabla.addEventListener("click", (e) => {
        const b = e.target.closest("[data-eliminar]");
        if (!b) return;
        empleadoAEliminar = empleados.find((x) => x.id === b.dataset.eliminar);
        document.getElementById("eliminar-nombre").textContent = nombreCompleto(empleadoAEliminar);
        abrirModal("modalEliminar");
    });
});
