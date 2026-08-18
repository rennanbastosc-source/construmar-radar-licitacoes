// Converte valores monetários para extenso em português (pt-BR).
// Ex.: 900000 -> "novecentos mil reais"

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis',
  'dezessete', 'dezoito', 'dezenove',
];

const DEZENAS = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta',
  'setenta', 'oitenta', 'noventa',
];

const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
];

function tresDigitos(n: number): string {
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  let out = '';
  if (centena > 0) {
    out += centena === 1 && resto === 0 ? 'cem' : CENTENAS[centena];
  }
  if (resto > 0) {
    if (out) out += ' e ';
    out += resto < 20 ? UNIDADES[resto] : DEZENAS[Math.floor(resto / 10)] + (resto % 10 ? ' e ' + UNIDADES[resto % 10] : '');
  }
  return out;
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const partes: string[] = [];
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  if (milhoes > 0) {
    const palavra = milhoes === 1 ? 'um milhão' : tresDigitos(milhoes) + ' milhões';
    // "um milhão de reais" quando o milhão é o único componente; senão "um milhão e X"
    if (milhares === 0 && resto === 0) {
      partes.push(palavra + ' de');
    } else {
      partes.push(palavra);
    }
  }
  if (milhares > 0) {
    partes.push(milhares === 1 ? 'mil' : tresDigitos(milhares) + ' mil');
  }
  if (resto > 0) {
    partes.push(tresDigitos(resto));
  }
  return partes.join(' e ');
}

export function valorPorExtenso(valor: number): string {
  if (!isFinite(valor) || valor < 0) return '';
  const reais = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);

  let out = inteiroPorExtenso(reais) + (reais === 1 ? ' real' : ' reais');
  if (centavos > 0) {
    out += ' e ' + inteiroPorExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  }
  return out;
}