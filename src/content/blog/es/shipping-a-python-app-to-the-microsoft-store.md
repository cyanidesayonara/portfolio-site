---
title: "Publicar una aplicación de escritorio Python en Microsoft Store"
description: "Cómo pasa stemma de un repositorio en Python y PySide6 a un paquete MSIX firmado en Microsoft Store, tratando ficha, capturas y envíos a Partner Center como código."
date: 2026-11-06
tags: [python, pyside6, windows, msix, ci]
project: stemma
cover: /img/projects/stemma-practice.png
coverAlt: Vista de práctica de stemma con formas de onda apiladas por pista y controles
---

Un archivo zip generado con PyInstaller en GitHub Releases suele ser el techo para muchas utilidades de escritorio en Python. Para desarrolladores sirve, hasta que un usuario corriente de Windows descarga el zip, lo descomprime y topa con una pantalla de SmartScreen advirtiendo de un editor desconocido.

Cuando construí [stemma](https://github.com/cyanidesayonara/stemma) —una app de práctica musical para Windows con separación local de pistas por IA en Python y PySide6—, quería que se instalase y actualizase como cualquier aplicación nativa de Windows. Eso implicaba empaquetarla como MSIX para Microsoft Store y automatizar todo el flujo de lanzamiento dentro del propio repositorio.

## Por qué llevar una app Python a la Store

Publicar a través de Microsoft Store resuelve tres roces prácticos en una herramienta de escritorio:

- **Ruta de instalación fiable.** El zip portátil no va firmado y puede disparar avisos de SmartScreen; la instalación desde Store llega a través del canal verificado de Microsoft.
- **Actualizaciones automáticas y desinstalación limpia.** El paquete MSIX gestiona instalación, accesos directos del menú Inicio y actualizaciones sin instaladores propios ni scripts limpiando registro.
- **Mantener ligero el paquete.** stemma no mete dentro del instalador sus cerca de 450 MB de pesos de red neuronal. Los modelos de HTDemucs, MDX-Net y detección de pulsos se descargan la primera vez y se validan contra hashes SHA-256 revisados antes de moverlos a la caché de la app.

GitHub Releases sigue publicando un `stemma.zip` portátil junto a `stemma.msix` para quien prefiera evitar tiendas, generado con exactamente los mismos binarios.

## De PyInstaller a MSIX

La compilación arranca con un paquete PyInstaller en carpeta (`COLLECT`) definido en `stemma.spec` sobre Python 3.12 en CI. El modo en carpeta ahorra los 3–5 segundos de descompresión al arrancar que añade siempre el modo de un solo ejecutable.

Conseguir iconos nítidos en Windows llevó mimo extra. En lugar de escalar un PNG maestro hacia abajo, `scripts/generate_app_icons.py` renderiza dibujos SVG colocados píxel a píxel desde `assets/icons/` a 16, 20, 24, 30, 32 y 36 px junto a un recurso grande, y `scripts/build_msix.ps1` indexa cada tamaño dentro de `resources.pri` para que Windows elija el icono exacto a cualquier escala DPI.

## Una etiqueta, una única versión en todo el árbol

Al subir un tag como `v3.0.0` se dispara `.github/workflows/release.yml`, cuyo primer paso evita despistes con los números de versión:

1. `scripts/sync_release_version.ps1` analiza la etiqueta y escribe `3.0.0` en `src/version.py` y `3.0.0.0` en `msix/AppxManifest.xml`.
2. La validación de lanzamiento (`scripts/validate_store_release.py` y `scripts/build_store_listing.py --check`) comprueba que la ficha de Store tenga su nota de "Novedades" correspondiente, metadatos válidos y capturas que cumplan mínimos de tamaño y cantidad.
3. La batería rápida de pytest (`not slow and not hardware`) corre sobre ese árbol ya versionado antes de que PyInstaller genere `stemma.zip` y `stemma.msix` y adjunte ambos a la Release de GitHub.

Si falta cualquier archivo generado o falta la sección de novedades, el flujo de la etiqueta falla de inmediato antes de producir artefactos rotos.

## Ficha y capturas tratadas como código

Sacar los textos de Partner Center fuera de un formulario web pasó por convertir `store/listing.yaml` en la fuente única de verdad. Puntos clave, descripciones, identidad del producto y notas por versión viven en YAML; `scripts/build_store_listing.py` regenera `docs/store-listing.md` y `store/product-update.skeleton.json`, y CI falla si se desincronizan.

Las capturas nacen igual, nunca sacadas a mano. `scripts/generate_screenshots.py` lanza la ventana real de PySide6 en modo offscreen sobre una separación real de 6 pistas del tema CC0 de HoliznaCC0 *"Makes-Shift Salvation"* y renderiza cinco PNG de 1920×1080 —dos tarjetas con titular compuesto y tres vistas completas enfocando una función cada una—, de modo que cada cambio de interfaz regenera la galería entera con un solo comando.

## Envío en dos pasos a Partner Center (y la trampa de las URLs SAS)

La publicación en la Store corre mediante un workflow manual `workflow_dispatch` (`.github/workflows/partner-center-submit.yml`) apoyado en la CLI `msstore` de Microsoft:

1. **Preparar con `update_draft`:** descarga `stemma.msix` desde la GitHub Release, lo sube como borrador con `msstore publish --noCommit`, combina los campos de `store/listing.yaml` y prepara capturas y mosaicos con `scripts/stage_store_images.py` (marcando las anteriores como `PendingDelete` y añadiendo las actuales como `PendingUpload`).
2. **Confirmar con `submit`:** tras inspeccionar el artefacto con el borrador preparado, una segunda ejecución llama a `msstore submission publish`, negándose si no existe un borrador `PendingCommit` cuyas notas coincidan con la etiqueta.

Conviene advertir dos aristas afiladas a cualquiera que automatice Partner Center desde un repositorio público:

- **Nunca pulses "Enviar para certificación" en la web de Partner Center sobre un borrador creado por CLI.** Mientras no se confirme vía `submit`, el panel web muestra el borrador como "Sin cambios" y al enviarlo desde el navegador mandaría el paquete y texto *anteriores*.
- **Mantén `FileUploadUrl` fuera de los logs públicos.** Cuando `msstore` prepara un borrador, el JSON incluye una URL SAS de blob en Azure con permisos de escritura válida cerca de un día. Cualquiera que la leyera en un log público de GitHub Actions podría sobrescribir el zip subido antes de confirmarlo. El workflow jamás pasa `--verbose` a `msstore`, guarda el JSON crudo solo en archivos temporales y filtra cualquier log con `scripts/redact_submission.py` antes de imprimirlo.
