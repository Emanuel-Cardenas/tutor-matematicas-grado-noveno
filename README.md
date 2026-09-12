# Tutor Matematicas

Aplicacion web en Next.js para tutorias, diagnosticos, pruebas de estado, mensajeria y paneles administrativos/teacher.

## Requisitos

- Node.js 20 o superior
- npm
- Git

## Instalar en otro computador

Clonar el repositorio:

```bash
git clone https://github.com/Emanuel-Cardenas/tutor-matematicas.git
cd tutor-matematicas
```

Instalar dependencias:

```bash
npm install
```

Crear el archivo de variables de entorno:

```bash
copy .env.example .env
```

Luego abre `.env` y completa tus valores reales:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET=un-secreto-largo
NEXTAUTH_URL=http://localhost:3000
ADMIN_PASSWORD=tu-password-admin
TEACHER_ACCESS_CODE=tu-codigo-docente
OPENROUTER_API_KEY=tu-api-key
GEMINI_API_KEY=tu-api-key-opcional
```

Crear la base de datos local:

```bash
npx prisma db push
node prisma/seed.js
```

Ejecutar en desarrollo:

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Importante

El repositorio no sube archivos privados o locales:

- `.env`
- `dev.db`
- `prisma/dev.db`
- `node_modules`
- `.next`
- `uploads`
- logs locales

Por eso, al descargarlo en otro computador, el codigo funcionara despues de instalar dependencias y configurar `.env`, pero no tendra automaticamente los usuarios, sesiones, progreso ni archivos subidos que existen en tu computador actual.

Si necesitas que otro computador tenga exactamente los mismos datos locales, copia manualmente desde este equipo:

- `dev.db`
- carpeta `uploads`
- valores reales del archivo `.env`

No publiques esos archivos en GitHub si contienen datos personales, contrasenas o llaves API.

## Comandos utiles

```bash
npm run dev
npm run build
npm run start
npm run lint
```
