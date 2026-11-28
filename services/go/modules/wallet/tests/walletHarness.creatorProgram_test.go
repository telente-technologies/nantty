package wallet_test

import "github.com/jackc/pgx/v5"

func (harness *walletHarness) approveCreator(userId string) {
	harness.T.Helper()
	query := "INSERT INTO " + pgx.Identifier{harness.creatorSchema, "creator_program_members"}.Sanitize() + " (user_id, status) VALUES ($1, 'approved') ON CONFLICT (user_id) DO UPDATE SET status = 'approved', suspended_at = NULL"
	if _, err := harness.Database.Exec(query, userId); err != nil {
		harness.T.Fatal(err)
	}
}

func (harness *walletHarness) setCreatorStatus(userId, status string) {
	harness.T.Helper()
	query := "INSERT INTO " + pgx.Identifier{harness.creatorSchema, "creator_program_members"}.Sanitize() + " (user_id, status) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, suspended_at = CASE WHEN EXCLUDED.status = 'approved' THEN NULL ELSE creator_program_members.suspended_at END"
	if _, err := harness.Database.Exec(query, userId, status); err != nil {
		harness.T.Fatal(err)
	}
}

func (harness *walletHarness) suspendCreator(userId string) {
	harness.T.Helper()
	query := "UPDATE " + pgx.Identifier{harness.creatorSchema, "creator_program_members"}.Sanitize() + " SET suspended_at = NOW() WHERE user_id = $1"
	if _, err := harness.Database.Exec(query, userId); err != nil {
		harness.T.Fatal(err)
	}
}
