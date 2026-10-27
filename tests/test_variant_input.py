"""The fork's input screen: the launcher's input, ported, off-device.

The fork's home screen lists the TV's HDMI inputs, and upstream opens them in the TV's own
app: it hands a passthrough URI to whatever claims it. On this TV that app is Amazon's
Live TV (which redirects to a channel scan) or Amazon's input player (a window of its own,
so BACK leaves the fork and the panel is not held awake by us).

The port brings the launcher's screen over (variant/src/io/freemytv/Input.java): TvView in
our own activity, so the picture is in a window of ours. That is what makes BACK come back
to the home screen and what holds the panel awake while there is a picture.

These tests read the sources as text. They cannot run them, but they can say that the port
is a port and not a copy of the launcher's file, that the manifest declares the screen, and
that the two rules the port has to keep - Amazon's Live TV is refused, and the maker's own
players still come first - are still in the file.
"""
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VARIANT = ROOT / 'variant'
INPUT = VARIANT / 'src' / 'io' / 'freemytv' / 'Input.java'
HOME_APPS = VARIANT / 'src' / 'io' / 'freemytv' / 'HomeApps.java'
LAUNCHER_INPUT = ROOT / 'launcher' / 'src' / 'tv' / 'dumbtv' / 'home' / 'Input.java'
MANIFEST = VARIANT / 'AndroidManifest.xml'
OUR_FILES = VARIANT / 'our-files.txt'
LOCAL_CHANGES = VARIANT / 'local-changes.txt'

ANDROID = '{http://schemas.android.com/apk/res/android}'


def input_text():
    """The ported input screen, as text."""
    return INPUT.read_text(encoding='utf-8')


def home_apps_text():
    """The adapted upstream file, as text."""
    return HOME_APPS.read_text(encoding='utf-8')


def listed(path):
    """The paths a list file holds, one per line, blanks dropped."""
    return [line.strip() for line in path.read_text(encoding='utf-8').splitlines()
            if line.strip()]


def body_of(text, signature):
    """The body of a Java method, from its signature to the next method.

    Text, not a parse: the point is to say that a particular call is inside a
    particular method, and a brace count is enough for that.
    """
    start = text.find(signature)
    if start < 0:
        raise AssertionError(f'{signature!r} is not in the file')
    rest = text[start:]
    depth = 0
    started = False
    for index, char in enumerate(rest):
        if char == '{':
            depth += 1
            started = True
        elif char == '}':
            depth -= 1
            if started and depth == 0:
                return rest[:index + 1]
    raise AssertionError(f'{signature!r} has no closing brace')


def manifest_activities():
    """The activities our manifest declares, by name."""
    root = ET.parse(MANIFEST).getroot()
    return {activity.get(ANDROID + 'name'): activity
            for activity in root.findall('application/activity')}


class InputPortTests(unittest.TestCase):
    def test_the_input_screen_is_in_the_variant_sources(self):
        self.assertTrue(INPUT.is_file(), INPUT)
        self.assertTrue(input_text().startswith('package io.freemytv;'))

    def test_it_is_ours_and_not_upstreams(self):
        # our-files.txt says which paths in the vendored tree are ours: an Input.java
        # that is not listed there would be compared with upstream's tree, which has
        # no such file, and the verifier would fail.
        self.assertIn('src/io/freemytv/Input.java', listed(OUR_FILES))

    def test_the_adapted_upstream_file_is_a_listed_local_change(self):
        # HomeApps.java is upstream's file and ours now: the verifier compares it with
        # upstream's and expects a difference, which local-changes.txt allows.
        self.assertIn('src/io/freemytv/HomeApps.java', listed(LOCAL_CHANGES))

    def test_the_port_has_no_leftover_of_the_launcher(self):
        # A leftover name would send the input to the launcher that works today, which
        # is the one thing the port must not do.
        self.assertNotIn('tv.dumbtv.home', input_text())

    def test_the_port_is_not_a_copy_of_the_launcher_s(self):
        # The launcher's file is a different program in a different package: the two
        # must not have been copied over one another.
        self.assertNotEqual(input_text(), LAUNCHER_INPUT.read_text(encoding='utf-8'))

    def test_the_picture_is_in_a_window_of_ours(self):
        # TvView, not an intent to another app: the picture has to be in our own window,
        # or there is nothing of ours to hold the panel awake with.
        text = input_text()
        self.assertIn('TvView', text)
        self.assertIn('view.tune(', text)
        self.assertIn('TvContract.buildChannelUriForPassthroughInput', text)

    def test_the_panel_is_held_awake_only_while_there_is_a_picture(self):
        # The flag goes on when the video arrives and comes off when it does not, so an
        # input left on a dead source still sleeps.
        body = body_of(input_text(), 'private void status(String text)')
        self.assertIn('addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)', body)
        self.assertIn('clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)', body)

    def test_amazons_live_tv_is_refused(self):
        # Amazon's Live TV claims every passthrough URI and then redirects to a channel
        # scan instead of showing the picture, so it is never the app that gets the input.
        body = body_of(input_text(), 'static Intent intent(Context c, HomeApps.Item it)')
        self.assertIn('com.amazon.tv.livetv', input_text())
        self.assertIn('viewerIsLiveTv', body)

    def test_the_input_is_released_when_the_screen_leaves(self):
        # The TV must stop routing the input when the screen goes away, or the picture
        # stays behind a home screen nobody is watching.
        self.assertIn('view.reset()', body_of(input_text(), 'protected void onStop()'))


class ManifestTests(unittest.TestCase):
    def test_the_input_screen_is_declared(self):
        activities = manifest_activities()
        self.assertIn('io.freemytv.Input', activities)

    def test_it_is_not_exported(self):
        # Only our own app opens it.
        self.assertEqual(manifest_activities()['io.freemytv.Input'].get(ANDROID + 'exported'),
                         'false')

    def test_it_shares_the_home_screen_s_process_and_task(self):
        # The input screen belongs to the home screen's task: BACK has to come back to
        # the home screen, and the home screen's process is where the fork already runs.
        activities = manifest_activities()
        self.assertEqual(activities['io.freemytv.Input'].get(ANDROID + 'process'),
                         activities['io.freemytv.HomeActivity'].get(ANDROID + 'process'))
        self.assertEqual(activities['io.freemytv.Input'].get(ANDROID + 'taskAffinity'),
                         activities['io.freemytv.HomeActivity'].get(ANDROID + 'taskAffinity'))


class HomeAppsTests(unittest.TestCase):
    """The adapted upstream file: how an input is opened, and what it tunes."""

    def test_an_input_goes_to_our_own_screen(self):
        body = body_of(home_apps_text(), 'static boolean open(Context a, Item it, android.os.Bundle options)')
        self.assertIn('Input.intent(a, it)', body)

    def test_the_maker_s_own_players_come_first(self):
        # On the boards where no app opens a passthrough input, only the maker's own
        # player reaches the TV's inputs: upstream's path, unchanged.
        body = body_of(home_apps_text(), 'static boolean open(Context a, Item it, android.os.Bundle options)')
        self.assertLess(body.index('noPassthrough(a)'), body.index('Input.intent(a, it)'))

    def test_the_tile_tunes_the_devices_own_input(self):
        # A device that talks HDMI-CEC has an input of its own, a child of the port's.
        # The tile is named after the device, so it has to tune the device's input and
        # not the port it is plugged into.
        text = home_apps_text()
        self.assertIn('deviceIds', text)
        self.assertIn('deviceIds.put(info.getParentId(), info.getId())', text)
        self.assertIn('it.inputId = deviceIds.containsKey(info.getId())', text)


if __name__ == '__main__':
    unittest.main()
