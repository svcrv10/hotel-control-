// dashboard.js - Métricas del panel principal (solo Administrador)
async function cargarMetricas() {
    const [hab, res, pag, hue, esp] = await Promise.all([
        supabaseClient.from("habitaciones").select("estado"),
        supabaseClient.from("reservaciones").select("estado, estado_pago, monto_total"),
        supabaseClient.from("pagos").select("monto, fecha_pago, cierre_id"),
        supabaseClient.from("huespedes").select("id", { count: "exact", head: true }),
        supabaseClient.from("perfiles").select("id", { count: "exact", head: true }).eq("rol", ROL_ESPERA),
    ]);
    const fallo = [hab, res, pag, hue, esp].find((r) => r.error);
    if (fallo) return mostrarAlerta("alertas", "Error al cargar datos: " + fallo.error.message, "danger");

    const total = hab.data.length;
    const cuenta = (e) => hab.data.filter((h) => h.estado === e).length;
    const activas = res.data.filter((r) => r.estado === "Confirmada" || r.estado === "Check-In").length;
    const cobrado = pag.data.reduce((s, p) => s + Number(p.monto), 0);
    const hoy = hoyLocal();
    const cobradoHoy = pag.data.filter((p) => fechaLocalDe(p.fecha_pago) === hoy).reduce((s, p) => s + Number(p.monto), 0);
    const porCobrar = res.data.filter((r) => r.estado !== "Cancelada" && r.estado_pago === "Pendiente")
        .reduce((s, r) => s + Number(r.monto_total), 0);

    const set = (id, v) => { document.getElementById(id).textContent = v; };
    set("m-disponibles", `${cuenta("Disponible")} / ${total}`);
    set("m-ocupadas", cuenta("Ocupada"));
    set("m-reservas-activas", activas);
    set("m-ingresos", formatoMoneda(cobrado));
    set("badge-disponibles", cuenta("Disponible"));
    set("badge-ocupadas", cuenta("Ocupada"));
    set("badge-mantenimiento", cuenta("Mantenimiento"));
    set("badge-huespedes", hue.count ?? 0);
    set("badge-total-habitaciones", total);
    set("m-hoy", formatoMoneda(cobradoHoy));
    set("m-pendiente", formatoMoneda(porCobrar));
    set("badge-sin-cierre", pag.data.filter((p) => p.cierre_id === null).length);
    set("badge-empleados-espera", esp.count ?? 0);
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await iniciarPagina([ROL_ADMIN], "Panel Principal");
    if (sesion) cargarMetricas();
});
