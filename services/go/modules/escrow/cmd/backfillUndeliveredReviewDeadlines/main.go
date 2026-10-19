package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"

	"zudomart/modules/escrow/src/configs"
	"zudomart/modules/escrow/src/modules/escrows/services"
	platformconfig "zudomart/platform/config"
)

func main() {
	apply := flag.Bool("apply", false, "write the deadlines; without it the command only counts the escrows it would change")
	flag.Parse()
	settings := configs.ReadEscrowSettingsFromEnvironment(platformconfig.NewEnvironmentReader())
	database, err := sql.Open("pgx", settings.Money.DatabaseUrl)
	if err != nil {
		exit(err)
	}
	defer database.Close()
	count, err := services.BackfillUndeliveredReviewDeadlines(context.Background(), database, settings.Money.DatabaseSchema, settings.UndeliveredReleaseWindow(), !*apply)
	if err != nil {
		exit(err)
	}
	verb := "would get"
	if *apply {
		verb = "got"
	}
	fmt.Printf("%d held, undelivered escrows %s a review deadline of hold + %s\n", count, verb, settings.UndeliveredReleaseWindow())
}

func exit(err error) {
	fmt.Fprintln(os.Stderr, "backfill undelivered review deadlines:", err)
	os.Exit(1)
}
