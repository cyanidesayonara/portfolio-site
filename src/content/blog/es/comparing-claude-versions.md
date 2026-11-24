---
title: "Comparando Claude 3.5 y 3.7: creando una app para compartir gastos"
description: Dos versiones de Claude recibieron el mismo encargo para una aplicación de gastos compartidos en Flutter y tomaron caminos muy distintos.
date: 2025-04-08
tags: [ai, claude, flutter]
cover: /img/posts/ai-comparison.png
coverAlt: Dos robots que representan a Claude 3.5 y 3.7 jugando al Rock 'em Sock 'em Robots, generada por ChatGPT
---

Esta entrada documenta cómo dos versiones distintas de Claude abordaron la creación de la misma aplicación para compartir gastos en Flutter. ¿Lo más llamativo? Tomaron caminos de desarrollo notablemente distintos a pesar de recibir exactamente las mismas instrucciones.

---

## El enfoque de Claude 3.5

*Según se observó en la conversación con Claude 3.5, así afrontó el proyecto:*

### Nombre del proyecto y arranque
- Llevó a cabo una lluvia de ideas exhaustiva para elegir nombre
- Comprobó la disponibilidad en Play Store de varias opciones
- Se decidió por "DivvyUp" con la convención adecuada de Flutter (`divvy_up`)
- Se centró primero en recopilar los requisitos iniciales

### Arquitectura técnica
- Empezó por los archivos básicos de autenticación
- Estrategia más gradual y paso a paso
- Archivos creados: `auth_service.dart`, `auth_provider.dart`, `login_screen.dart`

### Estilo de implementación
- Tono más conversacional
- Foco en entender primero los requisitos
- Estrategia de implementación progresiva
- Menos código de entrada, más planificación

---

## El enfoque de Claude 3.7

*A partir de la conversación con Claude 3.7, así abordó exactamente el mismo proyecto:*

### Estructura inicial y arranque
- Arrancó directamente con el nombre "MoochNoMore" sin gran debate previo
- Estableció de inmediato una estructura completa de directorios:
  - `models`
  - `screens`
  - `services`
  - `utils`
  - `widgets`
  - `providers`

### Implementación técnica
- Estructura de carpetas completa desde el principio
- Integración inmediata con Firebase
- Implementación completa del sistema de emparejamiento de usuarios
- Gestión de estado avanzada con Provider

### Filosofía de desarrollo
- Enfoque orientado a la acción
- Implementación rápida de funcionalidades
- Fuerte atención a la calidad del código (corrección proactiva de advertencias de linter)
- Desarrollo extenso de la base de código desde el minuto uno

### Alcance funcional
- Sistema avanzado de vinculación entre usuarios
- Gestión de estado compleja con Provider
- Integración completa con Firebase
- Interfaz más elaborada con pantalla de ajustes y navegación

### Prácticas de calidad de código
- Corrección proactiva de errores de lint
- Convenciones de nombres cuidadas
- Buenas prácticas de código limpio
- Documentación detallada de los cambios

---

## Análisis comparativo

*Visto desde fuera, ambos enfoques reflejan polos opuestos en la forma de construir software:*

### Espectro de desarrollo
Estas dos estrategias representan extremos opuestos:
- **Peso en planificación (Claude 3.5)**: prioriza comprender los requisitos y asentar una base sólida antes de lanzarse al código
- **Peso en implementación (Claude 3.7)**: se centra en levantar rápidamente soluciones técnicas completas

### Puntos fuertes y débiles

**Enfoque de Claude 3.5:**
- Ventaja: mejor comprensión inicial de los requisitos de usuario
- Ventaja: avance más metódico, con menos retrabajo potencial
- Ventaja: proceso más sólido para elegir nombre de producto
- Inconveniente: progreso inicial más lento
- Inconveniente: solución técnica menos completa de salida

**Enfoque de Claude 3.7:**
- Ventaja: entrega más rápida de funcionalidades
- Ventaja: implementación técnica más completa
- Ventaja: mejores hábitos de calidad y lint en el código
- Inconveniente: fase de requisitos posiblemente apresurada
- Inconveniente: riesgo de construir piezas que luego no hagan falta

### Implicaciones en proyectos reales
En entornos profesionales de desarrollo:
- El estilo de Claude 3.5 encaja con metodologías **ágiles** centradas en iteraciones cortas y validación continua con el usuario
- El estilo de Claude 3.7 recuerda al desarrollo **guiado por funcionalidades**, orientado a completar bloques funcionales enteros de una vez

### El punto medio ideal
La combinación más eficaz reúne:
1. La recogida cuidadosa de requisitos y el foco en el usuario de Claude 3.5
2. La solvencia técnica y las prácticas de calidad de Claude 3.7
3. Un ritmo equilibrado que deje margen tanto para planificar como para ejecutar

---

*Nota: este análisis se basa en conversaciones parciales y sirve como comparación ilustrativa más que como evaluación definitiva de ambos sistemas.*
