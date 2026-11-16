package services_test

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"testing"

	"nantty/modules/users/src/modules/dataExport/services"
)

func TestBuildZipArchiveWritesOneJsonFilePerSection(t *testing.T) {
	contents := services.ArchiveContents{"profiles.json": []map[string]any{{"handle": "ada"}}, "manifest.json": map[string]any{"scope": "users"}}
	raw, err := services.BuildZipArchive(contents)
	if err != nil {
		t.Fatal(err)
	}
	reader, err := zip.NewReader(bytes.NewReader(raw), int64(len(raw)))
	if err != nil || len(reader.File) != 2 {
		t.Fatalf("want 2 files, got %v %v", len(reader.File), err)
	}
	for _, file := range reader.File {
		opened, _ := file.Open()
		body, _ := io.ReadAll(opened)
		var decoded any
		if err := json.Unmarshal(body, &decoded); err != nil {
			t.Errorf("%s is not valid JSON: %v", file.Name, err)
		}
	}
}
