// src/utils/imprimirRecibosExternos.js
import BASE_URL from '../config/config';

/* ================= Helpers ================= */

const NOMBRE_COLEGIO_1 = 'ASOCIACIÓN COOPERADORA';
const NOMBRE_COLEGIO_2 = 'I.P.E.T. N° 50';

const NORMALIZAR = (s = '') => String(s || '').trim();

const nombreMes = (idMes) => {
  const m = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const i = Number(idMes);
  return m[i] || String(idMes || '');
};

const getIdAlumno = (s) => s?.id_alumno ?? s?.id ?? s?.id_socio ?? '';

const getNombreCompleto = (s) => {
  const nombre = NORMALIZAR(s?.nombre);
  const apellido = NORMALIZAR(s?.apellido);
  if (apellido || nombre) return `${apellido.toUpperCase()}${nombre ? ', ' + nombre.toUpperCase() : ''}`;
  const nc = NORMALIZAR(s?.nombre_completo);
  return nc ? nc.toUpperCase() : '';
};

const getDni = (s) => s?.num_documento ?? s?.dni ?? s?.documento ?? s?.numDocumento ?? '';

/* =============== Resolver “Curso” (Año + División) =============== */

function resolverCurso(s, aniosById, divisionesById) {
  const anioId =
    s?.id_año ?? s?.id_anio ?? s?.anio_id ?? s?.id_anio_lectivo ?? s?.id_anioLectivo ?? null;
  const divisionId = s?.id_division ?? s?.division_id ?? null;

  const anioNombreDirecto =
    s?.nombre_año || s?.anio_nombre || s?.nombre_anio || s?.nombre_año_lectivo || '';
  const divisionNombreDirecto =
    s?.nombre_division || s?.division || '';

  const anioNombre = (anioNombreDirecto || aniosById[String(anioId)] || '').toString().trim();
  const divisionNombre = (divisionNombreDirecto || divisionesById[String(divisionId)] || '').toString().trim();

  return [anioNombre, divisionNombre].filter(Boolean).join(' ');
}

/* ================== Plantilla de cupón ================== */

function lineSinEtiqueta(valor, mono = true) {
  return `
    <div class="line nolbl">
      <span class="val ${mono ? 'mono' : ''}">${valor}</span>
    </div>
  `;
}

function lineConEtiqueta(label, valor, mono = true) {
  return `
    <div class="line">
      <span class="lbl">${label}</span>
      <span class="val ${mono ? 'mono' : ''}">${valor}</span>
    </div>
  `;
}

function renderCupon({
  x, y,
  etiqueta = 'Cupón para el alumno',
  nombreCompleto = '',
  dni = '',
  domicilio = '',
  barrio = '',
  curso = '',
  periodoTexto = '',
  importe = 0
}) {
  const importeFmt = Number(importe || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `
    <div class="cupon" style="left:${x}mm; top:${y}mm;">
      <div class="enc-1">${NOMBRE_COLEGIO_1}</div>
      <div class="enc-2">${NOMBRE_COLEGIO_2}</div>
      <div class="enc-rule"></div>

      ${lineSinEtiqueta(dni ? dni : '')}
      ${lineSinEtiqueta(nombreCompleto)}
      ${lineSinEtiqueta(NORMALIZAR(domicilio).toUpperCase())}
      ${lineSinEtiqueta(NORMALIZAR(barrio).toUpperCase() || '')}
      ${lineConEtiqueta('Curso :', NORMALIZAR(curso).toUpperCase())}

      ${lineSinEtiqueta(periodoTexto)}
      ${lineConEtiqueta('Importe:', `$ ${importeFmt}`)}
      ${lineConEtiqueta('Cobrad.:', '—')}

      <div class="nota">(${etiqueta})</div>
    </div>
  `;
}

/* ================= Lógica principal ================= */
export const imprimirRecibosExternos = async (listaSocios, periodoActual = '', ventana, opciones = {}) => {
  // 1) Completar datos
  const alumnos = [];
  for (const item of (listaSocios || [])) {
    const id = getIdAlumno(item);
    if (!id) { alumnos.push(item); continue; }
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=obtener_socio_comprobante&id=${id}`);
      const data = await res.json();
      if (data?.exito && data?.socio) alumnos.push({ ...item, ...data.socio });
      else alumnos.push(item);
    } catch { alumnos.push(item); }
  }

  // 2) Listas
  let categoriasById = {};
  let aniosById = {};
  let divisionesById = {};
  try {
    const r = await fetch(`${BASE_URL}/api.php?action=obtener_listas`);
    const j = await r.json();
    if (j?.exito) {
      const L = j?.listas || {};
      (L.categorias || []).forEach((c) => {
        const id = c.id ?? c.id_categoria ?? c.idCategoria;
        if (id != null) {
          categoriasById[String(id)] = {
            nombre: c.nombre ?? c.nombre_categoria ?? '',
            monto: Number(c.monto ?? c.precio ?? 0)
          };
        }
      });
      (L.anios || L.años || []).forEach((a) => {
        const id = a.id ?? a.id_anio ?? a.id_año;
        if (id != null) aniosById[String(id)] = a.nombre ?? a.nombre_anio ?? a.nombre_año ?? '';
      });
      (L.divisiones || []).forEach((d) => {
        const id = d.id ?? d.id_division;
        if (id != null) divisionesById[String(id)] = d.nombre ?? d.nombre_division ?? '';
      });
    }
  } catch {}

  // 3) Ventana
  const w = ventana || window.open('', '', 'width=900,height=1200');
  if (!w) return;

  // 4) Medidas y estilos
  const A4_W = 210;
  const A4_H = 297;

  const FIRST_LEFT = 4;
  const FIRST_TOP  = 20;

  const FILAS_POR_PAGINA = 4;
  const CUP_W = 71;
  const CUP_H = (A4_H - FIRST_TOP) / FILAS_POR_PAGINA;

  const COLS = [FIRST_LEFT, FIRST_LEFT + CUP_W, FIRST_LEFT + CUP_W * 2];

  const css = `
    @page { size: 210mm 297mm; margin: 0mm; }
    html, body { margin: 0; padding: 0; }
    * { box-sizing: border-box; }
    body { font-family: "Courier New", Courier, monospace; color: #000; }
    .page { position: relative; width: ${A4_W}mm; height: ${A4_H}mm; page-break-after: always; overflow: hidden; }

    .cupon {
      position: absolute;
      width: ${CUP_W}mm;
      height: ${CUP_H}mm;
      padding: 0mm 3mm 1.6mm 3mm;
    }

    .enc-1 { font-weight: 600; font-size: 10pt; text-transform: uppercase; letter-spacing: .2px; margin: 0; }
    .enc-2 { font-weight: 700; font-size: 10pt; margin: 0.6mm 0 0 0; }
    .enc-rule { margin: 0.8mm 0 1.6mm 0; border-bottom: 1px solid #000; }

    .line { display: flex; gap: 2mm; line-height: 1.25; font-size: 10pt; }
    .line .lbl { min-width: 20mm; display: inline-block; }
    .line .val { flex: 1; }
    .mono { font-family: "Courier New", Courier, monospace; }

    .line.nolbl { gap: 0; }
    .line.nolbl .val { flex: none; width: 100%; }

    .nota { margin-top: 2mm; font-size: 9pt; color: #000; }
  `;

  const anio = (opciones?.anioPago && String(opciones.anioPago)) || new Date().getFullYear();
  const mesTextoBase = nombreMes(periodoActual);

  const filasPorPagina = FILAS_POR_PAGINA;
  let cuponesHTML = '';
  let pageHTML = '';
  let fila = 0;

  const pushCupon = (x, y, etiqueta, s, precio, cursoTexto, periodoTexto) => {
    const html = renderCupon({
      x, y,
      etiqueta,
      nombreCompleto: getNombreCompleto(s),
      dni: getDni(s),
      domicilio: s?.domicilio || '',
      barrio: s?.localidad || '',
      curso: cursoTexto || '',
      periodoTexto, // ya viene armado (p. ej. “ENE / FEB / MAR 2025”)
      importe: precio
    });
    pageHTML += html;
  };

  const flushPage = () => {
    if (!pageHTML) return '';
    const out = `<div class="page">${pageHTML}</div>`;
    pageHTML = '';
    fila = 0;
    return out;
  };

  for (let idx = 0; idx < alumnos.length; idx++) {
    const s = alumnos[idx];

    // 🔹 MONTO: priorizar total (multi-mes) > otros
    const idCat = s?.id_categoria ?? null;
    const precioListas = Number(categoriasById[String(idCat)]?.monto ?? 0);
    const candidatos = [
      Number(s?.importe_total),
      Number(s?.precio_total),
      Number(s?.monto_total),
      Number(s?.precio_unitario * (Array.isArray(s?.periodos) ? s.periodos.length : 0)),
      Number(s?.precio_unitario),
      Number(s?.monto_mensual),
      Number(s?.precio_categoria),
      Number(s?.monto),
      Number(s?.importe),
      precioListas
    ].filter(v => Number.isFinite(v) && v > 0);
    const precio = candidatos.length ? candidatos[0] : 0;

    // 🔹 PERÍODO: usar full si llega, si no usar “Mes Año”
    const periodoTexto =
      (s?.periodo_texto && String(s.periodo_texto).trim())
        ? String(s.periodo_texto).trim()
        : `${mesTextoBase} ${anio}`;

    const cursoTexto = resolverCurso(s, aniosById, divisionesById);

    const y = FIRST_TOP + fila * CUP_H;

    let x = COLS[0];
    pushCupon(x, y, 'Cupón para el alumno', s, precio, cursoTexto, periodoTexto);

    x = COLS[1];
    pushCupon(x, y, 'Cupón para la cooperadora', s, precio, cursoTexto, periodoTexto);

    x = COLS[2];
    pushCupon(x, y, 'Cupón para el cobrador', s, precio, cursoTexto, periodoTexto);

    fila += 1;
    if (fila >= filasPorPagina || idx === alumnos.length - 1) {
      cuponesHTML += flushPage();
    }
  }

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Recibos Externos</title>
        <style>${css}</style>
      </head>
      <body>
        ${cuponesHTML}
        <script>
          window.onload = function() {
            try { window.focus(); } catch(e) {}
            window.print();
          };
        </script>
      </body>
    </html>
  `;
  w.document.open();
  w.document.write(html);
  w.document.close();
};
