export function formatCurrency(value?: number | null): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'Não informado';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '—';
  }
}

export function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return '—';
  }
}

export function formatCNPJ(cnpj?: string | null): string {
  if (!cnpj) return '—';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export interface UrgencyInfo {
  label: string;
  level: 'critical' | 'warning' | 'normal' | 'expired' | 'none';
  remainingHours: number;
}

export function getDeadlineUrgency(endIso?: string | null): UrgencyInfo {
  if (!endIso) {
    return { label: 'Prazo não definido', level: 'none', remainingHours: 99999 };
  }

  const end = new Date(endIso).getTime();
  const now = Date.now();
  const diffMs = end - now;

  if (diffMs <= 0) {
    return { label: 'Encerrado', level: 'expired', remainingHours: 0 };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 24) {
    return { label: `Encerra em ${hours}h`, level: 'critical', remainingHours: hours };
  }

  if (days <= 3) {
    return { label: `Encerra em ${days}d ${hours % 24}h`, level: 'warning', remainingHours: hours };
  }

  if (days <= 7) {
    return { label: `${days} dias restantes`, level: 'normal', remainingHours: hours };
  }

  return { label: `${days} dias restantes`, level: 'none', remainingHours: hours };
}
