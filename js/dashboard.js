// ============================================================
// dashboard.js - Métricas del panel principal
// ============================================================

async function cargarMetricas() {
    // Habitaciones por estado
    const { data: habitaciones, error: errHab } = await supabaseClient
        .from("habitaciones")
        .select("estado");

    if (errHab) {
        mostrarAlerta("alertas", "Error al cargar habitaciones: " + errHab.message, "danger");
        return;
    }

    const totalHabitaciones = habitaciones.length;
    const disponibles = habitaciones.filter((h) => h.estado === "Disponible").length;
    const ocupadas = habitaciones.filter((h) => h.estado === "Ocupada").length;
    const mantenimiento = habitaciones.filter((h) => h.estado === "Mantenimiento").length;

    // Reservaciones activas + ingresos totales
    const { data: reservaciones, error: errRes } = await supabaseClient
        .from("reservaciones")
        .select("estado, monto_total");

    if (errRes) {
        mostrarAlerta("alertas", "Error al cargar reservaciones: " + errRes.message, "danger");
        return;
    }

    const reservasActivas = reservaciones.filter((r) => r.estado === "Confirmada" || r.estado === "Check-In").length;
    const ingresosTotales = reservaciones
        .filter((r) => r.estado !== "Cancelada")
        .reduce((suma, r) => suma + Number(r.monto_total), 0);

    // Total de huéspedes
    const { count: totalHuespedes, error: errHu } = await supabaseClient
        .from("huespedes")
        .select("*", { count: "exact", head: true });

    if (errHu) {
        mostrarAlerta("alertas", "Error al cargar huéspedes: " + errHu.message, "danger");
        return;
    }

    document.getElementById("m-disponibles").textContent = `${disponibles} / ${totalHabitaciones}`;
    document.getElementById("m-ocupadas").textContent = ocupadas;
    document.getElementById("m-reservas-activas").textContent = reservasActivas;
    document.getElementById("m-ingresos").textContent = formatoMoneda(ingresosTotales);

    document.getElementById("badge-disponibles").textContent = disponibles;
    document.getElementById("badge-ocupadas").textContent = ocupadas;
    document.getElementById("badge-mantenimiento").textContent = mantenimiento;
    document.getElementById("badge-huespedes").textContent = totalHuespedes ?? 0;
    document.getElementById("badge-total-habitaciones").textContent = totalHabitaciones;
}

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;
    cargarMetricas();
});
