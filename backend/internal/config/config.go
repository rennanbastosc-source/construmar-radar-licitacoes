package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port              string
	DBPath            string
	PNCPBaseURL       string
	MinEstimatedValue float64
	DefaultUF         string
	SyncIntervalHours int
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

	return &Config{
		Port:              port,
		DBPath:            dbPath,
		PNCPBaseURL:       pncpURL,
		MinEstimatedValue: minVal,
		DefaultUF:         defaultUF,
		SyncIntervalHours: syncHours,
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
