"""The variant's manifest and its permissions list, off-device.

The manifest and permissions.txt are two hand-kept copies of upstream's eight permissions:
they agree today, and nothing but a build on a machine with the Android SDK would say so.
This test reads both as text, so the drift is caught without the SDK.
"""
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'variant' / 'AndroidManifest.xml'
PERMISSIONS = ROOT / 'variant' / 'permissions.txt'
PHOTOS = ROOT / 'variant' / 'tools' / 'photos.py'

# The attributes are in the android namespace; the elements are not.
ANDROID = '{http://schemas.android.com/apk/res/android}'
PACKAGE = 'io.freemytv'
AUTHORITY = 'tv.dumbtv.variant.photos'


def manifest_root():
    """The manifest's root element."""
    return ET.parse(MANIFEST).getroot()


def manifest_permissions():
    """The uses-permission names, in the order the manifest lists them."""
    root = manifest_root()
    return [e.get(ANDROID + 'name') for e in root.findall('uses-permission')]


def listed_permissions():
    """The names in permissions.txt, one per line, blank lines dropped."""
    text = PERMISSIONS.read_text(encoding='utf-8')
    return [line.strip() for line in text.splitlines() if line.strip()]


class VariantManifestTests(unittest.TestCase):
    def test_the_manifest_asks_for_the_permissions_the_list_names(self):
        self.assertEqual(manifest_permissions(), listed_permissions())

    def test_there_are_eight_of_them(self):
        self.assertEqual(len(listed_permissions()), 8)

    def test_every_permission_is_an_android_one(self):
        for name in manifest_permissions():
            with self.subTest(name=name):
                self.assertTrue(name.startswith('android.permission.'), name)

    def test_the_package_is_upstreams(self):
        # The manifest package stays io.freemytv: the code and the generated R live there.
        # The application id is ours, but aapt2 gives it that at link time.
        self.assertEqual(manifest_root().get('package'), PACKAGE)

    def test_the_provider_authority_is_ours(self):
        providers = manifest_root().findall('application/provider')
        self.assertEqual(len(providers), 1)
        self.assertEqual(providers[0].get(ANDROID + 'authorities'), AUTHORITY)

    def test_photos_py_writes_to_the_same_authority(self):
        # The photos tool writes to the provider; if the two drift apart, the photos
        # never arrive and nothing says why.
        self.assertIn('content://' + AUTHORITY, PHOTOS.read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
