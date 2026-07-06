# 🏢 PROSPECTOR WEB LOCAL
### Sistema Empresarial de Inteligencia Geoespacial y Captación de Clientes B2B

<p align="center">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-1.2.0%20(Enterprise)-7c3aed?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Entorno-Spring%20Boot%203.3-6db33f?style=for-the-badge&logo=springboot" alt="Spring" />
  <img src="https://img.shields.io/badge/Automatizaci%C3%B3n-Python%20Crawlee%20Playwright-3776ab?style=for-the-badge&logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/Motor%20DB-PostgreSQL%2016-336791?style=for-the-badge&logo=postgresql" alt="Postgres" />
</p>

---

## 📌 PROPÓSITO CORPORATIVO
El **Prospector Web Local** es una plataforma de **Inteligencia Comercial y Geolocalización** a costo operativo $0. Está diseñada para agencias de desarrollo web, consultoras de marketing y equipos de venta B2B que necesitan mapear mercados urbanos, extraer leads locales altamente cualificados de Google Maps y priorizarlos dinámicamente según su nivel de madurez digital.

---

## 🧭 ARQUITECTURA DE INTEGRACIÓN
El sistema opera bajo un modelo de arquitectura de desacoplamiento de procesos. El núcleo del servidor delega las tareas pesadas de navegación a subprocesos del sistema operativo, garantizando una respuesta asíncrona inmediata en el cliente:

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Cliente (React UI)
    participant API as Backend (Spring Boot)
    participant JobMgr as Job Manager (Thread Pool)
    participant Scraper as Scraper Engine (Python)
    participant Maps as Google Maps Web
    database DB as Persistencia (PostgreSQL)

    Cliente->>API: POST /api/search-googlemaps (Coordenadas + Categoría)
    API->>JobMgr: Registrar Job (PENDING)
    API-->>Cliente: Retorna Job ID de inmediato
    JobMgr->>Scraper: Invoca subproceso (ProcessBuilder con GPS spoofing)
    activate Scraper
    Scraper->>Maps: Carga viewport locked a zoom (15z - 18z)
    loop Barrido de Cuadrícula
        Maps-->>Scraper: Extrae detalles de establecimientos
        Scraper-->>JobMgr: Envía progreso parcial (stdout pipeline)
        JobMgr-->>Cliente: Actualización de consola (Polling)
    end
    Scraper->>DB: Persiste Leads e inserta JSONB estructurado
    deactivate Scraper
    JobMgr->>API: Marca Job como DONE
    Cliente->>API: GET /api/leads (Muestra Leads en el mapa)
```

---

## 🛠️ COMPONENTES CLAVE Y LÓGICA CORE

### 1. El Generador Geoespacial (Fórmula de Haversine)
El sistema divide el radio de búsqueda seleccionado por el usuario en una cuadrícula de celdas equidistantes. El espaciado de las celdas se calcula automáticamente según el modo:
*   **Modo Básico**: Densidad holgada.
*   **Modo Completo**: Espaciado ajustado matemáticamente a **menos de 100 metros** por celda (solapamiento del 15% a zoom 18z) para asegurar que Google Maps no oculte los locales comerciales pequeños debido a la escala visual.
*   **Filtro Circular**: Se descartan todos los puntos de la cuadrícula que excedan la distancia euclidiana del radio comercial establecido para evitar llamadas duplicadas innecesarias.

### 2. Bypass de Bloqueos y Spoofing de Ubicación (GPS Virtual)
Para evadir las restricciones de Google Maps y las redirecciones por dirección IP del datacenter o del ISP:
*   **Geolocalización en Playwright**: Inyectamos las coordenadas exactas de la celda actual en el contexto del navegador (`page.context.set_geolocation`) y le otorgamos explícitamente permisos de GPS a `https://www.google.com`.
*   **Control del Viewport**: Forzamos un lienzo de visualización Full HD (`1920x1080`) para asegurar la carga masiva de elementos laterales del feed de Google Maps.
*   **Cierre de Auto-Pan**: Detectamos la presencia del botón flotante `"Buscar en esta área"` y lo pulsamos automáticamente si Google intenta desplazar el mapa fuera de las coordenadas de prospección.

---

## 🗂️ CATÁLOGO OPERATIVO DE 21 RUBROS (LIMA)

El scraper cuenta con un normalizador Unicode de alta fidelidad que limpia acentos, minúsculas, tildes y mapea singulares/sinónimos hacia sus claves plurales primarias. En el modo **Completa**, cada rubro ejecuta en bucle los siguientes aliases secuenciales:

1.  **Restaurantes (`restaurantes`)**: cevichería, pollería, chifa, pizzería, hamburguesería, sanguchería, cafetería, restobar, comida rápida.
2.  **Belleza y Estética (`belleza`)**: barbería, peluquería, salón de belleza, spa, manicure, pedicure, centro de estética.
3.  **Salud y Clínicas (`salud`)**: clínica, centro médico, policlínico, consultorio dental, clínica dental, dentista, ortodoncia.
4.  **Veterinarias (`veterinarias`)**: veterinaria, clínica veterinaria, pet shop, grooming, baño para mascotas.
5.  **Talleres de Autos (`talleres`)**: taller mecánico, lubricentro, llantería, planchado y pintura, car wash, detailing automotriz.
6.  **Ferretería y Mantenimiento (`ferreterias`)**: ferretería, constructora, gasfitero, electricista, pintor, drywall, melamina.
7.  **Educación (`educacion`)**: colegio, inicial, nido, instituto, academia preuniversitaria, clases particulares.
8.  **Moda y Ropa (`moda`)**: tienda de ropa, boutique, zapatillas, carteras, joyería, sastrería, uniformes.
9.  **Tecnología (`tecnologia`)**: reparación de laptops, reparación de celulares, cámaras de seguridad, soporte técnico, diseño web.
10. **Servicios Profesionales (`servicios`)**: abogado, estudio jurídico, notaría, contador, estudio contable, inmobiliaria.
11. **Hospedajes y Alquileres (`hospedaje`)**: alquiler de departamentos, hostal, hotel, Airbnb, mudanzas.
12. **Eventos y Fiestas (`eventos`)**: local de eventos, organización de eventos, catering, show infantil, payaso.
13. **Deportes (`deporte`)**: gimnasio, crossfit, yoga, pilates, cancha de grass sintético, academia deportiva.
14. **Hogar y Decoración (`hogar`)**: carpintería, closets a medida, pintura de interiores, control de plagas, limpieza de casas.
15. **Comercio Local (`retail`)**: bodega, minimarket, tienda de abarrotes, licorería, tienda naturista.
16. **Logística y Transporte (`transporte`)**: courier, mensajería, mudanza de carga, alquiler de vans, encomiendas.
17. **Industria B2B (`industria`)**: metalmecánica, imprenta, serigrafía, packaging, distribuidora mayorista.
18. **Seguridad (`seguridad`)**: vigilancia privada, alarmas, cercos eléctricos, control de accesos.
19. **Finanzas y Negocios (`finanzas`)**: casa de cambio, cooperativa de ahorro, préstamos, gestoría municipal.
20. **Turismo y Ocio (`turismo`)**: agencia de viajes, tour operador, discoteca, bar, karaoke.
21. **Asociaciones (`comunidad`)**: iglesia, parroquia, templo, ONG, club social, centro comunitario.

---

## 📈 PIPELINE DE CALIFICACIÓN (LEAD SCORING BLUEPRINT)

El microservicio `LeadScoringService` del backend calcula en caliente un puntaje del lead de `0` a `100` basado en indicadores de digitalización del negocio y tracción local en Google Maps:

```
           [¿TIENE SITIO WEB PROPIO?]
                  /          \
              No (40 pts)    Sí (0 pts)
                 /              \
    [REVIEWS COUNT]             [BUSINESS DATA STACK]
     /      |      \               * Name Present (+15 pts)
   >150   30-150   >1500           * Phone Present (+20 pts)
   (Hot)  (Warm)  (Chain)          * Address Present (+10 pts)
  +20pts  +10pts  -25pts           * Rating < 3.8 (+10 pts)
```

*   **Lead Calificado (Score >= 70)**: Negocios muy populares localmente con alto volumen de visitas (reseñas activas) pero sin presencia digital propia. Representan la mayor tasa de conversión.
*   **Sin Página Web (Score 40 - 69)**: Negocios pequeños o medianos con información básica configurada. Candidatos idóneos para landing pages básicas de digitalización.
*   **Baja Prioridad (Score < 40)**: Negocios sin canales de contacto o corporativos identificados automáticamente por el sistema como grandes cadenas (Bembos, bancos, etc.) que no adquieren servicios locales.

---

## 🚀 INSTRUCCIONES DE DESPLIEGUE CORPORATIVO

### Prerrequisitos de Infraestructura
*   **Entorno Java**: JDK 21 o superior instalado y configurado en el PATH del sistema.
*   **Gestor Node**: Node.js v18+ y npm configurados.
*   **Intérprete Python**: Versión 3.10+ con pip.
*   **Motor RDBMS**: Instancia activa de PostgreSQL 14+.

### Paso 1: Configuración de Base de Datos
Crea una base de datos PostgreSQL llamada `prospector`. Edita el archivo `backend/src/main/resources/application.yml` y configura las credenciales corporativas:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/prospector?stringtype=unspecified
    username: tu_usuario
    password: tu_contraseña
```
> [!IMPORTANT]
> El parámetro `?stringtype=unspecified` es crítico para permitir la conversión fluida de campos en formato JSONB desde Hibernate.

### Paso 2: Instalación de Dependencias del Scraper
Navega a la carpeta del scraper, instala las librerías requeridas e inicializa los binarios del motor del navegador Playwright:
```powershell
cd scraper
pip install -r requirements.txt
playwright install chromium
```

### Paso 3: Inicialización del Servidor Backend (API Rest)
Compila la solución del backend de Spring Boot utilizando la herramienta Maven empaquetada:
```powershell
cd backend
C:\Users\Alessander\.m2\maven-3.9.6\bin\mvn.cmd spring-boot:run
```
El servidor backend iniciará y expondrá su documentación y servicios en [http://localhost:8080](http://localhost:8080).

### Paso 4: Despliegue del Servidor de Desarrollo Frontend (React)
Accede al directorio del cliente frontend, instala las dependencias de Node.js y arranca el entorno de desarrollo con Vite:
```powershell
cd frontend
npm install
npm run dev
```
La interfaz de usuario cargará dinámicamente y estará operativa en [http://localhost:3000](http://localhost:3000).

---

## 📝 SEGURIDAD Y LICENCIA
*   **Cumplimiento de Términos**: Este software realiza la simulación de navegación del usuario en el navegador web local del operador y no requiere claves de API comerciales externas (costo API de Google Maps $0).
*   **Licencia**: Código clasificado para uso comercial interno y prospección corporativa privada. Todos los derechos reservados.
