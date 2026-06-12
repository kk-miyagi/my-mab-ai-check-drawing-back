import os
import shutil


def delete_hash_key_dirs(source_dirs, hash_key):
    """source_dirs 配下で hash_key（完全一致 or "hash_key_" 前方一致）の
    ディレクトリを物理削除する。"""
    deleted = []
    for src in source_dirs:
        if not os.path.isdir(src):
            continue
        for name in os.listdir(src):
            src_path = os.path.join(src, name)
            if not os.path.isdir(src_path):
                continue
            if name == hash_key or name.startswith(hash_key + "_"):
                shutil.rmtree(src_path)
                deleted.append({"source": src, "name": name})
    return {
        "hash_key": hash_key,
        "deleted": deleted,
        "deleted_count": len(deleted),
    }
