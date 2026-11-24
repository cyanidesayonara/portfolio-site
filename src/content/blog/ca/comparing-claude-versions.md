---
title: "Comparant Claude 3.5 i 3.7: fent una app per compartir despeses"
description: Dues versions de Claude van rebre el mateix encàrrec per a una aplicació de despeses compartides en Flutter i van prendre camins ben diferents.
date: 2025-04-08
tags: [ai, claude, flutter]
cover: /img/posts/ai-comparison.webp
coverAlt: Dos robots que representen Claude 3.5 i 3.7 jugant al Rock 'em Sock 'em Robots, generada per ChatGPT
---

Aquesta entrada documenta com dues versions diferents de Claude van abordar la creació de la mateixa aplicació per compartir despeses en Flutter. El més curiós? Van agafar camins de desenvolupament notablement diferents tot i rebre exactament les mateixes instruccions.

---

## L'enfocament de Claude 3.5

*Segons es va observar en la conversa amb Claude 3.5, així va afrontar el projecte:*

### Nom del projecte i arrencada
- Va fer una pluja d'idees exhaustiva per triar nom
- Va comprovar la disponibilitat a la Play Store de diverses opcions
- Es va decidir per "DivvyUp" amb la convenció pròpia de Flutter (`divvy_up`)
- Es va centrar primer a recollir els requisits inicials

### Arquitectura tècnica
- Va començar pels fitxers bàsics d'autenticació
- Estratègia més gradual i pas a pas
- Fitxers creats: `auth_service.dart`, `auth_provider.dart`, `login_screen.dart`

### Estil d'implementació
- To més conversacional
- Focus a entendre primer els requisits
- Estratègia d'implementació progressiva
- Menys codi d'entrada, més planificació

---

## L'enfocament de Claude 3.7

*A partir de la conversa amb Claude 3.7, així va abordar exactament el mateix projecte:*

### Estructura inicial i arrencada
- Va arrencar directament amb el nom "MoochNoMore" sense gaire discussió prèvia
- Va establir d'immediat una estructura completa de directoris:
  - `models`
  - `screens`
  - `services`
  - `utils`
  - `widgets`
  - `providers`

### Implementació tècnica
- Estructura de carpetes completa des del principi
- Integració immediata amb Firebase
- Implementació completa del sistema de vinculació d'usuaris
- Gestió d'estat avançada amb Provider

### Filosofia de desenvolupament
- Enfocament orientat a l'acció
- Implementació ràpida de funcionalitats
- Forta atenció a la qualitat del codi (correcció proactiva d'avisos de linter)
- Desenvolupament extens de la base de codi des del primer minut

### Abast funcional
- Sistema avançat de vinculació entre usuaris
- Gestió d'estat complexa amb Provider
- Integració completa amb Firebase
- Interfície més elaborada amb pantalla de configuració i navegació

### Pràctiques de qualitat de codi
- Correcció proactiva d'errors de lint
- Convencions de noms acurades
- Bones pràctiques de codi net
- Documentació detallada dels canvis

---

## Anàlisi comparativa

*Vist des de fora, tots dos enfocaments reflecteixen pols oposats en la manera de fer programari:*

### Espectre de desenvolupament
Aquestes dues estratègies representen extrems oposats:
- **Pes en planificació (Claude 3.5)**: prioritza comprendre els requisits i bastir una base sòlida abans de llançar-se al codi
- **Pes en implementació (Claude 3.7)**: se centra a aixecar ràpidament solucions tècniques completes

### Punts forts i punts febles

**Enfocament de Claude 3.5:**
- Avantatge: millor comprensió inicial dels requisits d'usuari
- Avantatge: avanç més metòdic, amb menys refeta potencial
- Avantatge: procés més sòlid per triar el nom del producte
- Inconvenient: progrés inicial més lent
- Inconvenient: solució tècnica menys completa de sortida

**Enfocament de Claude 3.7:**
- Avantatge: lliurament més ràpid de funcionalitats
- Avantatge: implementació tècnica més completa
- Avantatge: millors hàbits de qualitat i lint al codi
- Inconvenient: fase de requisits possiblement precipitada
- Inconvenient: risc de construir peces que després no facin falta

### Implicacions en projectes reals
En entorns professionals de desenvolupament:
- L'estil de Claude 3.5 encaixa amb metodologies **àgils** centrades en iteracions curtes i validació contínua amb l'usuari
- L'estil de Claude 3.7 recorda el desenvolupament **guiat per funcionalitats**, orientat a completar blocs funcionals sencers d'una tirada

### El punt mitjà ideal
La combinació més eficaç reuneix:
1. La recollida acurada de requisits i el focus en l'usuari de Claude 3.5
2. La solvència tècnica i les pràctiques de qualitat de Claude 3.7
3. Un ritme equilibrat que deixi marge tant per planificar com per executar

---

*Nota: aquesta anàlisi parteix de converses parcials i serveix com a comparació il·lustrativa més que com a avaluació definitiva de tots dos sistemes.*
