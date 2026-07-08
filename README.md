# PROSPECTOR WEB LOCAL

<p align="center">
  <img src="docs/cover.svg" alt="Portada de Prospector Web Local" width="100%" />
</p>

<p align="center">
  <strong>Inteligencia geoespacial, extracción automática y calificación de leads B2B con IA</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Backend-Spring%20Boot%203.3-6db33f?style=for-the-badge&logo=springboot" alt="Backend" />
  <img src="https://img.shields.io/badge/Frontend-React-61dafb?style=for-the-badge&logo=react" alt="Frontend" />
  <img src="https://img.shields.io/badge/Scraper-Python%20%2B%20Playwright-3776ab?style=for-the-badge&logo=python" alt="Scraper" />
  <img src="https://img.shields.io/badge/DB-PostgreSQL-336791?style=for-the-badge&logo=postgresql" alt="Database" />
</p>

## 📌 Resumen

`Prospector Web Local` es una plataforma para mapear negocios locales, extraer leads desde Google Maps y calificarlos con apoyo de IA.

## ✨ Capacidades principales

- 🗺️ Búsqueda geoespacial por radio o cuadrícula.
- 🤖 Extracción automática de datos desde Google Maps.
- 📊 Scoring de leads para priorizar oportunidades.
- 🧠 Asistencia de IA para enriquecer y clasificar prospectos.
- 🗄️ Persistencia estructurada en PostgreSQL.
- 🖥️ Panel web para seguimiento operativo.

## 🧱 Stack

- `backend`: Spring Boot, servicios de negocio y API REST.
- `frontend`: React, interfaz de búsqueda y visualización.
- `scraper`: Python + Playwright para automatización.
- `database`: PostgreSQL para almacenamiento.
- `docs`: capturas, diagramas y documentación.

## 🏗️ Arquitectura

```mermaid
flowchart LR
  U[Usuario] --> F[Frontend React]
  F --> B[Backend Spring Boot]
  B --> Q[Job Queue / Orquestación]
  Q --> S[Scraper Python + Playwright]
  S --> M[Google Maps]
  S --> D[(PostgreSQL)]
  D --> B
  B --> F
```

## 🔄 Flujo de trabajo

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuario
  participant F as Frontend
  participant B as Backend
  participant S as Scraper
  participant D as PostgreSQL

  U->>F: Define zona, rubro y parámetros
  F->>B: Envía solicitud de búsqueda
  B-->>F: Retorna job id
  B->>S: Ejecuta tarea de scraping
  S->>D: Guarda leads y progreso
  S-->>B: Reporta estado
  B-->>F: Expone avance y resultados
  F-->>U: Muestra leads procesados
```

## 🧭 Componentes del sistema

### Backend

- API principal para crear y consultar búsquedas.
- Orquestación de jobs de scraping.
- Normalización de datos y scoring.

### Frontend

- Panel visual para lanzar búsquedas.
- Vista de resultados y progreso.
- Interacción rápida con el backend.

### Scraper

- Navegación automatizada en Google Maps.
- Extracción de negocio, contacto, ubicación y metadatos.
- Persistencia de resultados por job.

## 🧪 Pipeline de datos

```mermaid
flowchart TD
  A[Inicio de búsqueda] --> B[Validar parámetros]
  B --> C[Crear job]
  C --> D[Generar cuadrícula geoespacial]
  D --> E[Recorrer puntos]
  E --> F[Extraer ficha del negocio]
  F --> G{¿IA activa?}
  G -- Sí --> H[Enriquecer y clasificar]
  G -- No --> I[Usar datos base]
  H --> J[Guardar en PostgreSQL]
  I --> J
  J --> K[Actualizar progreso]
  K --> L[Mostrar resultados en frontend]
```

## 📁 Estructura del repo

- `backend/`: API y servicios.
- `frontend/`: cliente web.
- `scraper/`: automatización.
- `docs/`: capturas y documentación.
- `storage/`: datos temporales y jobs.

## 🧰 Requisitos

- Java JDK 17+
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+

## ⚙️ Configuración

1. Crea un archivo `.env` en la raíz.
2. Agrega la variable:

```env
GEMINI_API_KEY=tu_clave_api_de_gemini
```

3. Configura las credenciales de PostgreSQL en `backend/src/main/resources/application.yml`.

## ▶️ Ejecución

### Backend

```powershell
cd backend
& "C:\Users\Alessander\.m2\maven-3.9.6\bin\mvn.cmd" spring-boot:run
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

## 🧾 Notas operativas

- La portada del repo está incluida en `docs/cover.svg`.
- Los diagramas Mermaid son simples para maximizar compatibilidad con GitHub.
- El README está pensado para que sirva como entrada visual y técnica del proyecto.

