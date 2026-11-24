---
title: "Publicar una aplicació d'escriptori Python a Microsoft Store"
description: "Com passa stemma d'un repositori en Python i PySide6 a un paquet MSIX signat a Microsoft Store, tractant fitxa, captures i enviaments a Partner Center com a codi."
date: 2026-11-06
tags: [python, pyside6, windows, msix, ci]
project: stemma
cover: /img/projects/stemma-practice.webp
coverAlt: Vista de pràctica de stemma amb formes d'ona apilades per pista i controls
---

Un fitxer zip de PyInstaller a GitHub Releases acostuma a ser on s'aturen moltes aplicacions d'escriptori en Python. Això funciona per a desenvolupadors, fins que un usuari corrent de Windows baixa el zip, el descomprimeix i xoca amb un avís de SmartScreen dient-li que l'app ve d'un editor desconegut.

Quan vaig fer [stemma](https://github.com/cyanidesayonara/stemma) —una aplicació de pràctica musical per a Windows amb separació local de pistes per IA en Python i PySide6—, volia que s'instal·lés i s'actualitzés com qualsevol app nativa de Windows. Això volia dir empaquetar-la com a MSIX per a Microsoft Store i automatitzar cada peça del procés de llançament dins el mateix repositori.

## Per què dur una app Python a la Store

Publicar a través de Microsoft Store resol tres maldecaps pràctics per a una utilitat d'escriptori:

- **Una via d'instal·lació fiable.** El zip portàtil no va signat i pot fer saltar un avís de SmartScreen; una instal·lació des de la Store arriba pel mateix canal verificat de Microsoft.
- **Actualitzacions automàtiques i desinstal·lació neta.** El paquet MSIX gestiona la instal·lació, les entrades del menú Inici i les actualitzacions sense instal·ladors propis ni scripts netejant el registre.
- **Mantenir lleuger el paquet.** stemma no encabeix dins l'instal·lador els prop de 450 MB de pesos dels models. Els models d'HTDemucs, MDX-Net i detecció de pols es baixen a la primera importació i es verifiquen contra sumes SHA-256 revisades abans de passar a la memòria cau de l'app.

GitHub Releases continua publicant un `stemma.zip` portàtil al costat de `stemma.msix` per a qui s'estimi més no passar per cap botiga, compilats amb exactament els mateixos binaris.

## De PyInstaller a MSIX

La compilació comença amb un paquet PyInstaller en carpeta (`COLLECT`) definit a `stemma.spec` sobre Python 3.12 a CI. El mode en carpeta s'estalvia l'espera de 3–5 segons d'extracció que afegeix sempre el mode d'un sol fitxer a cada arrencada.

Tenir icones nítides a Windows va demanar cura extra. En comptes d'escalar un PNG mestre cap avall, `scripts/generate_app_icons.py` renderitza dibuixos SVG col·locats píxel a píxel des d'`assets/icons/` a 16, 20, 24, 30, 32 i 36 px al costat d'un recurs gran, i `scripts/build_msix.ps1` indexa cada mida dins `resources.pri` perquè Windows triï la icona exacta a qualsevol escala DPI.

## Una etiqueta, una única versió arreu

Pujar una etiqueta com `v3.0.0` activa `.github/workflows/release.yml`, i el primer pas s'assegura que ningú no s'oblidi d'apujar la versió:

1. `scripts/sync_release_version.ps1` llegeix l'etiqueta i escriu `3.0.0` a `src/version.py` i `3.0.0.0` a `msix/AppxManifest.xml`.
2. La validació del llançament (`scripts/validate_store_release.py` i `scripts/build_store_listing.py --check`) comprova que la fitxa de la Store tingui una entrada de "Novetats" congruent, metadades vàlides i captures que compleixin mínims de mida i quantitat.
3. La bateria ràpida de pytest (`not slow and not hardware`) corre sobre aquest arbre versionat abans que PyInstaller generi `stemma.zip` i `stemma.msix` i els adjunti a una Release de GitHub.

Si falta cap fitxer generat o manca l'apartat de novetats, la compilació d'etiqueta falla de seguida abans de produir artefactes trencats.

## Fitxa i captures tractades com a codi

Treure els textos de Partner Center fora d'un formulari web va significar convertir `store/listing.yaml` en la font única de veritat. Punts clau, descripcions, identitat del producte i notes de versió viuen en YAML; `scripts/build_store_listing.py` regenera `docs/store-listing.md` i `store/product-update.skeleton.json`, i CI falla si se separen.

Les captures es generen igual, mai preses a mà. `scripts/generate_screenshots.py` obre la finestra real de PySide6 en mode offscreen sobre una separació real de 6 pistes del tema CC0 d'HoliznaCC0 *"Makes-Shift Salvation"* i renderitza cinc PNG de 1920×1080 —dues targetes compostes amb titular i tres vistes completes enfocant una funció cadascuna—, així que qualsevol redisseny visual refresca tota la galeria amb una sola ordre.

## Enviament en dos passos a Partner Center (i el parany de les URLs SAS)

L'enviament a la Store passa per un workflow manual `workflow_dispatch` (`.github/workflows/partner-center-submit.yml`) mogut per la CLI `msstore` de Microsoft:

1. **Preparar amb `update_draft`:** baixa `stemma.msix` de la GitHub Release, puja el paquet en esborrany amb `msstore publish --noCommit`, combina els camps de `store/listing.yaml` i prepara captures i mosaic amb `scripts/stage_store_images.py` (marcant les velles com a `PendingDelete` i afegint les actuals com a `PendingUpload`).
2. **Confirmar amb `submit`:** després d'inspeccionar l'artefacte de metadades preparat, una segona execució crida `msstore submission publish`, refusant seguir si no existeix un esborrany `PendingCommit` amb notes coincidents amb l'etiqueta.

Val la pena remarcar dos serrells afilats per a qui automatitzi Partner Center des d'un repositori públic:

- **No premis mai "Envia per a certificació" a la web de Partner Center damunt un esborrany preparat per CLI.** Mentre no es confirmi via `submit`, el panell web marca l'esborrany com "Sense canvis" i fer clic allà enviaria el paquet i els textos *anteriors*.
- **Mantén `FileUploadUrl` fora dels registres públics.** Quan `msstore` prepara un esborrany, el JSON inclou una URL SAS de blob d'Azure amb permís d'escriptura vàlida prop d'un dia. Qualsevol que la llegís en un log públic de GitHub Actions podria sobreescriure el zip pujat abans de confirmar-lo. El workflow no passa mai `--verbose` a `msstore`, desa el JSON en brut només en fitxers temporals i només imprimeix registres filtrats abans per `scripts/redact_submission.py`.
