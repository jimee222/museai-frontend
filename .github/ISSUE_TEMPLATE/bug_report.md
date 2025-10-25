name: Reporte de bug
description: Crear un reporte de error
title: "[BUG] Título descriptivo"
labels: ["bug"]
body:
  - type: textarea
    attributes:
      label: Descripción
      description: ¿Qué ocurrió y qué esperabas?
    validations:
      required: true
  - type: textarea
    attributes:
      label: Pasos para reproducir
    validations:
      required: true
  - type: input
    attributes:
      label: Versión/entorno
  - type: textarea
    attributes:
      label: Evidencia
