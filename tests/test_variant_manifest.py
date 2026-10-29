"""The variant's manifest and its permissions list, off-device.

The manifest and permissions.txt are two hand-kept copies of upstream's eight permissions:
they agree today, and nothing but a build on a machine with the Android SDK would say so.
This test reads both as text, so the drift is caught without the SDK.

It also compares our manifest with upstream's own, which is vendored byte for byte at
variant/upstream/. The two must differ in exactly the changes variant/UPSTREAM.md
documents, and in nothing else: a manifest that drifted away from upstream's would
otherwise go unnoticed, because upstream's manifest is not part of the vendored tree.
"""
import re
import unittest
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'variant' / 'AndroidManifest.xml'
UPSTREAM_MANIFEST = ROOT / 'variant' / 'upstream' / 'AndroidManifest.xml'
PERMISSIONS = ROOT / 'variant' / 'permissions.txt'
PHOTOS = ROOT / 'variant' / 'tools' / 'photos.py'

# The attributes are in the android namespace; the elements are not.
ANDROID = '{http://schemas.android.com/apk/res/android}'
PACKAGE = 'io.freemytv'
AUTHORITY = 'tv.dumbtv.variant.photos'

# The components whose name is ours to change: upstream's names are relative to the
# manifest's package, and aapt2 renames that package to tv.dumbtv.variant.
COMPONENT_TAGS = ('application', 'activity', 'service', 'provider', 'receiver')


def manifest_root():
    """The manifest's root element."""
    return ET.parse(MANIFEST).getroot()


def upstream_root():
    """Upstream's own manifest, as vendored."""
    return ET.parse(UPSTREAM_MANIFEST).getroot()


def manifest_permissions():
    """The uses-permission names, in the order the manifest lists them."""
    root = manifest_root()
    return [e.get(ANDROID + 'name') for e in root.findall('uses-permission')]


def manifest_permission_lines():
    """The uses-permission lines the manifest declares, as aapt2 prints them.

    The attribute on SCHEDULE_EXACT_ALARM (android:maxSdkVersion="32") is part of the
    line: a manifest without it would ask for the exact alarm on every Android version.
    """
    lines = []
    for element in manifest_root().findall('uses-permission'):
        line = f"uses-permission: name='{element.get(ANDROID + 'name')}'"
        cap = element.get(ANDROID + 'maxSdkVersion')
        if cap is not None:
            line += f" maxSdkVersion='{cap}'"
        lines.append(line)
    return lines


def listed_permission_lines():
    """The lines in permissions.txt, blank lines dropped."""
    text = PERMISSIONS.read_text(encoding='utf-8')
    return [line.strip() for line in text.splitlines() if line.strip()]


def listed_permissions():
    """The permission names in permissions.txt, in order."""
    names = []
    for line in listed_permission_lines():
        match = re.search(r"name='([^']+)'", line)
        if match is None:
            raise AssertionError(f'permissions.txt has a line without a name: {line}')
        names.append(match.group(1))
    return names


def _describe(element):
    """A short description of an element, for a message."""
    name = element.get(ANDROID + 'name')
    return element.tag if name is None else f'{element.tag} {name}'


def _differences(upstream, ours, path, parent=None):
    """Every difference between two elements, as (kind, path, upstream, ours).

    The children are paired by position: the two manifests hold the same components in
    the same order, so a difference in one is a difference in the other.
    """
    found = []
    if upstream.tag != ours.tag:
        return [('element', path, upstream.tag, ours.tag)]
    for name in sorted(set(upstream.attrib) | set(ours.attrib)):
        if upstream.attrib.get(name) != ours.attrib.get(name):
            # The short name in the path: the android namespace is a URL, and a path
            # with slashes in it cannot be read.
            short = name.split('}')[-1] if name.startswith('{') else name
            found.append(('attribute', f'{path}/@{short}',
                          upstream.attrib.get(name), ours.attrib.get(name)))
    if (upstream.text or '').strip() != (ours.text or '').strip():
        found.append(('text', path, (upstream.text or '').strip(), (ours.text or '').strip()))
    upstream_children = list(upstream)
    our_children = list(ours)
    for index in range(min(len(upstream_children), len(our_children))):
        child = upstream_children[index]
        found += _differences(child, our_children[index],
                              f'{path}/{child.tag}[{index}]', upstream)
    for index in range(len(our_children), len(upstream_children)):
        child = upstream_children[index]
        found.append(('removed', f'{path}/{child.tag}[{index}]',
                      _describe(child), None))
    for index in range(len(upstream_children), len(our_children)):
        child = our_children[index]
        found.append(('added', f'{path}/{child.tag}[{index}]', None, _describe(child)))
    return found


def manifest_differences():
    """The differences between upstream's manifest and ours."""
    return _differences(upstream_root(), manifest_root(), 'manifest')


def _parent_of(path):
    """The tag of the element a path points into."""
    parts = path.split('/')
    if len(parts) < 2:
        return ''
    return re.sub(r'\[\d+\]$', '', parts[-2])


def classify(difference):
    """The documented change a difference belongs to.

    An undocumented difference is returned as it is, so the test can name it.
    """
    kind, path, upstream, ours = difference
    if kind == 'attribute':
        name = path.rsplit('/', 1)[-1]
        if name == '@label':
            return ('label', upstream, ours)
        if name in ('@versionCode', '@versionName'):
            return ('version', upstream, ours)
        if name == '@authorities':
            return ('provider authority', upstream, ours)
        if name == '@banner':
            return ('banner', upstream, ours)
        if name == '@taskAffinity':
            return ('task affinity', upstream, ours)
        if name == '@name' and _parent_of(path) in COMPONENT_TAGS:
            return ('component name', upstream, ours)
    if kind == 'removed' and upstream in ('category android.intent.category.HOME',
                                          'category android.intent.category.DEFAULT'):
        return ('home category', upstream.split(' ', 1)[1], ours)
    if kind == 'added' and ours == 'service io.freemytv.Guard':
        # Ours, and ours only: the Guard takes the HOME key on Fire OS, where no
        # third-party app can be the home app. Upstream declares no such service.
        return ('guard service', upstream, ours)
    if kind == 'added' and ours == 'activity io.freemytv.Input':
        # Ours, and ours only: the input screen. The picture is in a window of ours, so
        # BACK comes back to the home screen and the panel stays awake. Upstream opens an
        # input in the TV's own app and declares no activity of its own for it.
        return ('input activity', upstream, ours)
    if kind == 'added' and ours == 'service io.freemytv.SleepBlank':
        # Ours, and ours only: the sleep timer's end. The screen goes dark over whatever
        # is on it, with a black window and the screen kept off. Upstream puts the TV to
        # sleep through the TV's own ADB, and declares no service of its own for it.
        return ('blank service', upstream, ours)
    return ('UNDOCUMENTED', f'{path}: {upstream} -> {ours}', kind)


def describe(difference):
    """A line naming one difference, for a failure message."""
    kind, path, upstream, ours = difference
    return f'{path}: {upstream} -> {ours} ({kind})'


# The changes variant/UPSTREAM.md documents, and nothing else.
EXPECTED = Counter([
    ('version', '3', '1'),
    ('version', '1.2', '1.0'),
    ('provider authority', 'io.freemytv.photos', 'tv.dumbtv.variant.photos'),
    ('component name', '.App', 'io.freemytv.App'),
    ('component name', '.SettingsActivity', 'io.freemytv.SettingsActivity'),
    ('component name', '.HomeActivity', 'io.freemytv.HomeActivity'),
    ('component name', '.FireHomeActivity', 'io.freemytv.FireHomeActivity'),
    ('component name', '.Screensaver', 'io.freemytv.Screensaver'),
    ('component name', '.ScreensaverAlone', 'io.freemytv.ScreensaverAlone'),
    ('component name', '.ModeJob', 'io.freemytv.ModeJob'),
    ('component name', '.RemoteKeyService', 'io.freemytv.RemoteKeyService'),
    ('component name', '.PhotoInbox', 'io.freemytv.PhotoInbox'),
    ('component name', '.SleepOverlay', 'io.freemytv.SleepOverlay'),
    ('component name', '.NowPlaying', 'io.freemytv.NowPlaying'),
    ('component name', '.HomeReceiver', 'io.freemytv.HomeReceiver'),
    ('home category', 'android.intent.category.HOME', None),
    ('home category', 'android.intent.category.DEFAULT', None),
    ('banner', '@drawable/banner', '@drawable/banner_variant'),
    # Ours, and ours only: the Guard that takes the HOME key on Fire OS.
    ('guard service', None, 'service io.freemytv.Guard'),
    # Ours, and ours only: the input screen, with the picture in a window of ours.
    ('input activity', None, 'activity io.freemytv.Input'),
    # Ours, and ours only: the sleep timer's end, which puts the screen in the dark.
    ('blank service', None, 'service io.freemytv.SleepBlank'),
    # The label is on the application and on the seven components that carry one.
    *([('label', 'Free My TV', 'dumbtv home (variant)')] * 8),
    # The task affinity is on two activities.
    *([('task affinity', 'io.freemytv.settings', 'tv.dumbtv.variant.settings')] * 2),
])



class VariantManifestTests(unittest.TestCase):
    def test_the_manifest_asks_for_the_permissions_the_list_names(self):
        self.assertEqual(manifest_permissions(), listed_permissions())

    def test_the_list_holds_the_whole_permission_line(self):
        # The line aapt2 prints carries the attribute: SCHEDULE_EXACT_ALARM is capped
        # at SDK 32. Comparing the names only would not notice a dropped cap.
        self.assertEqual(manifest_permission_lines(), listed_permission_lines())

    def test_the_exact_alarm_is_capped(self):
        self.assertIn("uses-permission: name='android.permission.SCHEDULE_EXACT_ALARM' "
                      "maxSdkVersion='32'", listed_permission_lines())

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

    def test_the_banner_is_ours(self):
        # The launcher draws the banner as the app's tile, and upstream's banner has the
        # words "Free My TV" in the picture: the variant's tile in the APPS row said the
        # wrong name. Ours points at our own drawable, which has to be there.
        application = manifest_root().find('application')
        self.assertEqual(application.get(ANDROID + 'banner'), '@drawable/banner_variant')
        self.assertTrue((ROOT / 'variant' / 'res' / 'drawable-nodpi' / 'banner_variant.png').is_file())

    def test_photos_py_writes_to_the_same_authority(self):
        # The photos tool writes to the provider; if the two drift apart, the photos
        # never arrive and nothing says why.
        self.assertIn('content://' + AUTHORITY, PHOTOS.read_text(encoding='utf-8'))

    def test_the_guard_service_is_declared(self):
        # The Guard is how the fork owns the HOME key on Fire OS: Amazon's launcher is
        # protected there and no third-party app can be the home app, so an
        # accessibility service takes the key instead. The service needs the
        # permission that binds it and the filter the system looks for.
        services = [service for service in manifest_root().findall('application/service')
                    if service.get(ANDROID + 'name') == 'io.freemytv.Guard']
        self.assertEqual(len(services), 1)
        service = services[0]
        self.assertEqual(service.get(ANDROID + 'permission'),
                         'android.permission.BIND_ACCESSIBILITY_SERVICE')
        actions = [action.get(ANDROID + 'name')
                   for action in service.findall('intent-filter/action')]
        self.assertIn('android.accessibilityservice.AccessibilityService', actions)

    def test_the_guard_points_at_a_configuration_that_exists(self):
        # The meta-data names a resource. A manifest that pointed at a file that is not
        # there would not fail the build: it would fail on the TV, with the service
        # quietly not working and nothing to say why.
        service = [service for service in manifest_root().findall('application/service')
                   if service.get(ANDROID + 'name') == 'io.freemytv.Guard'][0]
        metadata = {meta.get(ANDROID + 'name'): meta.get(ANDROID + 'resource')
                    for meta in service.findall('meta-data')}
        resource = metadata.get('android.accessibilityservice')
        self.assertIsNotNone(resource)
        self.assertTrue(resource.startswith('@xml/'), resource)
        path = ROOT / 'variant' / 'res' / (resource[1:] + '.xml')
        self.assertTrue(path.is_file(), path)

    def test_the_guard_service_says_whether_it_is_exported(self):
        # This APK targets 33. Android 12 refuses to install a component that declares an
        # intent filter without an explicit android:exported, so a manifest that leaves it
        # out installs on this Fire TV (Android 11) and fails on every newer one.
        # "true" is right: the system binds the service from another uid, and
        # android.permission.BIND_ACCESSIBILITY_SERVICE is what guards it.
        service = [service for service in manifest_root().findall('application/service')
                   if service.get(ANDROID + 'name') == 'io.freemytv.Guard'][0]
        self.assertEqual(service.get(ANDROID + 'exported'), 'true',
                         'the Guard service has no android:exported')

    def test_the_guard_service_carries_our_own_label(self):
        # The label is what the TV's accessibility settings show, and what
        # "dumpsys accessibility" names a bound service by.
        service = [service for service in manifest_root().findall('application/service')
                   if service.get(ANDROID + 'name') == 'io.freemytv.Guard'][0]
        self.assertEqual(service.get(ANDROID + 'label'), '@string/guard_label')


class ManifestDiffTests(unittest.TestCase):
    """Our manifest against upstream's, which is vendored byte for byte."""

    def test_the_vendored_manifest_is_upstreams(self):
        # The record of what upstream's looked like: it must be upstream's file, not a
        # copy of ours. The verifier proves it byte for byte against the pinned commit;
        # this is the cheap half: ours must not have crept into that file.
        upstream_text = UPSTREAM_MANIFEST.read_text(encoding='utf-8')
        self.assertIn('Free My TV', upstream_text)
        self.assertNotIn('dumbtv', upstream_text)

    def test_the_differences_are_the_documented_ones(self):
        differences = manifest_differences()
        found = Counter(classify(difference) for difference in differences)
        if found == EXPECTED:
            return
        report = []
        for item in EXPECTED - found:
            report.append(f'missing: {item}')
        for item in found - EXPECTED:
            report.append(f'undocumented: {item}')
        report.append('every difference between the two manifests:')
        for difference in differences:
            report.append('  ' + describe(difference))
        self.fail('\n'.join(report))

    def test_every_documented_change_is_there(self):
        # The other half of the same check: each documented change must actually be
        # in the manifest, not only allowed by it.
        found = Counter(classify(difference)[0] for difference in manifest_differences())
        for kind in ('label', 'version', 'provider authority', 'task affinity',
                     'component name', 'home category', 'banner', 'guard service',
                     'input activity'):
            with self.subTest(kind=kind):
                self.assertTrue(found[kind] > 0, kind)

    def test_the_variant_is_not_a_home_app_candidate(self):
        # The variant must not be able to take the HOME key from tv.dumbtv.home: on
        # this TV the home screen is bound through the Guard, and a HOME category
        # would make the variant a home-app candidate as well.
        categories = []
        for activity in manifest_root().findall('application/activity'):
            for category in activity.findall('intent-filter/category'):
                categories.append(category.get(ANDROID + 'name'))
        self.assertNotIn('android.intent.category.HOME', categories)
        self.assertNotIn('android.intent.category.DEFAULT', categories)

    def test_the_app_is_still_in_the_launcher(self):
        # Without the HOME category the variant still has to be launchable from the
        # TV's app row: SettingsActivity carries the launcher categories.
        categories = []
        for activity in manifest_root().findall('application/activity'):
            name = activity.get(ANDROID + 'name')
            for category in activity.findall('intent-filter/category'):
                categories.append((name, category.get(ANDROID + 'name')))
        self.assertIn(('io.freemytv.SettingsActivity', 'android.intent.category.LEANBACK_LAUNCHER'),
                      categories)
        self.assertIn(('io.freemytv.SettingsActivity', 'android.intent.category.LAUNCHER'),
                      categories)


if __name__ == '__main__':
    unittest.main()
