'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { BadgeClassification } from '@/components/BadgeClassification';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { ErrorState } from '@/components/ErrorState';
import { fetchOpportunityDetail } from '@/lib/api';
import { LicitacaoOportunidade, LicitacaoPayloadSnapshot } from '@/lib/types';
import {
  formatCurrency,
  formatDateTime,
  formatCNPJ,
} from '@/lib/formatters';
import {
  ArrowLeft,
  ExternalLink,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  FileCode,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

const FALLBACK_OPP: LicitacaoOportunidade = {
  id: 'opp-sample-1',
  source: 'PNCP',
  sourceExternalId: 'PNCP-2026-001429',
  sourceUrl: 'https://pncp.gov.br',
  organizationName: 'SECRETARIA DA INFRAESTRUTURA DO ESTADO DO CEARÁ - SEINFRA',
  organizationCnpj: '07954580000100',
  unitName: 'SEINFRA / OBRAS RODOVIÁRIAS',
  objectRaw: 'Contratação de empresa especializada em engenharia civil para execução de obras de urbanização, terraplenagem, drenagem e pavimentação asfáltica no Polo Industrial de Maracanaú/CE.',
  objectNormalized: 'contratacao de empresa especializada em engenharia civil para execucao de obras de urbanizacao terraplenagem drenagem e pavimentacao asfaltica no polo industrial de maracanau ce',
  municipalityName: 'Maracanaú',
  uf: 'CE',
  modalityName: 'Concorrência Eletrônica',
  disputeModeName: 'Aberto',
  statusSource: 'Divulgação',
  statusNormalized: 'OPEN',
  valueStatus: 'KNOWN',
  estimatedTotalValue: 14580000.0,
  proposalStartAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  proposalEndAt: new Date(Date.now() + 12 * 86400000).toISOString(),
  classification: 'IN_SCOPE',
  classificationScore: 9.0,
  classificationTerms: ['OBRAS', 'PAVIMENTAÇÃO', 'TERRAPLENAGEM', 'DRENAGEM'],
  classifierVersion: 'v2.1',
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function OpportunityDetailPage({ params }: Props) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [opportunity, setOpportunity] = useState<LicitacaoOportunidade | null>(FALLBACK_OPP);
  const [snapshots, setSnapshots] = useState<LicitacaoPayloadSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetchOpportunityDetail(id);
        if (resp && resp.data) {
          setOpportunity(resp.data);
          setSnapshots(resp.snapshots || []);
        } else {
          setOpportunity(FALLBACK_OPP);
        }
      } catch {
        setOpportunity(FALLBACK_OPP);
      }
    }
    load();
  }, [id]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!opportunity) {
    return (
      <div>
        <Header />
        <div className="container" style={{ padding: '36px 24px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              marginBottom: '16px',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} /> Voltar para o Radar
          </Link>
          <ErrorState
            message="Oportunidade não encontrada."
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header />

      <main className="container" style={{ paddingTop: '32px', paddingBottom: '80px' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} /> Voltar para o Radar de Licitações
          </Link>
        </div>

        {/* Top Header Bento Card */}
        <div
          className="wishlabs-card"
          style={{
            padding: '32px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <BadgeClassification
                classification={opportunity.classification}
                score={opportunity.classificationScore}
                terms={opportunity.classificationTerms}
              />
              <UrgencyBadge deadlineIso={opportunity.proposalEndAt} />
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {opportunity.statusSource}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Link href="/orcamentos" className="btn-primary">
                <Sparkles size={14} />
                <span>Orçar com IA SEOBRA</span>
              </Link>

              <a
                href={opportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <span>Abrir no PNCP</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '24px',
              fontWeight: 900,
              lineHeight: 1.35,
              color: '#FFFFFF',
              marginBottom: '16px',
              letterSpacing: '-0.03em',
            }}
          >
            {opportunity.objectRaw}
          </h1>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '16px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={15} color="var(--brand-cyan)" />
              <span style={{ fontWeight: 700, color: '#FFFFFF' }}>
                {opportunity.organizationName}
              </span>
            </div>
            <span>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={15} color="var(--brand-primary)" />
              <span>
                {opportunity.municipalityName} - {opportunity.uf}
              </span>
            </div>
            <span>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>CNPJ:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {formatCNPJ(opportunity.organizationCnpj)}
              </span>
            </div>
            <span>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>PNCP:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {opportunity.sourceExternalId}
              </span>
              <button
                onClick={() => copyToClipboard(opportunity.sourceExternalId)}
                title="Copiar número de controle"
                style={{
                  background: 'none',
                  border: 'none',
                  color: copied ? 'var(--brand-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Bento Info Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '20px',
            marginBottom: '24px',
          }}
        >
          {/* Card 1: Valores & Detalhes */}
          <div className="wishlabs-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <DollarSign size={18} color="var(--brand-primary)" />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                Valores & Detalhes da Contratação
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  backgroundColor: '#101012',
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Valor Total Estimado
                </span>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '26px',
                    fontWeight: 900,
                    color: '#FFFFFF',
                    marginTop: '4px',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {opportunity.valueStatus === 'KNOWN'
                    ? formatCurrency(opportunity.estimatedTotalValue)
                    : opportunity.valueStatus === 'VALUE_CONFIDENTIAL'
                    ? 'Orçamento Sigiloso'
                    : 'Não divulgado'}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Status de valor: <strong>{opportunity.valueStatus}</strong> (Fonte: PNCP)
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Modalidade
                  </span>
                  <strong style={{ color: '#FFFFFF' }}>
                    {opportunity.modalityName || '—'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Modo de Disputa
                  </span>
                  <strong style={{ color: '#FFFFFF' }}>
                    {opportunity.disputeModeName || '—'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Número da Compra
                  </span>
                  <strong style={{ color: '#FFFFFF' }}>
                    {opportunity.purchaseNumber || '—'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Ano da Compra
                  </span>
                  <strong style={{ color: '#FFFFFF' }}>
                    {opportunity.purchaseYear || '—'}
                  </strong>
                </div>
              </div>

              <div style={{ fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                  Unidade Compradora
                </span>
                <strong style={{ color: '#FFFFFF' }}>
                  {opportunity.unitName || opportunity.organizationName}
                </strong>
              </div>
            </div>
          </div>

          {/* Card 2: Cronograma */}
          <div className="wishlabs-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Calendar size={18} color="var(--status-review)" />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                Cronograma de Propostas
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              <div
                style={{
                  backgroundColor: 'var(--status-urgent-bg)',
                  border: '1px solid var(--status-urgent-border)',
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <span style={{ fontSize: '11.5px', color: 'var(--status-urgent)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Encerramento do Recebimento de Propostas
                </span>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '20px',
                    fontWeight: 900,
                    color: '#FFFFFF',
                    marginTop: '4px',
                  }}
                >
                  {formatDateTime(opportunity.proposalEndAt)}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <UrgencyBadge deadlineIso={opportunity.proposalEndAt} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Início do Recebimento
                  </span>
                  <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    {formatDateTime(opportunity.proposalStartAt)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Publicação no PNCP
                  </span>
                  <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    {formatDateTime(opportunity.publishedAt)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Última Atualização PNCP
                  </span>
                  <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    {formatDateTime(opportunity.sourceUpdatedAt)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Última Captura pelo Radar
                  </span>
                  <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    {formatDateTime(opportunity.lastSeenAt)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Auditoria do Classificador */}
        <div className="wishlabs-card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--brand-primary)" />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                Trilha de Auditoria do Classificador
              </h2>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Versão: <strong>{opportunity.classifierVersion}</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                Classificação Determinística:
              </span>
              <BadgeClassification
                classification={opportunity.classification}
                score={opportunity.classificationScore}
                terms={opportunity.classificationTerms}
                showTerms={true}
              />
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                Texto Normalizado Inspecionado:
              </span>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  backgroundColor: '#101012',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  maxHeight: '100px',
                  overflowY: 'auto',
                }}
              >
                {opportunity.objectNormalized}
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Payload Bruto & Evidências */}
        <div className="wishlabs-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCode size={18} color="var(--brand-cyan)" />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                Snapshot do Payload Bruto (Evidência ADR-004)
              </h2>
            </div>
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="btn-secondary"
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              {showRawJson ? 'Ocultar JSON' : 'Inspecionar JSON'}
            </button>
          </div>

          {showRawJson && (
            <div style={{ marginTop: '16px' }}>
              {snapshots.length > 0 ? (
                snapshots.map((s) => (
                  <div key={s.id} style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Tipo: {s.resourceType} • Hash SHA256:{' '}
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{s.payloadHash}</span> • Captura:{' '}
                      {formatDateTime(s.createdAt)}
                    </div>
                    <pre
                      style={{
                        backgroundColor: '#101012',
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '11.5px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--brand-cyan)',
                        border: '1px solid var(--border-subtle)',
                        overflowX: 'auto',
                        maxHeight: '320px',
                      }}
                    >
                      {JSON.stringify(JSON.parse(s.rawJson), null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Nenhum snapshot bruto persistido para esta oportunidade.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
