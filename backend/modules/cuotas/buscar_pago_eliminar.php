<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

function json_out(array $arr): void {
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

/**
 * IDs fijos según tu tabla meses (captura):
 * 13 = CONTADO ANUAL
 * 15 = 1ER MITAD
 * 16 = 2DA MITAD
 */
const ID_MES_ANUAL     = 13;
const ID_MES_1ER_MITAD = 15;
const ID_MES_2DA_MITAD = 16;

/**
 * Reglas que vos pediste:
 * - 1ER MITAD cubre MARZO(3) a JULIO(7)
 * - 2DA MITAD cubre AGOSTO(8) a DICIEMBRE(12)
 */
function mesPertenece1erMitad(int $idMes): bool {
  return $idMes >= 3 && $idMes <= 7;
}
function mesPertenece2daMitad(int $idMes): bool {
  return $idMes >= 8 && $idMes <= 12;
}

function buscarPagoExacto(PDO $pdo, int $idAlumno, int $anio, int $idMes): ?array {
  $st = $pdo->prepare("
    SELECT p.id_pago, p.id_mes, m.nombre AS mes_nombre, p.estado, p.fecha_pago
    FROM pagos p
    INNER JOIN meses m ON m.id_mes = p.id_mes
    WHERE p.id_alumno = :id_alumno
      AND p.id_mes = :id_mes
      AND YEAR(p.fecha_pago) = :anio
    ORDER BY p.id_pago DESC
    LIMIT 1
  ");
  $st->execute([
    ':id_alumno' => $idAlumno,
    ':id_mes'    => $idMes,
    ':anio'      => $anio,
  ]);
  $row = $st->fetch(PDO::FETCH_ASSOC);
  return $row ?: null;
}

/**
 * Busca pago "contado" por ID (ANUAL / 1ER MITAD / 2DA MITAD)
 * en el año del pago.
 */
function buscarPagoContado(PDO $pdo, int $idAlumno, int $anio, int $idMesContado): ?array {
  $st = $pdo->prepare("
    SELECT p.id_pago, p.id_mes, m.nombre AS mes_nombre, p.estado, p.fecha_pago
    FROM pagos p
    INNER JOIN meses m ON m.id_mes = p.id_mes
    WHERE p.id_alumno = :id_alumno
      AND p.id_mes = :id_mes
      AND YEAR(p.fecha_pago) = :anio
    ORDER BY p.id_pago DESC
    LIMIT 1
  ");
  $st->execute([
    ':id_alumno' => $idAlumno,
    ':id_mes'    => $idMesContado,
    ':anio'      => $anio,
  ]);
  $row = $st->fetch(PDO::FETCH_ASSOC);
  return $row ?: null;
}

try {
  $raw  = file_get_contents('php://input');
  $body = json_decode($raw ?: '{}', true);
  if (!is_array($body)) $body = [];

  $id_alumno = (int)($body['id_alumno'] ?? 0);
  $id_mes    = (int)($body['id_mes'] ?? 0);
  $anio      = (int)($body['anio'] ?? 0);

  if ($id_alumno <= 0 || $id_mes <= 0 || $anio <= 0) {
    json_out([
      'exito' => false,
      'mensaje' => 'Parámetros inválidos (id_alumno, id_mes, anio).',
    ]);
  }

  /* =========================================================
     1) Intentar pago mensual exacto (el mes seleccionado)
  ========================================================= */
  $row1 = buscarPagoExacto($pdo, $id_alumno, $anio, $id_mes);
  if ($row1) {
    json_out([
      'exito' => true,
      'tipo' => 'mensual',
      'id_pago' => (int)$row1['id_pago'],
      'id_mes_real' => (int)$row1['id_mes'],
      'mes_nombre_real' => (string)$row1['mes_nombre'],
      'estado' => (string)$row1['estado'],
      'fecha_pago' => (string)$row1['fecha_pago'],
      'warning' => false,
      'mensaje' => 'Se encontró un pago mensual para el mes seleccionado.',
      'warning_text' => '',
    ]);
  }

  /* =========================================================
     2) Si NO hay mensual, buscar "contado" válido para ese mes
        Orden lógico:
        - Si el mes está cubierto por 1ER MITAD => buscar id_mes=15
        - Si el mes está cubierto por 2DA MITAD => buscar id_mes=16
        - Siempre como fallback final: ANUAL id_mes=13
  ========================================================= */

  $candidato = null;
  $tipo = '';
  $warningText = '';

  // Si el usuario seleccionó directamente 1ER MITAD / 2DA MITAD / ANUAL,
  // primero intentamos borrar ese mismo.
  if ($id_mes === ID_MES_1ER_MITAD || $id_mes === ID_MES_2DA_MITAD || $id_mes === ID_MES_ANUAL) {
    $candidato = buscarPagoContado($pdo, $id_alumno, $anio, $id_mes);
    if ($candidato) {
      if ($id_mes === ID_MES_1ER_MITAD) {
        $tipo = 'contado_1er_mitad';
        $warningText = "⚠️ Este es un pago de 1ER MITAD. Si lo eliminás, eliminás el registro del período.";
      } elseif ($id_mes === ID_MES_2DA_MITAD) {
        $tipo = 'contado_2da_mitad';
        $warningText = "⚠️ Este es un pago de 2DA MITAD. Si lo eliminás, eliminás el registro del período.";
      } else {
        $tipo = 'contado_anual';
        $warningText = "⚠️ Este es un pago CONTADO ANUAL. Si lo eliminás, eliminás el registro de contado.";
      }
    }
  }

  // Si no era un contado directo, detectamos por “mes normal”
  if (!$candidato) {
    if (mesPertenece1erMitad($id_mes)) {
      $candidato = buscarPagoContado($pdo, $id_alumno, $anio, ID_MES_1ER_MITAD);
      if ($candidato) {
        $tipo = 'contado_1er_mitad';
        $warningText = "⚠️ Este mes está cubierto por 1ER MITAD. Si lo eliminás, eliminás el registro del período.";
      }
    } elseif (mesPertenece2daMitad($id_mes)) {
      $candidato = buscarPagoContado($pdo, $id_alumno, $anio, ID_MES_2DA_MITAD);
      if ($candidato) {
        $tipo = 'contado_2da_mitad';
        $warningText = "⚠️ Este mes está cubierto por 2DA MITAD. Si lo eliminás, eliminás el registro del período.";
      }
    }
  }

  // Fallback final: ANUAL (si existe, cubre todo)
  if (!$candidato) {
    $candidato = buscarPagoContado($pdo, $id_alumno, $anio, ID_MES_ANUAL);
    if ($candidato) {
      $tipo = 'contado_anual';
      $warningText = "⚠️ Este mes está cubierto por CONTADO ANUAL. Si lo eliminás, eliminás el registro de contado.";
    }
  }

  if ($candidato) {
    json_out([
      'exito' => true,
      'tipo' => $tipo ?: 'contado',
      'id_pago' => (int)$candidato['id_pago'],
      'id_mes_real' => (int)$candidato['id_mes'],              // 🔥 ESTE ES EL QUE SE DEBE BORRAR
      'mes_nombre_real' => (string)$candidato['mes_nombre'],    // ej: "1ER MITAD"
      'estado' => (string)$candidato['estado'],
      'fecha_pago' => (string)$candidato['fecha_pago'],
      'warning' => true,
      'mensaje' => 'El mes seleccionado no tiene pago mensual, pero existe un pago de período (anual/mitad).',
      'warning_text' => $warningText ?: ("⚠️ Este es un pago de " . (string)$candidato['mes_nombre'] . ". Si lo eliminás, eliminás el registro del período."),
    ]);
  }

  /* =========================================================
     3) Nada encontrado
  ========================================================= */
  json_out([
    'exito' => false,
    'mensaje' => 'No se encontró un pago mensual para ese mes ni un pago de contado/anual/mitad para ese alumno y año.',
  ]);

} catch (Throwable $e) {
  json_out([
    'exito' => false,
    'mensaje' => 'Error buscando pago a eliminar: ' . $e->getMessage(),
  ]);
}