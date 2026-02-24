// src/utils/imprimirMatricula.js

export async function imprimirMatricula(alumno, opts = {}) {
  const {
    baseUrl = "",
    anioPago = new Date().getFullYear(),
    periodoLabel = "MATRÍCULA",
  } = opts;

  const safeBase = String(baseUrl || "").replace(/\/+$/, "");
  const idAlumno = alumno?.id_alumno ?? alumno?.id_socio ?? alumno?.id ?? null;

  // 1) obtener monto/categoría desde tu endpoint existente
  let precioMensual = 0;
  let categoriaNombre = "";

  if (idAlumno && safeBase) {
    try {
      const url = `${safeBase}/api.php?action=obtener_monto_categoria&id_alumno=${encodeURIComponent(idAlumno)}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (data?.exito) {
        const monto = Number(
          data?.monto_mensual ??
            data?.monto ??
            data?.precio ??
            data?.Precio_Categoria ??
            0
        );
        precioMensual = Number.isFinite(monto) ? monto : 0;
        categoriaNombre = String(
          data?.categoria_nombre ?? data?.nombre_categoria ?? data?.nombre ?? ""
        ).toUpperCase();
      }
    } catch (e) {
      console.error("imprimirMatricula obtener_monto_categoria error:", e);
    }
  }

  const moneyARS = (m) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(Number(m || 0));

  const periodoTexto = `${periodoLabel} / ${anioPago}`;
  const nombre = alumno?.nombre ?? alumno?.Nombre ?? alumno?.alumno ?? alumno?.apellido_nombre ?? alumno?.ApellidoNombre ?? "";
  const dni =
    alumno?.documento ??
    alumno?.dni ??
    alumno?.num_documento ??
    alumno?.DNI ??
    "";
  const domicilio = alumno?.domicilio ?? alumno?.Domicilio ?? "";
  const division = alumno?.division_nombre ?? alumno?.division ?? alumno?.Division ?? "";
  const categoria = alumno?.categoria_nombre ?? alumno?.nombre_categoria ?? categoriaNombre ?? "";

  const w = window.open("", "_blank");
  if (!w) {
    alert("Habilitá ventanas emergentes para imprimir.");
    return;
  }

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Comprobante Matrícula</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
    }
    .wrap {
      width: 100%;
      padding: 10mm;
    }
    .card {
      border: 1px solid #111;
      border-radius: 12px;
      padding: 18px;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      border-bottom: 1px dashed #999;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: .3px;
      margin: 0;
    }
    .sub {
      margin-top: 6px;
      font-size: 12px;
      color: #333;
    }
    .badge {
      border: 1px solid #111;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 16px;
      margin-top: 10px;
    }
    .field {
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 10px;
    }
    .label {
      font-size: 11px;
      color: #666;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: .5px;
    }
    .value {
      font-size: 14px;
      font-weight: 700;
      color: #111;
      word-break: break-word;
    }
    .total {
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px dashed #999;
      padding-top: 12px;
    }
    .total .lbl {
      font-size: 12px;
      color: #333;
      font-weight: 700;
    }
    .total .amt {
      font-size: 18px;
      font-weight: 900;
    }
    .note {
      margin-top: 10px;
      font-size: 11px;
      color: #444;
    }
    .print-hide {
      margin-top: 12px;
      display: flex;
      gap: 8px;
    }
    .btn {
      border: 1px solid #111;
      background: #111;
      color: #fff;
      padding: 10px 14px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 800;
      font-size: 12px;
    }
    .btn2 {
      border: 1px solid #111;
      background: transparent;
      color: #111;
      padding: 10px 14px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 800;
      font-size: 12px;
    }
    @media print {
      .print-hide { display: none; }
      .wrap { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="head">
        <div>
          <h1 class="title">COMPROBANTE DE MATRÍCULA</h1>
          <div class="sub">Período: <b>${periodoTexto}</b></div>
          <div class="sub">Fecha: <b>${new Date().toLocaleDateString("es-AR")}</b></div>
        </div>
        <div class="badge">${moneyARS(precioMensual || 0)}</div>
      </div>

      <div class="grid">
        <div class="field">
          <div class="label">Alumno</div>
          <div class="value">${escapeHtml(nombre || "—")}</div>
        </div>
        <div class="field">
          <div class="label">DNI</div>
          <div class="value">${escapeHtml(String(dni || "—"))}</div>
        </div>
        <div class="field">
          <div class="label">Domicilio</div>
          <div class="value">${escapeHtml(domicilio || "—")}</div>
        </div>
        <div class="field">
          <div class="label">División</div>
          <div class="value">${escapeHtml(division || "—")}</div>
        </div>
        <div class="field">
          <div class="label">Categoría</div>
          <div class="value">${escapeHtml(String(categoria || categoriaNombre || "—").toUpperCase())}</div>
        </div>
        <div class="field">
          <div class="label">Importe</div>
          <div class="value">${moneyARS(precioMensual || 0)}</div>
        </div>
      </div>

      <div class="total">
        <div class="lbl">TOTAL</div>
        <div class="amt">${moneyARS(precioMensual || 0)}</div>
      </div>

      <div class="note">
        Este comprobante corresponde a la <b>MATRÍCULA</b> del año <b>${anioPago}</b>.
      </div>

      <div class="print-hide">
        <button class="btn" onclick="window.print()">Imprimir</button>
        <button class="btn2" onclick="window.close()">Cerrar</button>
      </div>
    </div>
  </div>

  <script>
    function escapeHtml(str){
      return String(str ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }
    // Auto-print (opcional). Si no lo querés, borrá estas 2 líneas:
    setTimeout(() => { window.print(); }, 250);
  </script>
</body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}