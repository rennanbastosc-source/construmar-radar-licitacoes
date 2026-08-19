package config

import (
	"strings"
	"testing"
)

func TestValidateRequiresExplicitConfiguration(t *testing.T) {
	t.Setenv("AI_API_URL", "")
	t.Setenv("AI_API_KEY", "")
	t.Setenv("API_AUTH_TOKEN", "")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	t.Setenv("SEOBRA_USER", "")
	t.Setenv("SEOBRA_PASS", "")
	t.Setenv("SEOBRA_MOCK", "")

	err := LoadConfig().Validate()
	if err == nil {
		t.Fatal("expected missing configuration error")
	}
	for _, variable := range []string{"AI_API_URL", "AI_API_KEY", "API_AUTH_TOKEN", "CORS_ALLOWED_ORIGINS", "SEOBRA_USER", "SEOBRA_PASS"} {
		if !strings.Contains(err.Error(), variable) {
			t.Errorf("error %q does not mention %s", err, variable)
		}
	}
}

func TestValidateAcceptsConfiguredValues(t *testing.T) {
	t.Setenv("AI_API_URL", "https://example.invalid/v1")
	t.Setenv("AI_API_KEY", "fake-ai-key")
	t.Setenv("API_AUTH_TOKEN", "fake-shared-token")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://frontend.example.invalid, http://localhost:3000")
	t.Setenv("SEOBRA_USER", "fake-user")
	t.Setenv("SEOBRA_PASS", "fake-pass")
	t.Setenv("SEOBRA_MOCK", "")

	if err := LoadConfig().Validate(); err != nil {
		t.Fatalf("expected valid configuration, got %v", err)
	}
}

func TestValidateAllowsMissingSeobraCredentialsInMockMode(t *testing.T) {
	t.Setenv("AI_API_URL", "https://example.invalid/v1")
	t.Setenv("AI_API_KEY", "fake-ai-key")
	t.Setenv("API_AUTH_TOKEN", "fake-shared-token")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://frontend.example.invalid")
	t.Setenv("SEOBRA_USER", "")
	t.Setenv("SEOBRA_PASS", "")
	t.Setenv("SEOBRA_MOCK", "true")

	if err := LoadConfig().Validate(); err != nil {
		t.Fatalf("expected mock configuration to be valid, got %v", err)
	}
}
