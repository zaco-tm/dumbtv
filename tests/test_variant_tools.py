"""The variant's hand-adapted tools, off-device.

`translate.py` is upstream's own tool with our paths in it, so it is hand-adapted
and nothing but running it says whether the adaptation still works. It is run in a
copy of the tree: its write modes rewrite the catalogues, and the vendored tree has
to stay upstream's byte for byte.
"""
import hashlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VARIANT = ROOT / 'variant'


def tree_digest(root):
    """A digest of every file in a tree, so a write is noticed."""
    digest = hashlib.sha256()
    for path in sorted(root.rglob('*')):
        if path.is_file():
            digest.update(str(path.relative_to(root)).encode('utf-8'))
            digest.update(path.read_bytes())
    return digest.hexdigest()


class TranslateToolTests(unittest.TestCase):
    def copy_of_the_tree(self, tmp):
        """A copy of the tree the tool reads: the sources, the catalogues, the tool."""
        tree = Path(tmp) / 'variant'
        (tree / 'tools').mkdir(parents=True)
        (tree / 'assets').mkdir(parents=True)
        shutil.copytree(VARIANT / 'src', tree / 'src')
        shutil.copytree(VARIANT / 'assets' / 'i18n', tree / 'assets' / 'i18n')
        shutil.copy(VARIANT / 'tools' / 'translate.py', tree / 'tools' / 'translate.py')
        return tree

    def test_the_check_mode_runs_without_crashing(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree = self.copy_of_the_tree(tmp)
            done = subprocess.run(
                [sys.executable, str(tree / 'tools' / 'translate.py'), '--check'],
                capture_output=True, text=True)
            # The exit code is not the point: --check exits non-zero out of the box,
            # because upstream's own catalogues carry eight keys the code no longer
            # uses. A traceback is the point.
            self.assertNotIn('Traceback', done.stdout)
            self.assertNotIn('Traceback', done.stderr)
            # It read our catalogues: it says which ones are out of date.
            self.assertIn('obsolete key', done.stdout)
            self.assertIn('en:', done.stdout)

    def test_the_check_mode_writes_nothing(self):
        # --check only reads. The write modes rewrite assets/i18n/en.json, and the
        # vendored tree must stay upstream's byte for byte.
        with tempfile.TemporaryDirectory() as tmp:
            tree = self.copy_of_the_tree(tmp)
            before = tree_digest(tree)
            subprocess.run([sys.executable, str(tree / 'tools' / 'translate.py'), '--check'],
                           capture_output=True, text=True)
            self.assertEqual(tree_digest(tree), before)


if __name__ == '__main__':
    unittest.main()
