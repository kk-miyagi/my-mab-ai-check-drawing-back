import os
import time
import shutil


def _safe_dest(dest_dir, name, now):
    dest = os.path.join(dest_dir, name)
    if not os.path.exists(dest):
        return dest
    base = f"{name}_{int(now)}"
    candidate = os.path.join(dest_dir, base)
    counter = 1
    while os.path.exists(candidate):
        candidate = os.path.join(dest_dir, f"{base}_{counter}")
        counter += 1
    return candidate


def move_hash_key_dirs(source_dirs, deletion_dir, hash_key, now=None):
    if now is None:
        now = time.time()
    moved = []
    for src in source_dirs:
        if not os.path.isdir(src):
            continue
        for name in os.listdir(src):
            src_path = os.path.join(src, name)
            if not os.path.isdir(src_path):
                continue
            if name == hash_key or name.startswith(hash_key + "_"):
                category = os.path.basename(os.path.normpath(src))
                dest_dir = os.path.join(deletion_dir, category)
                dest = _safe_dest(dest_dir, name, now)
                os.makedirs(dest_dir, exist_ok=True)
                shutil.move(src_path, dest)
                moved.append(
                    {"source": src, "name": name, "dest": dest})
    return {
        "hash_key": hash_key,
        "moved": moved,
        "moved_count": len(moved),
    }
