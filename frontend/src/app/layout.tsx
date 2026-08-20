import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { RadarProvider } from '@/context/RadarContext';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Radar de Licitações — CONSTRUMAR',
  description: 'Monitoramento contínuo de oportunidades de licitações públicas em construção civil, obras e engenharia no Ceará (PNCP e TCE-CE).',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-icon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className={plusJakartaSans.className}>
        <RadarProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <main style={{ flex: 1 }}>{children}</main>
          
          <footer
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderTop: '1px solid var(--border-subtle)',
              padding: '1.5rem 0',
              marginTop: '3rem',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            <div className="container">
              <p>
                <strong>CONSTRUMAR</strong> — Radar de Licitações • Fontes: PNCP e TCE-CE (municípios do Ceará)
              </p>
              <p style={{ marginTop: '4px' }}>
                Critérios ativos: UF=CE • Recebimento de propostas aberto • Valor total estimado &ge; R$ 900.000,00
              </p>
            </div>
          </footer>
        </div>
      </RadarProvider>
    </body>
  </html>
  );
}
