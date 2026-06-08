import os
from tools.retention_delete import move_hash_key_dirs


def _mk(src_dir, name):
    d = src_dir / name
    d.mkdir(parents=True)
    (d / "f.txt").write_text("x", encoding="utf-8")
    return d


def test_moves_dirs_matching_hash_key_prefix(tmp_path):
    src = tmp_path / "multi-fileupload"
    src.mkdir()
    deletion = tmp_path / "to-delete"
    _mk(src, "u_e_g_op_opid")          # matches prefix "u_e_g_"
    _mk(src, "u_e_g")                  # matches exact
    _mk(src, "other_x_y_op_opid")      # must NOT match
    rep = move_hash_key_dirs([str(src)], str(deletion), "u_e_g")
    assert rep["moved_count"] == 2
    assert (src / "other_x_y_op_opid").is_dir()
    assert (deletion / "multi-fileupload" / "u_e_g_op_opid").is_dir()
    assert (deletion / "multi-fileupload" / "u_e_g").is_dir()


def test_skips_missing_source_dir(tmp_path):
    rep = move_hash_key_dirs([str(tmp_path / "nope")], str(tmp_path / "del"), "u_e_g")
    assert rep["moved_count"] == 0


def test_collision_safe(tmp_path):
    src = tmp_path / "multi-fileupload"
    src.mkdir()
    deletion = tmp_path / "to-delete"
    _mk(src, "u_e_g_op_opid")
    pre = deletion / "multi-fileupload" / "u_e_g_op_opid"
    pre.mkdir(parents=True)
    rep = move_hash_key_dirs([str(src)], str(deletion), "u_e_g", now=1234567890)
    assert rep["moved_count"] == 1
    assert os.path.basename(rep["moved"][0]["dest"]) == "u_e_g_op_opid_1234567890"
