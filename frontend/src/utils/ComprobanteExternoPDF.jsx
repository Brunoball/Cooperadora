// src/utils/ComprobanteAlumnoPDF.js
import BASE_URL from '../config/config';

/**
 * Genera un PDF con un único comprobante para el alumno.
 * - Sin abrir el panel de impresión (descarga directa).
 * - Usa html2canvas + jsPDF cargados desde CDN (no requiere instalar paquetes).
 * - Completa datos del alumno desde el backend como hace tu impresión actual.
 *
 * @param {Object} alumno  Objeto alumno/socio (puede ser parcial; se enriquece con obtener_socio_comprobante)
 * @param {Object} opts    { anio, periodoId, periodoTexto, importeTotal, precioUnitario }
 */
export async function generarComprobanteAlumnoPDF(alumno, opts = {}) {
  // ==== Helpers locales ====
  const NORMALIZAR = (s = '') => String(s || '').trim();
  const toUpper = (s = '') => NORMALIZAR(s).toUpperCase();

  const nombreMes = (idMes) => {
    const m = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const i = Number(idMes);
    return m[i] || String(idMes || '');
  };

  const getIdAlumno = (s) => s?.id_alumno ?? s?.id ?? s?.id_socio ?? null;
  const getDni = (s) => s?.num_documento ?? s?.dni ?? s?.documento ?? s?.numDocumento ?? '';
  const getNombreCompleto = (s) => {
    const nombre = NORMALIZAR(s?.nombre);
    const apellido = NORMALIZAR(s?.apellido);
    if (apellido || nombre) return `${toUpper(apellido)}${nombre ? ', ' + toUpper(nombre) : ''}`;
    const nc = NORMALIZAR(s?.nombre_completo);
    return toUpper(nc || '');
  };

  // ==== 1) Enriquecer datos del alumno ====
  let alumnoFull = { ...alumno };
  const idAlu = getIdAlumno(alumnoFull);
  if (idAlu) {
    try {
      const r = await fetch(`${BASE_URL}/api.php?action=obtener_socio_comprobante&id=${idAlu}`);
      const j = await r.json();
      if (j?.exito && j?.socio) alumnoFull = { ...alumnoFull, ...j.socio };
    } catch { /* noop */ }
  }

  // ==== 2) Derivar valores finales ====
  const anio = Number(opts?.anio ?? alumno?.anio ?? new Date().getFullYear());
  const periodoId = Number(opts?.periodoId ?? alumno?.id_periodo ?? 0);
  const periodoTexto = NORMALIZAR(opts?.periodoTexto) || `${nombreMes(periodoId)} ${anio}`;

  // Precio
  const precioUnitario = Number(
    opts?.precioUnitario ??
    alumno?.precio_unitario ??
    0
  );
  const importeTotal = Number(
    opts?.importeTotal ??
    alumno?.importe_total ??
    (precioUnitario > 0 ? precioUnitario : 0)
  );

  const nombreCompleto = getNombreCompleto(alumnoFull);
  const dni            = getDni(alumnoFull);
  const domicilio      = NORMALIZAR(alumnoFull?.domicilio);
  const barrio         = NORMALIZAR(alumnoFull?.localidad);
  const curso          = [
    NORMALIZAR(alumnoFull?.anio_nombre ?? alumnoFull?.nombre_año ?? alumnoFull?.nombre_anio ?? ''),
    NORMALIZAR(alumnoFull?.division ?? alumnoFull?.nombre_division ?? '')
  ].filter(Boolean).join(' ');

  // ==== 3) Plantilla HTML (sin badge ni firmas) ====
  const css = `
    @page { size: A4; margin: 18mm 16mm 16mm 16mm; }
    html, body { margin: 0; padding: 0; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, "Segoe UI", sans-serif; color: #000; }
    .sheet {
      width: 210mm; min-height: 297mm; padding: 0;
      display: flex; align-items: flex-start; justify-content: center;
    }
    .comprobante {
      width: 175mm; border: 1px solid #111; border-radius: 6px; padding: 10mm;
    }
    .hdr {
      display:flex; align-items:center; justify-content:space-between; margin-bottom: 6mm;
    }
    .hdr .tit {
      font-weight: 800; font-size: 14pt; letter-spacing: .2px;
    }
    .hdr .sub {
      font-weight: 600; font-size: 12pt;
    }
    .sep { border-bottom: 1px solid #000; margin: 4mm 0 6mm 0; }

    .row { display:flex; gap: 8mm; margin: 2.5mm 0; }
    .col { flex: 1; }
    .lbl { font-size: 10pt; color:#444; display:block; margin-bottom: 1mm; }
    .val { font-size: 12pt; font-weight: 600; }

    .mono { font-family: "Courier New", Courier, monospace; letter-spacing: .2px; }
    .right { text-align:right; }
  `;

  const importeFmt = Number(importeTotal || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  const htmlContent = `
    <div class="sheet">
      <div class="comprobante" id="cmp-alumno">
        <div class="hdr">
          <div>
            <div class="tit">ASOCIACIÓN COOPERADORA</div>
            <div class="sub">I.P.E.T. N° 50</div>
          </div>
          <!-- (badge eliminada) -->
        </div>
        <div class="sep"></div>

        <div class="row">
          <div class="col">
            <span class="lbl">Alumno</span>
            <span class="val mono">${nombreCompleto || '—'}</span>
          </div>
          <div class="col">
            <span class="lbl">DNI</span>
            <span class="val mono">${dni || '—'}</span>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <span class="lbl">Domicilio</span>
            <span class="val mono">${domicilio || '—'}</span>
          </div>
          <div class="col">
            <span class="lbl">Barrio / Localidad</span>
            <span class="val mono">${barrio || '—'}</span>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <span class="lbl">Curso</span>
            <span class="val mono">${curso || '—'}</span>
          </div>
          <div class="col">
            <span class="lbl">Periodo</span>
            <span class="val mono">${periodoTexto || '—'}</span>
          </div>
        </div>

        <div class="row">
          <div class="col right">
            <span class="lbl">Importe</span>
            <span class="val mono">$ ${importeFmt}</span>
          </div>
        </div>

        <!-- Se eliminó el pie con firmas -->
      </div>
    </div>
  `;

  // ==== 4) Contenedor temporal en el DOM ====
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '0';
  wrapper.innerHTML = `
    <style>${css}</style>
    ${htmlContent}
  `;
  document.body.appendChild(wrapper);

  try {
    // ==== 5) Cargar html2canvas y jsPDF desde CDN si hace falta ====
    async function ensureScript(src) {
      return new Promise((resolve, reject) => {
        if ([...document.scripts].some(s => s.src.includes(src))) return resolve();
        const sc = document.createElement('script');
        sc.src = src;
        sc.onload = () => resolve();
        sc.onerror = () => reject(new Error('No se pudo cargar ' + src));
        document.body.appendChild(sc);
      });
    }

    await ensureScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    await ensureScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');

    // @ts-ignore
    const h2c = window.html2canvas;
    // @ts-ignore
    const { jsPDF } = window.jspdf;

    const nodo = wrapper.querySelector('#cmp-alumno');
    const canvas = await h2c(nodo, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');

    // A4 en mm
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const targetW = 175;                 // ancho del bloque del comprobante
    const x = (pageW - targetW) / 2;     // centrar
    const imgW = targetW;
    const imgH = (canvas.height * imgW) / canvas.width;

    // Posición Y aprox. 18 mm desde arriba
    const y = 18;
    pdf.addImage(imgData, 'PNG', x, y, imgW, imgH, undefined, 'FAST');

    const nombreArchivo = `Comprobante - ${nombreCompleto || 'Alumno'}.pdf`;
    pdf.save(nombreArchivo);
  } finally {
    document.body.removeChild(wrapper);
  }
}
