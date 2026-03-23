# Feature: Dashboard Layout & Base Styles

## 1. Descripción General
El layout principal de la aplicación Arko. El dashboard usa un diseño inmersivo con una imagen de fondo global (`public/backgrownd.PNG`) que se mantiene fija y cubre toda la pantalla. Sobre este fondo, los componentes como el Sidebar, el Header y las tarjetas de contenido utilizan un estilo "glassmorphism" (cristal oscuro translúcido) para crear profundidad y una sensación premium.

- Tipografía headings: `public/fonts/manrope.bold.otf` (Manrope Bold) para títulos y encabezados.
- Tipografía body: `public/fonts/manrope.light.otf` (Manrope Light) para texto general.
- Implementación técnica: carga con `next/font/local` en `src/app/layout.tsx` y aplicación global en el `<body>`.

## 2. Componentes Principales

### 2.1 Global Background
- Definido en `src/app/globals.css` en el tag `body`.
- `background-image: url('/backgrownd.PNG');`
- Ajustado con `background-size: cover; background-attachment: fixed;`

### 2.2 Glass Panel Utility (`.glass-panel`)
- Una clase de utilidad en `globals.css` que aplica:
  - Fondo negro muy transparente: `bg-black/40`
  - Desenfoque intenso: `backdrop-blur-xl`
  - Borde sutil: `border border-white/10`
  - Sombra difusa: `shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]`

### 2.3 Sidebar (`src/components/layout/Sidebar.tsx`)
- Panel lateral izquierdo fijo o colapsable.
- Utiliza `.glass-panel` para integrarse con el fondo.
- Contiene la navegación principal a los diferentes módulos (Dashboard, Instagram, YouTube, Ads, Customer Voice, Agentes).
- Logo en la parte superior.

### 2.4 Header (`src/components/layout/Header.tsx`)
- Barra superior superior.
- Utiliza `.glass-panel` para la consistencia visual.
- Contiene el perfil del usuario, notificaciones y controles globales.

### 2.5 Page Content (`src/app/page.tsx` base)
- El área principal donde se renderizan las tarjetas de dashboard.
- Utiliza un grid layout para organizar paneles de métricas y gráficos, todos implementados usando `.glass-panel`.

### 2.6 Títulos principales (`.page-title`)
- Clase reutilizable en `src/app/globals.css` para los H1 de módulos.
- Estilo visual: degradado más agresivo blanco → plateado oscuro con `bg-clip-text` y presencia más marcada.
- Jerarquía: tamaño aumentado con `clamp(...)` para verse más grande en desktop y mobile.
- Tipografía: espaciado adicional (`tracking-[0.06em]`) para una lectura más premium.
- Fuente de títulos: `Manrope Bold` (local) para conservar identidad de marca.

### 2.7 Tipografía secundaria
- Texto secundario, descripciones y contenido general usando `Manrope Light` como fuente base global.
- Implementación en `src/app/layout.tsx` con `next/font/local` para carga optimizada.
