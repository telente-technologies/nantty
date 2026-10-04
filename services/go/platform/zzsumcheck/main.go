package main

import (
	"fmt"
	"os"

	"ariga.io/atlas/sql/migrate"
	"ariga.io/atlas/cmd/atlas/x"
)

var _ = x.Version

func main() {
	for _, p := range os.Args[1:] {
		d, err := sqltoolDir(p)
		if err == nil {
			err = migrate.Validate(d)
		}
		fmt.Println(p, err)
	}
}
