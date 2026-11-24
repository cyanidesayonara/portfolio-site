---
title: "Separació de pistes en Python sense PyTorch: ONNX Runtime i DirectML"
description: "Com stemma executa HTDemucs, MDX-Net i detecció de pols en local sobre GPUs i CPUs de Windows sense empaquetar PyTorch."
date: 2026-10-14
tags: [python, onnx, directml, audio, dsp]
project: stemma
cover: /img/projects/stemma-takes.png
coverAlt: Mesclador de stemma mostrant pistes d'instruments separades i preses enregistrades
---

L'aprenentatge automàtic per a àudio en Python sol arrencar amb `pip install torch`. En una aplicació d'escriptori això vol dir repartir un runtime gegant i, tot i així, obtenir acceleració GPU només a les targetes compatibles amb aquell entorn concret.

A [stemma](https://github.com/cyanidesayonara/stemma) volia que la separació de pistes funcionés 100 % en local en un PC normal amb Windows, sense obligar ningú a instal·lar Python, kits CUDA ni un paquet enorme de PyTorch. Executar la inferència sobre ONNX Runtime amb DirectML des del principi la va mantenir com una aplicació d'escriptori corrent, amb acceleració GPU on funciona i retorn net a CPU.

## Treure STFT i iSTFT fora del model

Als models convertits que fa servir stemma, les transformades espectrals viuen fora del graf `.onnx`. Tota la preparació de senyal passa en Python amb NumPy de manera predictible:

- **HTDemucs v4 (`src/separator.py`):** executa els models de quatre pistes (`vocals`, `drums`, `bass`, `other`) i sis pistes (afegint-hi `guitar` i `piano`), fent tot el preprocessament i postprocessament STFT/iSTFT en NumPy al voltant del graf ONNX dins d'un `QThread` en segon pla.
- **MDX-Net (`src/mdx_separator.py`):** separa veu i acompanyament (`other`), gestionant l'empaquetament STFT, enfinestrat, retall de context i reconstrucció overlap-add íntegrament en NumPy sense dependre de PyTorch.

Els fitxers de models queden completament fora de l'instal·lador. A la primera importació, `src/model_manager.py` baixa els artefactes ONNX convertits, en comprova els hashes SHA-256 i els publica de manera atòmica al directori de dades de l'aplicació.

## DirectML a la pràctica (`src/onnx_session.py`)

DirectML dona a ONNX Runtime una via GPU independent del fabricant a Windows per a targetes AMD, Intel i NVIDIA, tot i que configurar la sessió demana unes quantes salvaguardes apreses pel camí:

- **Ajornar la importació feixuga.** `onnxruntime` s'importa de manera mandrosa dins `create_onnx_session()` perquè pesa força i només cal quan comença la inferència.
- **Complir els requisits de sessió de DirectML.** Quan `DmlExecutionProvider` és disponible, les sessions fixen `enable_mem_pattern = False` i `execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL`, ordenant proveïdors com `["DmlExecutionProvider", "CPUExecutionProvider"]`.
- **Saber quan saltar-se la GPU.** `create_onnx_session()` pren la bandera `use_gpu`. MDX-Net demana DirectML primer i cau netament a CPU si falla la inicialització, mostrant `"DirectML GPU"` o `"CPU fallback"` a l'estat d'importació. HTDemucs passa `use_gpu=False` i va directe a CPU, perquè les exportacions ONNX actuals de quatre i sis pistes fallen en compilar el graf a DirectML (registrat a l'[issue #125](https://github.com/cyanidesayonara/stemma/issues/125)); estalviar-se aquest intent condemnat evita segons perduts d'arrencada i soroll a la consola.
- **Distingir baixades malmeses de límits del maquinari.** Un retorn genèric amagaria memòries cau corruptes. `is_damaged_model_error()` reconeix errors `InvalidProtobuf`, `NoSuchFile` i `InvalidGraph` (juntament amb fallades de dades externes i lectura protobuf), i quan la sessió CPU en troba un, `create_onnx_session()` llança `ModelDamagedError`. La interfície avisa llavors que s'ha retirat el model i demana tornar a importar la cançó per baixar-lo net, en comptes de tapar la corrupció.

## Netejar filtracions i portar el compàs en NumPy

Quan el model neuronal retorna les formes d'ona brutes per pista, unes poques etapes lleugeres de DSP acaben la feina en NumPy pur i `librosa`:

- **Reducció de sagnat (`src/post_processing.py`):** corre en blocs d'uns ~10 segons per mantenir plana la memòria, calculant màscares suaus de Wiener basades en magnitud entre pistes seguides d'una porta suau RMS que atenua rastres fantasmes durant els compassos en silenci.
- **Polsos, tonalitat i acords (`src/beat_detector.py`):** fa servir inferència per blocs amb el model ONNX `beat_this` per a BPM i temps forts, perfils de Krumhansl-Schmuckler per detectar tonalitat i croma suavitzat amb Viterbi per mostrar acords majors i minors en directe.
- **Velocitat i afinació en temps real (`src/stretch.py`):** canviar el tempo o transposar ±7 semitons mentre practiques passa en directe dins el callback de sortida de `sounddevice` amb un phase vocoder en NumPy (amb identity phase locking perquè la mescla mantingui el nivell) i remostreig amb `soxr`. No cal prerenderitzar res a disc quan abaixes un bucle a 0,75× de velocitat.
