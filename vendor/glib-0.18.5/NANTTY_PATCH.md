# Nantty glib patch

This directory contains the unmodified `glib` 0.18.5 crates.io source except for `src/variant_iter.rs`, where `VariantStrIter::impl_get` now passes `&mut p` to `g_variant_get_child` so the C out-parameter is writable. This addresses GHSA-wrw7-89jp-8q8g / RUSTSEC-2024-0429 in the Linux GTK3 dependency graph used by the Nantty admin desktop.

The patch is scoped to `apps/admin/src-tauri/Cargo.toml`. Remove it when the supported Tauri Linux runtime dependency graph no longer uses vulnerable GLib GTK3 bindings, then verify the resolved dependency graph and the downstream advisory status before deleting the vendored source.

Upstream source: https://crates.io/crates/glib/0.18.5
Upstream fix reference: https://github.com/gtk-rs/gtk-rs-core/pull/1343 (commit `b5a4071e439bef2b5eea76c3aa25e5ae84839e34`)
