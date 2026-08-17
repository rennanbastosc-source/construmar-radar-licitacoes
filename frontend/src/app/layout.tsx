import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Radar de Licitações — CONSTRUMAR',
  description: 'Monitoramento contínuo de oportunidades de licitações públicas em construção civil, obras e engenharia no Ceará (PNCP).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
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
                <strong>CONSTRUMAR</strong> — Radar de Licitações MVP • Fonte oficial: Portal Nacional de Contratações Públicas (PNCP)
              </p>
              <p style={{ marginTop: '4px' }}>
                Critérios ativos: UF=CE • Recebimento de propostas aberto • Valor total estimado &ge; R$ 900.000,00
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
