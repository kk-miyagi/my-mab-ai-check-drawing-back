from tools.retention_delete import delete_hash_key_dirs


def _mk(src_dir, name):
    d = src_dir / name
    d.mkdir(parents=True)
    (d / "f.txt").write_text("x", encoding="utf-8")
    return d


def test_deletes_dirs_matching_hash_key_prefix(tmp_path):
    src = tmp_path / "multi-fileupload"
    src.mkdir()
    _mk(src, "u_e_g_op_opid")          # khớp prefix "u_e_g_"
    _mk(src, "u_e_g")                  # khớp đúng
    _mk(src, "other_x_y_op_opid")      # KHÔNG được khớp
    rep = delete_hash_key_dirs([str(src)], "u_e_g")
    assert rep["deleted_count"] == 2
    assert not (src / "u_e_g_op_opid").exists()
    assert not (src / "u_e_g").exists()
    assert (src / "other_x_y_op_opid").is_dir()


def test_does_not_create_staging_dir(tmp_path):
    src = tmp_path / "multi-fileupload"
    src.mkdir()
    _mk(src, "u_e_g")
    delete_hash_key_dirs([str(src)], "u_e_g")
    assert not (tmp_path / "to-delete").exists()


def test_skips_missing_source_dir(tmp_path):
    rep = delete_hash_key_dirs([str(tmp_path / "nope")], "u_e_g")
    assert rep["deleted_count"] == 0
