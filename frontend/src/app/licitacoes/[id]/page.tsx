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
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function OpportunityDetailPage({ params }: Props) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [opportunity, setOpportunity] = useState<LicitacaoOportunidade | null>(null);
  const [snapshots, setSnapshots] = useState<LicitacaoPayloadSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const resp = await fetchOpportunityDetail(id);
        setOpportunity(resp.data);
        setSnapshots(resp.snapshots || []);
      } catch (err: any) {
        setError(err.message || 'Falha ao carregar detalhes da oportunidade.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div>
        <Header />
        <div className="container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border-subtle)',
              borderTopColor: 'var(--brand-primary)',
              borderRadius: '50%',
              margin: '0 auto 1rem',
            }}
            className="animate-spin"
          />
          <p style={{ color: 'var(--text-secondary)' }}>Carregando dados da licitação...</p>
        </div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div>
        <Header />
        <div className="container" style={{ padding: '2rem 1.5rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              marginBottom: '1rem',
            }}
          >
            <ArrowLeft size={16} /> Voltar para o Radar
          </Link>
          <ErrorState
            message={error || 'Oportunidade não encontrada.'}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header />

      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '4rem' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} /> Voltar para o Radar de Licitações
          </Link>
        </div>

        {/* Top Header Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '1.75rem',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1rem',
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
                  fontSize: '12px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {opportunity.statusSource}
              </span>
            </div>

            {/* Official PNCP Link */}
            <a
              href={opportunity.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--brand-primary)',
                color: '#090e17',
                fontWeight: 700,
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              <span>Abrir no Portal PNCP</span>
              <ExternalLink size={15} />
            </a>
          </div>

          <h1
            style={{
              fontSize: '20px',
              fontWeight: 800,
              lineHeight: 1.4,
              color: 'var(--text-primary)',
              marginBottom: '1rem',
            }}
          >
            {opportunity.objectRaw}
          </h1>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '1rem',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={16} color="#60a5fa" />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {opportunity.organizationName}
              </span>
            </div>
            <span>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={16} color="#f59e0b" />
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
                  color: copied ? '#10b981' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Info Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          {/* Card 1: Informações Financeiras e Contratuais */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <DollarSign size={18} color="#34d399" />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Valores & Detalhes da Contratação
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Valor Total Estimado:
                </span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                  {opportunity.valueStatus === 'KNOWN'
                    ? formatCurrency(opportunity.estimatedTotalValue)
                    : opportunity.valueStatus === 'VALUE_CONFIDENTIAL'
                    ? 'Orçamento Sigiloso'
                    : 'Não divulgado'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Status de valor: <strong>{opportunity.valueStatus}</strong> (Fonte: PNCP)
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Modalidade
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {opportunity.modalityName || '—'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Modo de Disputa
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {opportunity.disputeModeName || '—'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Número da Compra
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {opportunity.purchaseNumber || '—'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Ano da Compra
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {opportunity.purchaseYear || '—'}
                  </strong>
                </div>
              </div>

              <div style={{ fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                  Unidade Compradora
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {opportunity.unitName || opportunity.organizationName}
                </strong>
              </div>
            </div>
          </div>

          {/* Card 2: Prazos e Cronograma */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <Calendar size={18} color="#f59e0b" />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Cronograma de Propostas
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '13px' }}>
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Encerramento do Recebimento de Propostas:
                </span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {formatDateTime(opportunity.proposalEndAt)}
                </div>
                <div style={{ marginTop: '6px' }}>
                  <UrgencyBadge deadlineIso={opportunity.proposalEndAt} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Início do Recebimento
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {formatDateTime(opportunity.proposalStartAt)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Publicação no PNCP
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {formatDateTime(opportunity.publishedAt)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Última Atualização PNCP
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {formatDateTime(opportunity.sourceUpdatedAt)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                    Última Captura pelo Radar
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {formatDateTime(opportunity.lastSeenAt)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Auditoria do Classificador */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#60a5fa" />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Trilha de Auditoria do Classificador
              </h2>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Versão da regra: <strong>{opportunity.classifierVersion}</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
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
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Texto Normalizado Inspecionado:
              </span>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  maxHeight: '80px',
                  overflowY: 'auto',
                }}
              >
                {opportunity.objectNormalized}
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Payload Bruto & Evidências */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCode size={18} color="#f59e0b" />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Snapshot do Payload Bruto (Evidência ADR-004)
              </h2>
            </div>
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {showRawJson ? 'Ocultar JSON' : 'Inspecionar JSON'}
            </button>
          </div>

          {showRawJson && (
            <div style={{ marginTop: '1rem' }}>
              {snapshots.length > 0 ? (
                snapshots.map((s) => (
                  <div key={s.id} style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Tipo: {s.resourceType} • Hash SHA256:{' '}
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{s.payloadHash}</span> • Captura:{' '}
                      {formatDateTime(s.createdAt)}
                    </div>
                    <pre
                      style={{
                        backgroundColor: '#05080e',
                        padding: '1rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: '#93c5fd',
                        overflowX: 'auto',
                        maxHeight: '300px',
                      }}
                    >
                      {JSON.stringify(JSON.parse(s.rawJson), null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Nenhum snapshot bruto persistido para esta oportunidade.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
