package service

import (
	"sync"
	"testing"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
)

// TestPublishRunSnapshotsAreIsolated exercises the publish/copy contract:
// concurrent readers never observe in-flight mutations (run with -race),
// and mutating the source run after publish does not affect the snapshot.
func TestPublishRunSnapshotsAreIsolated(t *testing.T) {
	s := NewSyncService(nil, nil)

	run := &domain.LicitacaoSyncRun{
		ID:            "run-1",
		Source:        "PNCP",
		StartedAt:     time.Now().UTC(),
		Status:        domain.SyncStatusRunning,
		CorrelationID: "corr-1",
	}
	s.publishRun(run)

	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				snap := s.GetCurrentRun()
				if snap != nil && snap.ID != "run-1" {
					t.Errorf("unexpected snapshot ID %q", snap.ID)
				}
			}
		}()
	}

	// Concurrently mutate the source run (as the sync goroutine does) and republish.
	for i := 0; i < 100; i++ {
		run.TotalReceived++
		run.Status = domain.SyncStatusRunning
		s.publishRun(run)
	}

	wg.Wait()

	snap := s.GetCurrentRun()
	if snap == nil || snap.TotalReceived != 100 {
		t.Fatalf("expected final snapshot with 100 received, got %+v", snap)
	}

	// Mutating the source run after the last publish must not change the snapshot.
	run.TotalReceived = 9999
	if snap := s.GetCurrentRun(); snap.TotalReceived != 100 {
		t.Errorf("snapshot aliases the source run: got %d, want 100", snap.TotalReceived)
	}
}
