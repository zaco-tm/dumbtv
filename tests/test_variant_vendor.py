"""Checks for the vendor proof: variant/verify-vendor.sh, against a made-up upstream tree.

Nothing here touches the network or the repo: the verifier is copied into a temporary
directory, pointed at a synthesized upstream archive (through DUMBTV_VARIANT_TARBALL)
and run there, against a tree built in the same temporary directory.
"""
import hashlib
import os
import re
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'variant/verify-vendor.sh'

# upstream's path, our path, what the file holds.
FILES = [
    ('app/src/io/freemytv/Ui.java', 'src/io/freemytv/Ui.java', 'class Ui {}\n'),
    ('app/src/io/freemytv/Config.java', 'src/io/freemytv/Config.java', 'class Config {}\n'),
    ('app/res/values/strings.xml', 'res/values/strings.xml', '<resources/>\n'),
    ('app/assets/i18n/en.json', 'assets/i18n/en.json', '{}\n'),
    ('tools/photos.py', 'tools/photos.py', '# upstream photos\n'),
    ('tools/translate.py', 'tools/translate.py', '# upstream translate\n'),
    ('LICENSE', 'LICENSE.free-my-tv', 'MIT\n'),
]
# upstream's tools/ holds more scripts than we vendored: they are not ours to compare.
ALSO_UPSTREAM = [('tools/check.sh', '# upstream check\n')]


class VendorTests(unittest.TestCase):
    def setUp(self):
        self.script_text = SCRIPT.read_text()
        self.commit = re.search(r'^COMMIT=(\S+)$', self.script_text, re.M).group(1)
        self.pinned = re.search(r'^SHA256=(\S+)$', self.script_text, re.M).group(1)

    @staticmethod
    def write(path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

    def fixture(self, tmp, *, listed=(), changed=(), missing=(), extra=(), ours=()):
        """Builds a fake upstream archive and our tree beside it; returns (tree, archive)."""
        upstream = tmp / ('free-my-tv-' + self.commit)
        for up_rel, _, content in FILES:
            self.write(upstream / up_rel, content)
        for up_rel, content in ALSO_UPSTREAM:
            self.write(upstream / up_rel, content)
        archive = tmp / 'up.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            tar.add(upstream, arcname=upstream.name)

        tree = tmp / 'variant'
        for _, our_rel, content in FILES:
            if our_rel in missing:
                continue
            body = content + ('# changed\n' if our_rel in changed else '')
            self.write(tree / our_rel, body)
        for our_rel, content in extra:
            self.write(tree / our_rel, content)
        self.write(tree / 'local-changes.txt', ''.join(p + '\n' for p in listed))
        self.write(tree / 'our-files.txt', ''.join(p + '\n' for p in ours))
        return tree, archive

    def run_verifier(self, tree, archive, *, patch_hash=True):
        """Runs a copy of the verifier in the tree, against the archive."""
        script = tree / 'verify-vendor.sh'
        text = self.script_text
        if patch_hash:
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            text = re.sub(r'^SHA256=.*$', 'SHA256=' + digest, text, flags=re.M)
        script.write_text(text)
        script.chmod(0o755)
        env = dict(os.environ, DUMBTV_VARIANT_TARBALL=str(archive))
        return subprocess.run(['bash', str(script)], env=env, text=True, capture_output=True)

    def test_an_identical_tree_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp))
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn('vendor tree matches upstream ' + self.commit, result.stdout)

    def test_a_changed_app_file_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp), changed=['src/io/freemytv/Ui.java'])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 1)
            self.assertIn('CHANGED: src/io/freemytv/Ui.java', result.stdout)

    def test_a_missing_file_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp), missing=['res/values/strings.xml'])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 1)
            self.assertIn('MISSING: res/values/strings.xml', result.stdout)

    def test_an_extra_file_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp), extra=[('res/values/extra.xml', '<x/>\n')])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 1)
            self.assertIn('EXTRA: res/values/extra.xml', result.stdout)

    def test_a_changed_tool_fails(self):
        # The tools are ours to adapt, but only when local-changes.txt says so.
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp), changed=['tools/photos.py'])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 1)
            self.assertIn('CHANGED: tools/photos.py', result.stdout)

    def test_a_changed_licence_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp), changed=['LICENSE.free-my-tv'])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 1)
            self.assertIn('CHANGED: LICENSE.free-my-tv', result.stdout)

    def test_an_extra_tool_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp), extra=[('tools/sneaky.py', '# ours\n')])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 1)
            self.assertIn('EXTRA: tools/sneaky.py', result.stdout)

    def test_a_file_of_ours_is_not_extra(self):
        # our-files.txt holds the paths that are ours, not upstream's: they are not
        # compared with upstream (there is no upstream file) and are not extra.
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp),
                                        extra=[('tools/gen_config.py', '# ours\n')],
                                        ours=['tools/gen_config.py'])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertNotIn('EXTRA', result.stdout)
            self.assertNotIn('CHANGED', result.stdout)
            self.assertIn('vendor tree matches upstream ' + self.commit, result.stdout)

    def test_a_file_that_is_neither_upstream_s_nor_ours_is_still_extra(self):
        # our-files.txt only excuses the paths it lists: any other file of ours that
        # upstream does not have is still extra.
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp),
                                        extra=[('tools/gen_config.py', '# ours\n'),
                                               ('tools/sneaky.py', '# sneaky\n')],
                                        ours=['tools/gen_config.py'])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 1)
            self.assertIn('EXTRA: tools/sneaky.py', result.stdout)
            self.assertNotIn('EXTRA: tools/gen_config.py', result.stdout)

    def test_a_file_of_ours_that_upstream_also_has_fails(self):
        # our-files.txt must not become a loophole: a path upstream has cannot be
        # excused as "ours", because it must then be compared byte for byte.
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp),
                                        changed=['tools/photos.py'],
                                        ours=['tools/photos.py'])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 1)
            self.assertIn("OURS BUT UPSTREAM'S: tools/photos.py", result.stdout)

    def test_an_our_file_in_a_vendored_tree_is_not_compared(self):
        # A file of ours inside src/ must not be compared with upstream's src/ either.
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp),
                                        extra=[('src/io/freemytv/Ours.java', 'class Ours {}\n')],
                                        ours=['src/io/freemytv/Ours.java'])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertNotIn('EXTRA', result.stdout)
            self.assertIn('vendor tree matches upstream ' + self.commit, result.stdout)

    def test_the_translate_cache_is_not_extra(self):
        # tools/translate.py writes its cache into tools/: it is not upstream's and it
        # is git-ignored, so it must not fail the proof.
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp),
                                        extra=[('tools/.i18n-cache.json', '{}\n')])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertNotIn('EXTRA', result.stdout)
            self.assertIn('vendor tree matches upstream ' + self.commit, result.stdout)

    def test_a_listed_changed_file_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp), listed=['tools/photos.py'],
                                        changed=['tools/photos.py'])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn('changed (listed): tools/photos.py', result.stdout)

    def test_a_listed_but_unchanged_file_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp), listed=['tools/photos.py'])
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 1)
            self.assertIn('LISTED BUT UNCHANGED: tools/photos.py', result.stdout)

    def test_upstream_tools_we_do_not_vendor_are_not_missing(self):
        # upstream's tools/ has scripts we did not take: they are not part of our tree.
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp))
            result = self.run_verifier(tree, archive)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertNotIn('check.sh', result.stdout)

    def test_an_archive_that_is_not_the_pinned_one_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree, archive = self.fixture(Path(tmp))
            result = self.run_verifier(tree, archive, patch_hash=False)
            self.assertEqual(result.returncode, 1)
            self.assertIn('expected ' + self.pinned, result.stdout)
            self.assertIn('actual', result.stdout)

    def test_the_pinned_hash_is_recorded(self):
        self.assertRegex(self.pinned, r'^[0-9a-f]{64}$')


if __name__ == '__main__':
    unittest.main()
