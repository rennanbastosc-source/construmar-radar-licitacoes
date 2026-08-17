package pncp

// PNCPPropostaResponse represents the root response from /v1/contratacoes/proposta.
type PNCPPropostaResponse struct {
	Data             []PNCPContratacaoDTO `json:"data"`
	TotalRegistros   int                  `json:"totalRegistros"`
	TotalPaginas     int                  `json:"totalPaginas"`
	NumeroPagina     int                  `json:"numeroPagina"`
	PaginasRestantes int                  `json:"paginasRestantes"`
	Status           int                  `json:"status"`
}

// PNCPContratacaoDTO represents an individual item in proposals list or detail.
type PNCPContratacaoDTO struct {
	NumeroControlePNCP                string             `json:"numeroControlePNCP"`
	AnoCompra                         int                `json:"anoCompra"`
	SequencialCompra                  int                `json:"sequencialCompra"`
	NumeroCompra                      string             `json:"numeroCompra"`
	Processo                          string             `json:"processo"`
	ObjetoCompra                      string             `json:"objetoCompra"`
	InformacaoComplementar            *string            `json:"informacaoComplementar"`
	ValorTotalEstimado                *float64           `json:"valorTotalEstimado"`
	ValorTotalHomologado              *float64           `json:"valorTotalHomologado"`
	OrcamentoSigilosoCodigo           *int               `json:"orcamentoSigilosoCodigo"`
	OrcamentoSigilosoDescricao        *string            `json:"orcamentoSigilosoDescricao"`
	SRP                               bool               `json:"srp"`
	ModalidadeId                      int                `json:"modalidadeId"`
	ModalidadeNome                    string             `json:"modalidadeNome"`
	ModoDisputaId                     int                `json:"modoDisputaId"`
	ModoDisputaNome                   string             `json:"modoDisputaNome"`
	TipoInstrumentoConvocatorioCodigo int                `json:"tipoInstrumentoConvocatorioCodigo"`
	TipoInstrumentoConvocatorioNome   string             `json:"tipoInstrumentoConvocatorioNome"`
	DataAberturaProposta              *string            `json:"dataAberturaProposta"`
	DataEncerramentoProposta          *string            `json:"dataEncerramentoProposta"`
	DataPublicacaoPncp                *string            `json:"dataPublicacaoPncp"`
	DataAtualizacao                   *string            `json:"dataAtualizacao"`
	DataAtualizacaoGlobal             *string            `json:"dataAtualizacaoGlobal"`
	DataInclusao                      *string            `json:"dataInclusao"`
	SituacaoCompraId                  int                `json:"situacaoCompraId"`
	SituacaoCompraNome                string             `json:"situacaoCompraNome"`
	LinkSistemaOrigem                 *string            `json:"linkSistemaOrigem"`
	LinkProcessoEletronico            *string            `json:"linkProcessoEletronico"`
	UsuarioNome                       *string            `json:"usuarioNome"`
	OrgaoEntidade                     PNCPEntidadeDTO    `json:"orgaoEntidade"`
	UnidadeOrgao                      PNCPUnidadeDTO     `json:"unidadeOrgao"`
	AmparoLegal                       *PNCPAmparoLegalDTO `json:"amparoLegal"`
}

type PNCPEntidadeDTO struct {
	CNPJ        string `json:"cnpj"`
	RazaoSocial string `json:"razaoSocial"`
	PoderId     string `json:"poderId"`
	EsferaId    string `json:"esferaId"`
}

type PNCPUnidadeDTO struct {
	CodigoUnidade string `json:"codigoUnidade"`
	NomeUnidade   string `json:"nomeUnidade"`
	UFSigla       string `json:"ufSigla"`
	UFNome        string `json:"ufNome"`
	MunicipioNome string `json:"municipioNome"`
	CodigoIBGE    string `json:"codigoIbge"`
}

type PNCPAmparoLegalDTO struct {
	Codigo    int    `json:"codigo"`
	Nome      string `json:"nome"`
	Descricao string `json:"descricao"`
}
