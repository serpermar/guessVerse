# 🎨 Identidad visual — guessVerse

Documento de referencia de la marca, la paleta y los recursos gráficos del proyecto.

---

## 1. 🏷️ Marca

| Elemento | Decisión |
|---|---|
| **Nombre** | guessVerse |
| **Estilo** | Moderno, tecnológico y divertido |
| **Color principal** | Violeta |
| **Colores secundarios** | Rosa y naranja |
| **Fondo** | Azul noche |
| **Símbolo** | Carta misteriosa con interrogante |
| **Tipografía** | Sans-serif redondeada y moderna (`Nunito`) |

---

## 2. 🎨 Paleta de colores

| Color | Código | Uso |
|---|---|---|
| 🟣 Violeta | `#762BFF` | Color principal |
| 🩷 Rosa | `#F02C9B` | Acentos |
| 🟠 Naranja | `#FF9A35` | Degradados |
| 🌌 Azul noche | `#08091F` | Fondos |
| ⚪ Blanco | `#FFFFFF` | Textos |
| 🌫️ Gris claro | `#B8B8CC` | Textos secundarios |

### 🌈 Degradado corporativo

```css
linear-gradient(100deg, #762BFF 0%, #F02C9B 55%, #FF9A35 100%);
```

---

## 3. 🖼️ Recursos gráficos

| Archivo | Ubicación | Uso |
|---|---|---|
| `guessverse-logo-dark.png` | `frontend/public/` | Logo principal (Open Graph y hero) |
| `favicon.svg` | `frontend/public/` | Favicon vectorial |
| `favicon.ico` | `frontend/public/` | Favicon para navegadores clásicos |
| `icon-192.png` | `frontend/public/` | Icono PWA / Apple Touch Icon |
| `icon-512.png` | `frontend/public/` | Icono PWA de alta resolución |
| `site.webmanifest` | `frontend/public/` | Manifest de la aplicación web |

Los recursos se sirven desde `frontend/public/` y se referencian con rutas absolutas (`/favicon.svg`, `/icon-192.png`, `/guessverse-logo-dark.png`).

---

## 4. 🧩 Implementación

### Tokens de diseño

Definidos en `frontend/src/index.css` como variables CSS y expuestos a Tailwind v4 mediante `@theme inline`:

```css
--brand-violet: #762bff;
--brand-pink: #f02c9b;
--brand-orange: #ff9a35;
--brand-night: #08091f;
--brand-white: #ffffff;
--brand-gray: #b8b8cc;
--brand-gradient: linear-gradient(100deg, #762bff 0%, #f02c9b 55%, #ff9a35 100%);
```

| Token Tailwind | Valor |
|---|---|
| `brand` | `#762BFF` |
| `brand-strong` | `#5A1FD6` |
| `accent` | `#F02C9B` |
| `accent-warm` | `#FF9A35` |
| `night` | `#08091F` |

### Utilidades

- `bg-brand-gradient` — aplica el degradado corporativo como fondo.
- `text-brand-gradient` — aplica el degradado al texto.

### Tema claro/oscuro

- 🌙 **Oscuro:** fondo `#08091F`, superficies `#0E0F2A` / `#161735`, texto blanco y secundario `#B8B8CC`.
- ☀️ **Claro:** fondo `#F8FAFC`, superficies blancas y texto oscuro.
- El modo se gestiona con `useTheme` y se persiste en `localStorage`.

### Metadatos y PWA

- Favicons, Apple Touch Icon y manifest declarados en `frontend/index.html`.
- `theme-color` sincronizado con el tema activo (`#08091F` en oscuro, `#F8FAFC` en claro).
- Open Graph y Twitter Card configurados con el logo del proyecto.

---

## 5. ✅ Buenas prácticas

- Usa los tokens (`bg-brand`, `text-accent`, `bg-surface`…) en lugar de colores hexadecimales sueltos.
- Reserva el degradado corporativo para llamadas a la acción y acentos, no para grandes superficies de texto.
- Mantén el contraste: texto blanco sobre fondos violeta/azul noche y texto oscuro sobre fondos claros.
- No deformes ni recolorees el logo fuera de la paleta definida.
