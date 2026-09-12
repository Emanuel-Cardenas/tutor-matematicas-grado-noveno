import './globals.css';
import 'katex/dist/katex.min.css';
import AuthProvider from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata = {
  title: 'YedaTech — Tutor de Matemáticas con IA',
  description: 'Tutor académico personalizado que usa el método socrático para guiarte en matemáticas. Aprende a tu ritmo con inteligencia artificial.',
  keywords: 'tutor, matemáticas, IA, socrático, aprendizaje personalizado',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://tikzjax.com/v1/fonts.css" />
        <script src="https://tikzjax.com/v1/tikzjax.js" defer></script>
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
