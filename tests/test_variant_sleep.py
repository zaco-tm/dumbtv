"""The sleep timer's end: the screen goes dark, over whatever is on it.

Off-device: the code is read from the tree and checked for the wiring the feature
promises — a black window over the app that plays, any key taking it off, and no ADB
anywhere on the way. Nothing here touches a TV.
"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VARIANT = ROOT / 'variant'
SRC = VARIANT / 'src/io/freemytv'


def read(name):
    return (SRC / name).read_text()


def method(text, signature):
    """The body of one method in a Java source, as text.

    `signature` is the method's declaration up to its arguments, so a call to the
    method elsewhere does not bring its body in.
    """
    start = text.index(signature + '(')
    open_brace = text.index('{', start)
    depth = 0
    for i in range(open_brace, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return text[open_brace:i + 1]
    raise AssertionError(f'{signature} has no closing brace')


class BlankTests(unittest.TestCase):
    """The blank: a black window over the whole screen, in the sleep timer's process."""

    def test_the_blank_is_a_file_of_ours(self):
        self.assertTrue((SRC / 'SleepBlank.java').is_file(), 'SleepBlank.java is missing')
        ours = [line.strip() for line in (VARIANT / 'our-files.txt').read_text().splitlines() if line.strip()]
        self.assertIn('src/io/freemytv/SleepBlank.java', ours)

    def test_it_is_declared_in_the_manifest(self):
        text = (VARIANT / 'AndroidManifest.xml').read_text()
        self.assertIn('io.freemytv.SleepBlank', text)
        # It is in the sleep timer's own process, the one the pill uses.
        self.assertIn('android:process=":sleep"', text)

    def test_the_window_is_black_and_over_everything(self):
        blank = read('SleepBlank.java')
        self.assertIn('setBackgroundColor(Color.BLACK)', blank)
        self.assertIn('WindowManager.LayoutParams.MATCH_PARENT', blank)
        self.assertIn('WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY', blank)
        # The panel's brightness goes to its lowest: the public way to do it. There is no
        # FLAG_KEEP_SCREEN_OFF in the API, and no app can put a TV to sleep.
        self.assertIn('BRIGHTNESS_OVERRIDE_OFF', blank)

    def test_any_key_takes_the_window_off(self):
        blank = read('SleepBlank.java')
        self.assertIn('setOnKeyListener', blank)
        self.assertIn('dismiss()', blank)

    def test_the_sound_pauses_and_comes_back(self):
        blank = read('SleepBlank.java')
        self.assertIn('AUDIOFOCUS_GAIN_TRANSIENT', blank)
        self.assertIn('abandonAudioFocusRequest', blank)

    def test_the_timer_ends_with_the_blank_and_not_with_adb(self):
        """Upstream puts the TV to sleep through the TV's own ADB, which the fork has none
        of: the timer's end is the blank."""
        timer = read('SleepTimer.java')
        fire = method(timer, 'static void fire')
        self.assertIn('SleepBlank.start(', fire)
        self.assertNotIn('Adb', fire)
        self.assertNotIn('KEYCODE_SLEEP', timer)

    def test_the_pill_is_still_the_minutes_left(self):
        """The pill is upstream's, and it stays: the timer still shows how much is left
        while it runs."""
        overlay = read('SleepOverlay.java')
        self.assertIn('Off in {time}', overlay)
        self.assertIn('TYPE_APPLICATION_OVERLAY', overlay)

    def test_the_row_needs_the_blank_and_not_the_adb(self):
        """The row is greyed out where the TV can't do what it asks. The fork's sleep timer
        needs the overlay permission, not upstream's Free My TV mode."""
        settings = read('SettingsActivity.java')
        need = method(settings, 'private String need')
        self.assertIn('Capabilities.NEED_BLANK', need)
        self.assertNotIn('Capabilities.NEED_ADB', need)

    def test_the_need_is_answered_by_the_overlay(self):
        capabilities = read('Capabilities.java')
        missing = method(capabilities, 'static String missing')
        self.assertIn('case NEED_BLANK', missing)
        self.assertIn('overlay(c)', missing)


if __name__ == '__main__':
    unittest.main()
