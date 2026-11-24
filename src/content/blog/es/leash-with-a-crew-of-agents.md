---
title: "Cuatro meses, 42 paseos: construyendo Path of Leash Resistance con un equipo de agentes"
description: Cómo un solo desarrollador lanzó un juego de Godot a web, itch.io y Microsoft Store redactando encargos en lugar de código y revisando todo lo que volvía.
date: 2026-11-15
tags: [godot, ai, agents, workflow]
cover: /img/projects/leash-street.jpg
coverAlt: Un perro tira de su humano distraído con el móvil cruzando un carril bici en Barcelona
---

El 10 de julio de 2026 hice el primer commit de un prototipo cenital con tres cosas dentro: una correa, un humano pegado al móvil y unas bicis. Cuatro meses después, en la versión v1.75, Path of Leash Resistance sumaba 42 paseos, ocho persecuciones, cuatro estatuas jefe y cinco perros, y estaba publicado en web, itch.io y Microsoft Store. El repositorio superaba los 2.000 commits y las 600 pull requests fusionadas.

No tecleé la mayor parte de ese código. Escribí encargos, lancé agentes en paralelo y revisé cada cosa que devolvían. Este artículo cuenta cómo funciona eso en la práctica y qué tuve que aprender para que saliera bien.

## La fase de prototipo: un agente, ciclo corto

Al principio parecía la experiencia habitual programando con IA. Un agente, una conversación, tareas cortas: hacer que rodear un poste sea una restricción real de la correa, frenar al humano cuando la correa se tensa, añadir la terraza de un café. Las físicas pedían ajuste manual constante, así que se quedó en un bucle cerrado de pedir, jugar y corregir.

La mayor sorpresa fue lo rápido que un agente inventa estado paralelo cuando una física no encaja del todo. Pasamos por tres generaciones distintas de contadores de pivotes y ángulos para registrar las vueltas alrededor de las farolas. Cada capa parecía limpísima sobre el papel y en juego real se desincronizaba al instante de la cuerda dibujada. Aquello solo terminó cuando fijamos una regla dura en `entities/leash.gd`: la cuerda Verlet visible *es* la restricción —colisiones segmento contra círculo, fricción por adherencia y la ruta `visible_path()` dibujada leen exactamente los mismos puntos del solver, sin estado fantasma detrás.

Las sensaciones de juego también se resistían a delegarse. Saber en teoría que el humano pesa cuatro veces más que el perro, que la tensión cede entre un ratio de estiramiento de 1,00–1,05, que plantarse multiplica la resistencia por 14× o que cada tirón del humano avisa con un bocadillo 0,8 segundos antes no te dice si un tirón resulta justo o pastoso. Un agente sabe cablear esas constantes y escribir sus pruebas; dar con los números que se sienten bien sigue exigiendo coger el mando y jugar.

## Dejarlo escrito: AGENTS.md y PROJECT.md

El punto de inflexión fue tratar la documentación del repositorio como la interfaz real de trabajo. `PROJECT.md` guarda los pilares de diseño y la hoja de ruta. `AGENTS.md` contiene todo lo que un agente necesita antes de tocar código: el stack, las convenciones, el tono del juego y las reglas que no se negocian. Todo el arte son vectores dibujados por código. Toda la música es sintetizada. Los textos para el jugador dicen "tu humano", nunca "el dueño".

Cada vez que un agente metía la pata en algo, la solución entraba en esos documentos igual que en el código para que el siguiente agente no volviera a caer.

## En paralelo: encargos, tandas y worktrees

Una vez fijadas las normas por escrito, pude repartir el trabajo por tandas. Una tanda es un documento de prompts: un preámbulo común con las reglas de la casa, un encargo base para ese tipo de trabajo (por ejemplo, construir un paseo nuevo) y después un prompt concreto por tarea. Cada agente recibe su propio git worktree y rama, de modo que varios paseos se construyen lado a lado. Suelo lanzar como mucho dos paseos a la vez, porque cada uno sigue tocando un puñado de listas compartidas.

Los encargos arrastran lecciones de las tandas anteriores. La última tanda arranca listando errores previos: una prueba que daba por hecho que su paseo era el último de la lista, o postes a los que les crecía cabeza de farola sin pedirlo. Esos fallos no regresan.

Trabajar en paralelo tiene un único enemigo real: que todo el mundo edite la misma lista central. La salida fue estructural. Cada paseo vive en su propio módulo y declara sus propios hooks, cada prueba nueva va en su archivo propio y el changelog se monta reuniendo un fragmento por cada pull request.

## La puerta de revisión

Nada de esto funciona sin un filtro del que nada se escape. Cada pull request trae una ficha de sensaciones y un fragmento de changelog, y todo paseo nuevo tiene que enseñar:

- sus propias pruebas y toda la suite en verde, además de una ejecución headless de humo;
- una partida guionizada de principio a fin que registra si alguien queda encallado en un muro;
- capturas del recorrido completo, con cielo despejado y con su propio clima;
- una "ficha de sensaciones": entre tres y cinco detalles para probar a mano, que juego personalmente;
- un fragmento de changelog validado por script.

Cuando aterrizan varias ramas al día, la trampa real no es la sintaxis rota: es acumular cambios visibles más rápido de lo que puedes jugarlos. Para evitar que la calidad derive, el repositorio impone un límite duro de WIP de **ocho** cambios orientados al jugador fusionados en la columna "Pendiente de aceptación". Fusionar una PR no equivale a aceptarla; al llegar a ocho en cola solo pueden entrar arreglos de bugs, tests, herramientas o refactorizaciones hasta que juego las fichas pendientes y doy el visto bueno.

Comprobaciones automáticas cazan desviaciones estructurales antes incluso de abrir una build. Cualquier refactor de `main.gd` debe mantener idéntico byte a byte `tools/behaviour_snapshot.sh`. `tools/bench_leash.gd` y `tools/bench_leash_draw.gd` vigilan presupuestos de microsegundos del solver y hashes geométricos. `tools/surface_check.py` superpone el mapa físico de superficies sobre capturas para cazar aceras dibujadas como césped o arena tratada como agua, y `tools/shot_diff.py` compara barridos deterministas píxel a píxel. Eso me deja el tiempo de revisión libre para leer transiciones delicadas línea a línea y jugar de verdad las fichas de sensaciones.

## Qué le diría a quien empieza ahora

- **El cuello de botella pasa de escribir código a decidir y revisar.** Generar código es rapidísimo; saber si un cambio mejora el juego, y acotar el trabajo sin probar con un límite claro de WIP, es lo que protege de verdad el producto.
- **Escribe la regla en cuanto te repitas dos veces.** Toda corrección que se queda en un chat desaparece en la siguiente ventana de contexto. Ponla en `AGENTS.md` o en el preámbulo común y quedará aplicada a todas las ramas futuras.
- **Organiza la base de código para no chocar en paralelo.** Registros centrales, manifiestos únicos de pruebas y changelogs en cabecera convierten las ramas paralelas en conflictos continuos. Hooks modulares, pruebas en archivos sueltos bajo `tests/ci.d/` y fragmentos en `changelog.d/` dejan que tareas independientes aterricen limpias.
- **Reserva el tacto final en manos humanas.** Deja que los agentes implementen el solver de físicas, los benchmarks deterministas y las capturas automáticas, mientras mantienes las constantes de tacto y las fichas de juego de tu lado del bucle.
