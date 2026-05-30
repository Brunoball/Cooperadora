export const emptyCampania = {
  id_campania: "",
  nombre: "",
  activo: 1,
  visible_menu: 1,
  tipo_persona: "comprador",
  pregunta_persona: "Escribí nombre y apellido de quien compra.",
  mensaje_inicio: "Indicá la cantidad que querés pagar.",
  mensaje_aprobado: "Pago aprobado. Te enviamos el comprobante en PDF.",
  fecha_inicio: "",
  fecha_fin: "",
  id_producto_principal: "",
  producto_nombre: "",
  producto_descripcion: "",
  producto_precio: "",
  producto_stock: "",
};

export const emptyProducto = {
  id_producto: "",
  nombre: "",
  descripcion: "",
  precio: "",
  stock: "",
  activo: 1,
};

export const tiposPersona = [
  {
    value: "comprador",
    label: "Pedir nombre del comprador",
    shortLabel: "Comprador por nombre",
    menuLabel: "Nombre del comprador",
    pregunta: "Escribí nombre y apellido de quien compra.",
    mensajeInicio: "Indicá la cantidad que querés comprar.",
    ejemplo: "Entradas, baile escolar, bono o venta libre.",
    resumen: "El bot pide nombre y apellido del comprador, luego cantidad y link de pago.",
  },
  {
    value: "vendedor",
    label: "Pedir DNI del responsable",
    shortLabel: "Responsable por DNI",
    menuLabel: "DNI del responsable",
    pregunta: "Ingresá el DNI del alumno, docente o responsable que va a realizar el pago.",
    mensajeInicio: "Indicá la cantidad de paquetes, números o productos vendidos.",
    ejemplo: "Talitas, rifas o ventas cargadas a un alumno/docente.",
    resumen: "El bot pide DNI, busca al responsable, confirma con Sí/No y luego pide cantidad vendida.",
  },
];

export const estadosOrden = [
  { value: "", label: "Todos" },
  { value: "pendiente", label: "Pendientes" },
  { value: "aprobada", label: "Aprobadas" },
  { value: "fallida", label: "Fallidas" },
  { value: "cancelada", label: "Canceladas" },
  { value: "vencida", label: "Vencidas" },
];

export const money = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
};

export const asBool = (v) => Number(v) === 1 || v === true || v === "1";

export const toInputDate = (v) => {
  if (!v) return "";
  return String(v).slice(0, 10);
};

export const personaConfig = (value) => {
  return tiposPersona.find((t) => t.value === value) || tiposPersona[0];
};

export const personaLabel = (value) => {
  return personaConfig(value).shortLabel;
};

export const personaMenuLabel = (value) => {
  return personaConfig(value).menuLabel;
};

export const defaultPreguntaPersona = (tipo) => personaConfig(tipo).pregunta;

export const defaultMensajeInicio = (tipo) => personaConfig(tipo).mensajeInicio;


export const emptyOrden = {
  id_orden: "",
  id_campania: "",
  id_producto: "",
  producto_nombre: "",
  precio_unitario: "",
  cantidad: 1,
  columna_codigo: "VEN",
  columna_nombre: "Venta",
  items: [],
  persona_tipo: "comprador",
  persona_nombre: "",
  persona_detalle: "",
  comprador_telefono: "",
  estado: "aprobada",
  id_medio_pago: "",
  fecha_venta: "",
  observacion: "",
};

export const origenLabel = (value) => {
  if (value === "manual") return "Manual";
  if (value === "importado") return "Importado";
  return "Bot WhatsApp";
};
