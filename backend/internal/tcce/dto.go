package tcce

type LicitacaoListItem struct {
	Number         string
	Municipality   string
	Object         string
	PublishedAtRaw string
	OpeningAtRaw   string
	ReopeningAtRaw string
	ValueRaw       string
	ProcID         string
	LicitID        string
}

type LicitacaoDocumento struct {
	Title string
	URL   string
}

type LicitacaoDetail struct {
	Number           string
	Municipality     string
	Exercicio        string
	Object           string
	SinteseObjeto    string
	Modality         string
	JudgmentCriteria string
	Situation        string
	PublishedAtRaw   string
	OpeningAtRaw     string
	OpeningTimeRaw   string
	Local            string
	Processo         string
	LegalBasis       string
	Orgao            string
	Documents        []LicitacaoDocumento
}

const DefaultBaseURL = "https://municipios-licitacoes.tce.ce.gov.br"
