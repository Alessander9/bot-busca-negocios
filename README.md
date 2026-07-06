# 🚀 Prospector Web Local — Buscador de Negocios Inteligente

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%2018%20%2B%20TS%20%2B%20Vite-61dafb?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Backend-Spring%20Boot%203.3%20%28Java%2025%29-6db33f?style=for-the-badge&logo=springboot" alt="Spring Boot" />
  <img src="https://img.shields.io/badge/Scraper-Python%20%2B%20Playwright%20%2B%20Crawlee-3776ab?style=for-the-badge&logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL%20%28JSONB%29-336791?style=for-the-badge&logo=postgresql" alt="Postgres" />
</p>

---

## 📖 Descripción General

**Prospector Web Local** es una herramienta empresarial de prospección geográfica a costo $0. Permite escanear áreas geográficas específicas mediante un algoritmo de **cuadrícula densa** sobre Google Maps para identificar negocios locales, extraer su información de contacto (teléfono, sitio web, redes sociales) y calificarlos según su necesidad de desarrollo web.

---

## ✨ Características Principales

*   🗺️ **Barrido en Cuadrícula Dinámica con Filtro Circular**: Genera coordenadas de búsqueda separadas geográficamente usando la fórmula de *Haversine*, omitiendo puntos de las esquinas fuera del radio para evitar peticiones redundantes.
*   🎯 **Espaciado Quirúrgico & Solapamiento del 15%**: En modo Completa, calcula el espaciado matemático para situar las celdas a **menos de 100 metros** una de otra, asegurando una cobertura total.
*   📡 **GPS Spoofing y Evasión de Bloqueos**: Simula coordenadas geográficas por hardware en el contexto del navegador para anular redirecciones por geolocalización de IP, simulando actividad humana real con retrasos aleatorios (`2s - 6s`).
*   🔍 **Triple/Cuádruple Zoom de Calle (15z - 18z)**: Recorre de forma secuencial múltiples zooms de gran detalle para listar pequeños negocios de barrio omitidos en zooms lejanos.
*   📂 **Búsqueda por Sectores con Aliases**: Integra un diccionario de alias que expande un término comercial (ej. *veterinaria*) en múltiples queries aliadas (*grooming, clínica veterinaria, pet shop*) en modo completo.
*   ✍️ **Búsqueda Libre Normalizada**: Permite buscar términos libres usando un normalizador Unicode que limpia acentos, dobles espacios y traduce singulares a plurales automáticamente para enganchar alias.
*   📊 **Interfaz Map-Céntrica Profesional**: El mapa ocupa el 100% del lienzo. Los controles flotan en un panel colapsable (`◀` / `⚙️`) y los resultados se despliegan en una **Bottom Sheet deslizable** interactiva.
*   💻 **Holographic Progress Modal**: Presenta el progreso de la cuadrícula con un radar giratorio animado, contador digital iluminado y una consola de comandos en tiempo real.

---

## 🛠️ Arquitectura del Sistema

El flujo de procesamiento asíncrono está diseñado para liberar la conexión HTTP al instante y delegar el proceso pesado a hilos secundarios:

```mermaid
graph TD
    A[React Client] -->|1. POST /api/search-googlemaps| B(Spring Boot Controller)
    B -->|2. Register SearchJob PENDING| C[Job Manager]
    B -->|3. Return jobId immediately| A
    C -->|4. Launch Thread / process| D[ProcessBuilder]
    D -->|5. Run Python Scraper| E[Playwright + Crawlee]
    E -->|6. Query Google Maps| F[Google Maps Web]
    E -->|7. Print Progress stdout| D
    D -->|8. Stream updates| C
    A -->|9. Poll progress status| B
    E -->|10. Final JSON Output| D
    D -->|11. Persist Results| G[(PostgreSQL DB)]
    C -->|12. Mark Job DONE| A
```

---

## 📂 Estructura del Proyecto

*   `frontend/`: Código fuente de la interfaz de usuario en React, TypeScript y CSS.
*   `backend/`: Microservicio en Java Spring Boot que administra los Jobs de búsqueda en memoria y persiste los Leads.
*   `scraper/`: Script de automatización en Python que ejecuta el PlaywrightCrawler con Crawlee.

---

## ⚙️ Guía de Instalación y Configuración

### Prerrequisitos
*   **Java 21 o superior** (Java 25 recomendado)
*   **Node.js 18 o superior**
*   **Python 3.10 o superior**
*   **PostgreSQL 14 o superior**

### 1. Base de Datos
Crea una base de datos en PostgreSQL llamada `prospector` e importa la estructura.
Asegúrate de que la URL de conexión en `backend/src/main/resources/application.yml` incluya el parámetro para evitar mismatch de tipos JSONB:
```yaml
url: jdbc:postgresql://localhost:5432/prospector?stringtype=unspecified
```

### 2. Configuración del Scraper (Python)
Entra a la carpeta del scraper, instala las dependencias y Playwright:
```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
```

### 3. Servidor Backend (Spring Boot)
Compila y ejecuta el backend con Maven:
```bash
cd backend
mvn spring-boot:run
```
El servidor levantará en [http://localhost:8080](http://localhost:8080).

### 4. Servidor Frontend (React)
Instala las dependencias y levanta el servidor de desarrollo:
```bash
cd frontend
npm install
npm run dev
```
La aplicación web se abrirá en [http://localhost:3000](http://localhost:3000).

---

## 📝 Licencia

Este proyecto está diseñado para uso comercial privado y prospección interna local. Desarrollado con tecnología de punta a costo cero.
