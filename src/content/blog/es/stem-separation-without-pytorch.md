---
title: "Separación de pistas en Python sin PyTorch: ONNX Runtime y DirectML"
description: "Cómo stemma ejecuta HTDemucs, MDX-Net y detección de pulsos localmente en GPUs y CPUs de Windows sin empaquetar PyTorch."
date: 2026-10-14
tags: [python, onnx, directml, audio, dsp]
project: stemma
cover: /img/projects/stemma-takes.webp
coverAlt: Mezclador de stemma mostrando pistas de instrumentos separadas y tomas grabadas
---

El aprendizaje automático para audio en Python suele arrancar con `pip install torch`. En una aplicación de escritorio eso implica distribuir un runtime enorme y, aun así, lograr aceleración por GPU solo en tarjetas compatibles con ese entorno concreto.

En [stemma](https://github.com/cyanidesayonara/stemma) quería que la separación de pistas funcionase 100 % en local en un PC normal con Windows, sin obligar a nadie a instalar Python, toolkits CUDA ni un paquete gigante de PyTorch. Ejecutar la inferencia sobre ONNX Runtime con DirectML desde el principio la mantuvo como una aplicación de escritorio convencional, con aceleración GPU allí donde funciona y respaldo limpio en CPU.

## Sacar STFT e iSTFT fuera del modelo

En los modelos convertidos que usa stemma, las transformadas espectrales viven fuera del grafo `.onnx`. Toda la preparación de señal ocurre en Python con NumPy de manera predecible:

- **HTDemucs v4 (`src/separator.py`):** ejecuta los modelos de cuatro pistas (`vocals`, `drums`, `bass`, `other`) y seis pistas (añadiendo `guitar` y `piano`), realizando todo el preprocesado y posprocesado STFT/iSTFT en NumPy alrededor del grafo ONNX dentro de un `QThread` en segundo plano.
- **MDX-Net (`src/mdx_separator.py`):** divide voz y acompañamiento (`other`), gestionando el empaquetado STFT, enventanado, recorte de contexto y reconstrucción overlap-add íntegramente en NumPy sin depender de PyTorch.

Los archivos de modelos quedan totalmente fuera del instalador. En la primera importación, `src/model_manager.py` descarga los artefactos ONNX convertidos, verifica sus hashes SHA-256 y los mueve de forma atómica al directorio de datos de la aplicación.

## DirectML en la práctica (`src/onnx_session.py`)

DirectML ofrece a ONNX Runtime una vía GPU independiente del fabricante en Windows para tarjetas AMD, Intel y NVIDIA, aunque configurar la sesión exige varias salvaguardas aprendidas sobre la marcha:

- **Diferir la importación pesada.** `onnxruntime` se importa de forma perezosa dentro de `create_onnx_session()` porque pesa bastante y solo hace falta cuando empieza la inferencia.
- **Cumplir los requisitos de sesión de DirectML.** Cuando `DmlExecutionProvider` está disponible, las sesiones fijan `enable_mem_pattern = False` y `execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL`, ordenando proveedores como `["DmlExecutionProvider", "CPUExecutionProvider"]`.
- **Saber cuándo saltarse la GPU.** `create_onnx_session()` acepta la bandera `use_gpu`. MDX-Net pide DirectML primero y cae limpiamente a CPU si falla la inicialización, mostrando `"DirectML GPU"` o `"CPU fallback"` en el estado de importación. HTDemucs pasa `use_gpu=False` y va directo a CPU, porque las exportaciones ONNX actuales de cuatro y seis pistas fallan al compilar el grafo en DirectML (registrado en el [issue #125](https://github.com/cyanidesayonara/stemma/issues/125)); evitar ese intento condenado ahorra segundos de arranque y ruido en consola.
- **Distinguir descargas dañadas de límites del hardware.** Un respaldo genérico escondería cachés corruptas. `is_damaged_model_error()` reconoce fallos `InvalidProtobuf`, `NoSuchFile` e `InvalidGraph` (junto con errores de datos externos y parseo protobuf), y si la sesión CPU choca con uno, `create_onnx_session()` lanza `ModelDamagedError`. La interfaz avisa entonces de que el modelo se retiró y pide volver a importar la canción para descargarlo limpio, en vez de tapar la corrupción.

## Limpiar filtraciones y llevar el compás en NumPy

Cuando el modelo neuronal devuelve las ondas brutas por pista, unas pocas etapas ligeras de DSP rematan el resultado en NumPy puro y `librosa`:

- **Reducción de sangrado (`src/post_processing.py`):** corre en bloques de unos ~10 segundos para mantener plana la memoria, calculando máscaras suaves de Wiener basadas en magnitud entre pistas seguidas de una puerta suave RMS que atenúa fantasmas residuales durante compases en silencio.
- **Pulsos, tonalidad y acordes (`src/beat_detector.py`):** usa inferencia por bloques del modelo ONNX `beat_this` para BPM y tiempos fuertes, perfiles de Krumhansl-Schmuckler para detectar tonalidad y croma suavizado con Viterbi para mostrar acordes mayores y menores en vivo.
- **Velocidad y afinación en tiempo real (`src/stretch.py`):** cambiar el tempo o transponer ±7 semitonos mientras practicas ocurre en directo dentro del callback de salida de `sounddevice` mediante un phase vocoder en NumPy (con identity phase locking para mantener cuerpo en la mezcla) y remuestreo con `soxr`. No hace falta pre-renderizar nada a disco cuando bajas un bucle al 0,75× de velocidad.
