package origin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/pncp"
)

// PlatformCode identifies known procurement portals.
type PlatformCode string

const (
	PlatformLicitamais PlatformCode = "LICITAMAIS"
	PlatformBLL        PlatformCode = "BLL"
	PlatformComprasGov PlatformCode = "COMPRASGOV"
	PlatformSeplagCE   PlatformCode = "SEPLAG_CE"
	PlatformBBMNet     PlatformCode = "BBMNET"
	PlatformPNCP       PlatformCode = "PNCP"
	PlatformOther      PlatformCode = "OTHER"
)

// OriginPlatformInfo represents metadata and search URLs for an originating procurement platform.
type OriginPlatformInfo struct {
	PlatformName    string            `json:"platformName"`
	PlatformCode    PlatformCode      `json:"platformCode"`
	OriginURL       string            `json:"originUrl"`
	DirectSearchURL string            `json:"directSearchUrl"`
	IsDirectMatch   bool              `json:"isDirectMatch"`
	BadgeColor      string            `json:"badgeColor"`
	ExtraParams     map[string]string `json:"extraParams,omitempty"`
}

// EditalDocumentFile represents an edital PDF or attachment available for download and audit.
type EditalDocumentFile struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	DocType        string `json:"docType"`
	URL            string `json:"url"`
	DataPublicacao string `json:"dataPublicacao,omitempty"`
	IsDownloadable bool   `json:"isDownloadable"`
}

// OpportunityOriginDetail holds consolidated parent contracting info and edital documents.
type OpportunityOriginDetail struct {
	OpportunityID         string               `json:"opportunityId"`
	SourceExternalID      string               `json:"sourceExternalId"`
	OrganizationName      string               `json:"organizationName"`
	OrganizationCNPJ      string               `json:"organizationCnpj"`
	MunicipalityName      string               `json:"municipalityName"`
	UF                    string               `json:"uf"`
	PurchaseNumber        string               `json:"purchaseNumber"`
	PurchaseYear          int                  `json:"purchaseYear"`
	Processo              string               `json:"processo"`
	ModalityName          string               `json:"modalityName"`
	PrimaryPlatform       OriginPlatformInfo   `json:"primaryPlatform"`
	AvailablePlatforms    []OriginPlatformInfo `json:"availablePlatforms"`
	Documents             []EditalDocumentFile `json:"documents"`
	DirectAuditAvailable  bool                 `json:"directAuditAvailable"`
	SuggestedDocumentURL  string               `json:"suggestedDocumentUrl,omitempty"`
	SuggestedDocumentName string               `json:"suggestedDocumentName,omitempty"`
}

// PNCPArquivoDTO represents the item returned by the PNCP arquivos endpoint.
type PNCPArquivoDTO struct {
	URI                 string `json:"uri"`
	URL                 string `json:"url"`
	Titulo              string `json:"titulo"`
	TipoDocumentoNome   string `json:"tipoDocumentoNome"`
	TipoDocumentoId     int    `json:"tipoDocumentoId"`
	StatusAtivo         bool   `json:"statusAtivo"`
	DataPublicacaoPncp  string `json:"dataPublicacaoPncp"`
	SequencialDocumento int    `json:"sequencialDocumento"`
}

// ReverseResolver handles reverse lookups for parent origin platforms and PNCP documents.
type ReverseResolver struct {
	httpClient *http.Client
}

// NewReverseResolver creates a new ReverseResolver instance.
func NewReverseResolver(timeout time.Duration) *ReverseResolver {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &ReverseResolver{
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// ResolveOrigin analyzes an opportunity and snapshot to discover parent portals and fetch attached edital files.
func (r *ReverseResolver) ResolveOrigin(ctx context.Context, opp *domain.LicitacaoOportunidade, snapshotJSON []byte) (*OpportunityOriginDetail, error) {
	if opp == nil {
		return nil, fmt.Errorf("opportunity cannot be nil")
	}

	var rawDTO pncp.PNCPContratacaoDTO
	if len(snapshotJSON) > 0 {
		_ = json.Unmarshal(snapshotJSON, &rawDTO)
	}

	systemUser := ""
	if rawDTO.UsuarioNome != nil {
		systemUser = strings.TrimSpace(*rawDTO.UsuarioNome)
	}

	processo := stringVal(opp.PurchaseNumber)
	if rawDTO.Processo != "" {
		processo = rawDTO.Processo
	}

	anoCompra := intVal(opp.PurchaseYear)
	if anoCompra == 0 && rawDTO.AnoCompra > 0 {
		anoCompra = rawDTO.AnoCompra
	}
	if anoCompra == 0 {
		anoCompra = time.Now().Year()
	}

	sequencialCompra := rawDTO.SequencialCompra
	if sequencialCompra == 0 {
		// Attempt to extract sequencial from source external ID or numeroControlePNCP
		// E.g. "06750525000120-1-000012/2024" -> sequencial 12
		parts := strings.Split(opp.SourceExternalID, "-")
		if len(parts) >= 3 {
			subParts := strings.Split(parts[2], "/")
			if len(subParts) >= 1 {
				if seq, err := strconv.Atoi(strings.TrimLeft(subParts[0], "0")); err == nil && seq > 0 {
					sequencialCompra = seq
				}
			}
		}
	}

	purchaseNum := stringVal(opp.PurchaseNumber)

	// 1. Identify Primary Platform
	primaryPlatform := r.detectPrimaryPlatform(systemUser, rawDTO.LinkSistemaOrigem, rawDTO.LinkProcessoEletronico, opp, purchaseNum)

	// 2. Build reverse links for Licitamais Brasil and BLL Compras
	licitamaisPlatform := r.buildLicitamaisInfo(opp, processo, purchaseNum)
	bllPlatform := r.buildBLLInfo(opp, processo, purchaseNum)
	comprasGovPlatform := r.buildComprasGovInfo(opp, rawDTO)

	availablePlatforms := []OriginPlatformInfo{primaryPlatform}
	// Evita duplicar a plataforma primária nos links reversos (ex.: LICITAMAIS duas vezes,
	// o que quebrava chaves únicas do React no frontend).
	if licitamaisPlatform.PlatformCode != primaryPlatform.PlatformCode {
		availablePlatforms = append(availablePlatforms, licitamaisPlatform)
	}
	if bllPlatform.PlatformCode != primaryPlatform.PlatformCode {
		availablePlatforms = append(availablePlatforms, bllPlatform)
	}
	if primaryPlatform.PlatformCode != PlatformComprasGov && (systemUser == "Compras.gov.br" || rawDTO.LinkSistemaOrigem != nil) {
		availablePlatforms = append(availablePlatforms, comprasGovPlatform)
	}

	// 3. Query PNCP Arquivos endpoint for real edital PDFs
	documents := r.fetchPNCPDocuments(ctx, opp.OrganizationCNPJ, anoCompra, sequencialCompra)

	// 4. Determine suggested document for 1-click audit
	var suggestedURL, suggestedName string
	for _, doc := range documents {
		lowerTitle := strings.ToLower(doc.Title)
		lowerType := strings.ToLower(doc.DocType)
		if strings.Contains(lowerTitle, "edital") || strings.Contains(lowerType, "edital") || strings.Contains(lowerTitle, "termo") {
			suggestedURL = doc.URL
			suggestedName = doc.Title
			break
		}
	}
	if suggestedURL == "" && len(documents) > 0 {
		suggestedURL = documents[0].URL
		suggestedName = documents[0].Title
	}

	modality := ""
	if opp.ModalityName != nil {
		modality = *opp.ModalityName
	}

	return &OpportunityOriginDetail{
		OpportunityID:         opp.ID,
		SourceExternalID:      opp.SourceExternalID,
		OrganizationName:      opp.OrganizationName,
		OrganizationCNPJ:      opp.OrganizationCNPJ,
		MunicipalityName:      opp.MunicipalityName,
		UF:                    opp.UF,
		PurchaseNumber:        purchaseNum,
		PurchaseYear:          anoCompra,
		Processo:              processo,
		ModalityName:          modality,
		PrimaryPlatform:       primaryPlatform,
		AvailablePlatforms:    availablePlatforms,
		Documents:             documents,
		DirectAuditAvailable:  suggestedURL != "",
		SuggestedDocumentURL:  suggestedURL,
		SuggestedDocumentName: suggestedName,
	}, nil
}

// detectPrimaryPlatform identifies the system that posted the notice.
func (r *ReverseResolver) detectPrimaryPlatform(systemUser string, linkOrigem, linkProcesso *string, opp *domain.LicitacaoOportunidade, purchaseNum string) OriginPlatformInfo {
	directURL := ""
	if linkOrigem != nil && *linkOrigem != "" {
		directURL = *linkOrigem
	} else if linkProcesso != nil && *linkProcesso != "" {
		directURL = *linkProcesso
	}

	lowerSys := strings.ToLower(systemUser)

	if (strings.Contains(lowerSys, "licita") && strings.Contains(lowerSys, "brasil")) || strings.Contains(lowerSys, "licitamais") {
		return OriginPlatformInfo{
			PlatformName:    "Licita + Brasil",
			PlatformCode:    PlatformLicitamais,
			OriginURL:       fallbackURL(directURL, "https://licitamaisbrasil.com.br/editais-publicados"),
			DirectSearchURL: fmt.Sprintf("https://licitamaisbrasil.com.br/editais-publicados?uf=%s&cidade=%s&busca=%s", url.QueryEscape(opp.UF), url.QueryEscape(opp.MunicipalityName), url.QueryEscape(purchaseNum)),
			IsDirectMatch:   directURL != "",
			BadgeColor:      "#10B981", // Verde Licitamais
		}
	}

	if strings.Contains(lowerSys, "bll") || strings.Contains(lowerSys, "bolsa de licitacoes") {
		return OriginPlatformInfo{
			PlatformName:    "BLL Compras",
			PlatformCode:    PlatformBLL,
			OriginURL:       fallbackURL(directURL, "https://bllcompras.com/Process/ProcessSearchPublic?param1=0"),
			DirectSearchURL: fmt.Sprintf("https://bllcompras.com/Process/ProcessSearchPublic?param1=0&fkState=6&Organization=%s&Number=%s&City=%s", url.QueryEscape(opp.OrganizationName), url.QueryEscape(purchaseNum), url.QueryEscape(opp.MunicipalityName)),
			IsDirectMatch:   directURL != "",
			BadgeColor:      "#3B82F6", // Azul BLL
		}
	}

	if strings.Contains(lowerSys, "compras.gov") || strings.Contains(lowerSys, "comprasnet") || strings.Contains(lowerSys, "serpro") {
		return OriginPlatformInfo{
			PlatformName:    "Compras.gov.br",
			PlatformCode:    PlatformComprasGov,
			OriginURL:       fallbackURL(directURL, "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/pesquisa-compras"),
			DirectSearchURL: fmt.Sprintf("https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/pesquisa-compras?uf=%s&orgao=%s", url.QueryEscape(opp.UF), url.QueryEscape(opp.OrganizationCNPJ)),
			IsDirectMatch:   directURL != "",
			BadgeColor:      "#0284C7", // Azul ComprasGov
		}
	}

	if (strings.Contains(lowerSys, "planejamento") && strings.Contains(lowerSys, "ceará")) || strings.Contains(lowerSys, "seplag") {
		return OriginPlatformInfo{
			PlatformName:    "SEPLAG Ceará (Portal de Compras CE)",
			PlatformCode:    PlatformSeplagCE,
			OriginURL:       fallbackURL(directURL, "https://s2gpr.seplag.ce.gov.br/licita-web/paginas/licita/consultaLicita.seam"),
			DirectSearchURL: "https://s2gpr.seplag.ce.gov.br/licita-web/paginas/licita/consultaLicita.seam",
			IsDirectMatch:   directURL != "",
			BadgeColor:      "#F59E0B", // Âmbar SEPLAG
		}
	}

	if strings.Contains(lowerSys, "bbmnet") {
		return OriginPlatformInfo{
			PlatformName:    "Novo BBMNET Licitações",
			PlatformCode:    PlatformBBMNet,
			OriginURL:       fallbackURL(directURL, "https://novobbmnet.com.br"),
			DirectSearchURL: "https://novobbmnet.com.br",
			IsDirectMatch:   directURL != "",
			BadgeColor:      "#8B5CF6",
		}
	}

	displayName := systemUser
	if displayName == "" {
		displayName = "Portal PNCP / Órgão Oficial"
	}

	return OriginPlatformInfo{
		PlatformName:    displayName,
		PlatformCode:    PlatformOther,
		OriginURL:       fallbackURL(directURL, opp.SourceURL),
		DirectSearchURL: opp.SourceURL,
		IsDirectMatch:   directURL != "",
		BadgeColor:      "#0EA5E9",
	}
}

func (r *ReverseResolver) buildLicitamaisInfo(opp *domain.LicitacaoOportunidade, processo, purchaseNum string) OriginPlatformInfo {
	searchQuery := processo
	if searchQuery == "" {
		searchQuery = purchaseNum
	}
	directSearch := fmt.Sprintf("https://licitamaisbrasil.com.br/editais-publicados?uf=%s&cidade=%s&busca=%s",
		url.QueryEscape(opp.UF),
		url.QueryEscape(opp.MunicipalityName),
		url.QueryEscape(searchQuery),
	)

	return OriginPlatformInfo{
		PlatformName:    "Licita + Brasil",
		PlatformCode:    PlatformLicitamais,
		OriginURL:       "https://licitamaisbrasil.com.br/editais-publicados",
		DirectSearchURL: directSearch,
		IsDirectMatch:   false,
		BadgeColor:      "#10B981",
		ExtraParams: map[string]string{
			"uf":       opp.UF,
			"cidade":   opp.MunicipalityName,
			"processo": processo,
		},
	}
}

func (r *ReverseResolver) buildBLLInfo(opp *domain.LicitacaoOportunidade, processo, purchaseNum string) OriginPlatformInfo {
	// fkState=6 represents CE in BLL Compras public search
	number := purchaseNum
	if number == "" {
		number = processo
	}
	directSearch := fmt.Sprintf("https://bllcompras.com/Process/ProcessSearchPublic?param1=0&fkState=6&Organization=%s&Number=%s&City=%s",
		url.QueryEscape(opp.OrganizationName),
		url.QueryEscape(number),
		url.QueryEscape(opp.MunicipalityName),
	)

	return OriginPlatformInfo{
		PlatformName:    "BLL Compras",
		PlatformCode:    PlatformBLL,
		OriginURL:       "https://bllcompras.com/Process/ProcessSearchPublic?param1=0",
		DirectSearchURL: directSearch,
		IsDirectMatch:   false,
		BadgeColor:      "#3B82F6",
		ExtraParams: map[string]string{
			"fkState":      "6",
			"Organization": opp.OrganizationName,
			"Number":       number,
			"City":         opp.MunicipalityName,
		},
	}
}

func (r *ReverseResolver) buildComprasGovInfo(opp *domain.LicitacaoOportunidade, rawDTO pncp.PNCPContratacaoDTO) OriginPlatformInfo {
	return OriginPlatformInfo{
		PlatformName:    "Compras.gov.br",
		PlatformCode:    PlatformComprasGov,
		OriginURL:       "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/pesquisa-compras",
		DirectSearchURL: fmt.Sprintf("https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/pesquisa-compras?uf=%s&cnpj=%s", url.QueryEscape(opp.UF), url.QueryEscape(opp.OrganizationCNPJ)),
		IsDirectMatch:   false,
		BadgeColor:      "#0284C7",
	}
}

// fetchPNCPDocuments calls the PNCP arquivos API to discover official downloadable PDFs.
func (r *ReverseResolver) fetchPNCPDocuments(ctx context.Context, cnpj string, ano int, sequencial int) []EditalDocumentFile {
	if cnpj == "" || ano <= 0 || sequencial <= 0 {
		return []EditalDocumentFile{}
	}

	endpoint := fmt.Sprintf("https://pncp.gov.br/api/pncp/v1/orgaos/%s/compras/%d/%d/arquivos", cnpj, ano, sequencial)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return []EditalDocumentFile{}
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Construmar-RadarLicitacoes/1.0")

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return []EditalDocumentFile{}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return []EditalDocumentFile{}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return []EditalDocumentFile{}
	}

	var arquivos []PNCPArquivoDTO
	if err := json.Unmarshal(body, &arquivos); err != nil {
		return []EditalDocumentFile{}
	}

	var result []EditalDocumentFile
	for i, arq := range arquivos {
		if !arq.StatusAtivo {
			continue
		}
		downloadURL := arq.URL
		if downloadURL == "" {
			downloadURL = arq.URI
		}
		title := arq.Titulo
		if title == "" {
			title = fmt.Sprintf("Documento %d.pdf", i+1)
		}
		docType := arq.TipoDocumentoNome
		if docType == "" {
			docType = "Edital"
		}

		result = append(result, EditalDocumentFile{
			ID:             fmt.Sprintf("pncp-%s-%d-%d-%d", cnpj, ano, sequencial, arq.SequencialDocumento),
			Title:          title,
			DocType:        docType,
			URL:            downloadURL,
			DataPublicacao: arq.DataPublicacaoPncp,
			IsDownloadable: true,
		})
	}

	return result
}

// DownloadEditalDocument downloads a document file by URL safely into memory (up to 64MB).
func (r *ReverseResolver) DownloadEditalDocument(ctx context.Context, docURL string) ([]byte, string, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, docURL, nil)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to build download request: %w", err)
	}
	req.Header.Set("User-Agent", "Construmar-RadarLicitacoes/1.0")
	req.Header.Set("Accept", "*/*")

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to fetch document from %s: %w", docURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", "", fmt.Errorf("document download returned HTTP %d", resp.StatusCode)
	}

	// Limit to 64MB
	limitedReader := io.LimitReader(resp.Body, 64<<20)
	data, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, "", "", fmt.Errorf("error reading document data: %w", err)
	}

	filename := "edital.pdf"
	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		if _, params, err := parseContentDisposition(cd); err == nil {
			if f, ok := params["filename"]; ok && f != "" {
				filename = f
			}
		}
	} else {
		if parsed, err := url.Parse(docURL); err == nil {
			base := path.Base(parsed.Path)
			if base != "" && base != "." && base != "/" {
				filename = base
				if !strings.HasSuffix(strings.ToLower(filename), ".pdf") {
					filename += ".pdf"
				}
			}
		}
	}

	mimeType := resp.Header.Get("Content-Type")
	if mimeType == "" || strings.Contains(mimeType, "octet-stream") {
		mimeType = "application/pdf"
	}

	return data, filename, mimeType, nil
}

func parseContentDisposition(cd string) (string, map[string]string, error) {
	params := make(map[string]string)
	parts := strings.Split(cd, ";")
	disposition := strings.TrimSpace(parts[0])

	for _, part := range parts[1:] {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) == 2 {
			k := strings.ToLower(strings.TrimSpace(kv[0]))
			v := strings.Trim(strings.TrimSpace(kv[1]), `"'`)
			params[k] = v
		}
	}
	return disposition, params, nil
}

func fallbackURL(preferred, fallback string) string {
	if preferred != "" {
		return preferred
	}
	return fallback
}

func stringVal(ptr *string) string {
	if ptr == nil {
		return ""
	}
	return *ptr
}

func intVal(ptr *int) int {
	if ptr == nil {
		return 0
	}
	return *ptr
}
