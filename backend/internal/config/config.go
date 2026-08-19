package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port               string
	DBPath             string
	PNCPBaseURL        string
	MinEstimatedValue  float64
	DefaultUF          string
	SyncIntervalHours  int
	AIAPIURL           string
	AIAPIKey           string
	AIModel            string
	APIAuthToken       string
	CORSAllowedOrigins []string
}

func LoadConfig() *Config {
	port := getEnv("PORT", "8080")
	dbPath := getEnv("DB_PATH", "./radar.db")
	pncpURL := getEnv("PNCP_BASE_URL", "https://pncp.gov.br/api/consulta")
	defaultUF := getEnv("DEFAULT_UF", "CE")

	minValStr := getEnv("MIN_ESTIMATED_VALUE", "900000.00")
	minVal, err := strconv.ParseFloat(minValStr, 64)
	if err != nil {
		minVal = 900000.00
	}

	syncHoursStr := getEnv("SYNC_INTERVAL_HOURS", "6")
	syncHours, err := strconv.Atoi(syncHoursStr)
	if err != nil {
		syncHours = 6
	}

	aiURL := os.Getenv("AI_API_URL")
	aiKey := os.Getenv("AI_API_KEY")
	aiModel := getEnv("AI_MODEL", "GeMiNi")
	apiAuthToken := os.Getenv("API_AUTH_TOKEN")
	corsAllowedOrigins := parseAllowedOrigins(os.Getenv("CORS_ALLOWED_ORIGINS"))

	return &Config{
		Port:               port,
		DBPath:             dbPath,
		PNCPBaseURL:        pncpURL,
		MinEstimatedValue:  minVal,
		DefaultUF:          defaultUF,
		SyncIntervalHours:  syncHours,
		AIAPIURL:           aiURL,
		AIAPIKey:           aiKey,
		AIModel:            aiModel,
		APIAuthToken:       apiAuthToken,
		CORSAllowedOrigins: corsAllowedOrigins,
	}
}

func (c *Config) Validate() error {
	if c == nil {
		return fmt.Errorf("invalid configuration: nil")
	}

	missing := make([]string, 0, 6)
	if strings.TrimSpace(c.AIAPIURL) == "" {
		missing = append(missing, "AI_API_URL")
	}
	if strings.TrimSpace(c.AIAPIKey) == "" {
		missing = append(missing, "AI_API_KEY")
	}
	if strings.TrimSpace(c.APIAuthToken) == "" {
		missing = append(missing, "API_AUTH_TOKEN")
	}

	hasAllowedOrigin := false
	for _, origin := range c.CORSAllowedOrigins {
		origin = strings.TrimSpace(origin)
		if origin == "" {
			continue
		}
		hasAllowedOrigin = true
		if strings.Contains(origin, "*") {
			return fmt.Errorf("invalid configuration: CORS_ALLOWED_ORIGINS must contain explicit origins")
		}
	}
	if !hasAllowedOrigin {
		missing = append(missing, "CORS_ALLOWED_ORIGINS")
	}

	mockMode := os.Getenv("SEOBRA_MOCK") == "1" || strings.EqualFold(os.Getenv("SEOBRA_MOCK"), "true")
	if !mockMode {
		if strings.TrimSpace(os.Getenv("SEOBRA_USER")) == "" {
			missing = append(missing, "SEOBRA_USER")
		}
		if strings.TrimSpace(os.Getenv("SEOBRA_PASS")) == "" {
			missing = append(missing, "SEOBRA_PASS")
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing required configuration: %s", strings.Join(missing, ", "))
	}
	return nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func parseAllowedOrigins(value string) []string {
	var origins []string
	for _, origin := range strings.Split(value, ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}
