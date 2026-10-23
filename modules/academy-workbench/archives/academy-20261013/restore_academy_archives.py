#!/usr/bin/env python3
"""Verify and restore byte-exact academy archives. Standard library only.

This script never runs archived source code, accesses a network, changes a
repository, or deletes data. Existing different files and symbolic links fail.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import tarfile


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def safe_relative(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or any(x in ("", ".", "..") for x in path.parts):
        raise ValueError("Unsafe relative path: " + repr(value))
    if "\\" in value or "\x00" in value:
        raise ValueError("Unsafe path separator")
    return path


def guarded_path(root, relative):
    parts = safe_relative(relative).parts
    cursor = root
    if cursor.is_symlink():
        raise ValueError("Output root is a symbolic link")
    for part in parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise ValueError("Symbolic links are not accepted: " + str(cursor))
    return cursor


def load_verified_archive(root, bundle):
    manifest_path = guarded_path(root, bundle["manifestPath"])
    raw = manifest_path.read_bytes()
    if sha256(raw) != bundle["manifestSha256"]:
        raise ValueError("Bundle manifest digest mismatch: " + bundle["key"])
    manifest = json.loads(raw)
    pieces = []
    for part in manifest["transportFiles"]:
        data = guarded_path(root, part["path"]).read_bytes()
        if len(data) != part["bytes"] or sha256(data) != part["sha256"]:
            raise ValueError("Archive part mismatch: " + part["path"])
        pieces.append(data)
    archive = b"".join(pieces)
    expected = manifest["compressedArchive"]
    if len(archive) != expected["bytes"] or sha256(archive) != expected["sha256"]:
        raise ValueError("Reconstructed compressed archive digest mismatch")
    return manifest, archive


def verify_members(manifest, archive):
    expected = {row["archivePath"]: row for row in manifest["files"]}
    if len(expected) != len(manifest["files"]):
        raise ValueError("Duplicate manifest archive paths")
    seen = set()
    restored = set()
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as source:
        for member in source:
            safe_relative(member.name.rstrip("/"))
            if member.isdir():
                continue
            if not member.isfile() or member.issym() or member.islnk():
                raise ValueError("Only ordinary archive files are accepted")
            if member.name in seen or member.name not in expected:
                raise ValueError("Unexpected or duplicate archive file: " + member.name)
            row = expected[member.name]
            safe_relative(row["restoredPath"])
            if row["restoredPath"] in restored:
                raise ValueError("Duplicate restored path")
            if member.size != row["bytes"]:
                raise ValueError("Archive member size mismatch")
            with source.extractfile(member) as stream:
                data = stream.read()
            if len(data) != row["bytes"] or sha256(data) != row["sha256"]:
                raise ValueError("Archive member digest mismatch: " + member.name)
            seen.add(member.name)
            restored.add(row["restoredPath"])
    if seen != set(expected):
        raise ValueError("Archive is missing expected files")
    return expected


def restore_members(manifest, archive, output):
    expected = {row["archivePath"]: row for row in manifest["files"]}
    # Preflight every target before creating anything. Never replace a file.
    for row in expected.values():
        target = guarded_path(output, row["restoredPath"])
        if target.exists():
            if not target.is_file() or sha256(target.read_bytes()) != row["sha256"]:
                raise ValueError("Existing output conflicts: " + str(target))
    created = 0
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as source:
        for member in source:
            if member.isdir():
                continue
            row = expected[member.name]
            target = guarded_path(output, row["restoredPath"])
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target = guarded_path(output, row["restoredPath"])
            data = source.extractfile(member).read()
            # Exclusive creation prevents silently replacing an intervening file.
            with target.open("xb") as stream:
                stream.write(data)
            os.chmod(target, 0o600)
            created += 1
    return created


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", default="all", help="Bundle key, or all")
    parser.add_argument("--output", type=Path, help="Restore under this directory; omit for verification only")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    catalog = json.loads((root / "archive-catalog.json").read_text())
    selected = [b for b in catalog["bundles"] if args.bundle in ("all", b["key"])]
    if not selected:
        parser.error("Unknown bundle key")
    output = args.output.absolute() if args.output else None
    if output:
        # Check all existing ancestors, including ancestors outside output.
        for ancestor in [output, *output.parents]:
            if ancestor.is_symlink():
                raise ValueError("Output has a symbolic-link ancestor")
    verified = []
    for bundle in selected:
        manifest, archive = load_verified_archive(root, bundle)
        verify_members(manifest, archive)
        verified.append((bundle, manifest, archive))
    # Verification of all selected packages completes before restoration begins.
    results = []
    for bundle, manifest, archive in verified:
        created = restore_members(manifest, archive, output) if output else 0
        results.append({"bundle": bundle["key"], "verifiedFiles": len(manifest["files"]), "createdFiles": created})
    print(json.dumps({"verified": True, "restored": bool(output), "results": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
