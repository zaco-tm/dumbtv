"""The fork's Guard: dumbtv home's HOME takeover, ported, off-device.

Fire OS gives the HOME key to Amazon's protected launcher, and no third-party app can be
the home app there, so the only way to own HOME is a Guard: an accessibility service that
waits for Amazon's home window and covers it with ours. The fork carries one now
(variant/src/io/freemytv/Guard.java), and these tests read it as text: they cannot run it,
but they can say that the port is the fork's own program.

A copy would be a fault that only shows on the TV: a leftover tv.dumbtv.home in the port
would send the HOME key to the launcher that works today instead of to ours, and a guard
that starts the wrong activity would open nothing at all.

The old launcher is not in this repo any more - it stays installed on a television as the
fallback, and its files live in the git history. The tests that compared the two files
side by side now compare the fork's file with what the scripts still know about the
fallback, which is the part that still matters: the two guards have to be tellable apart.
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VARIANT = ROOT / 'variant'
GUARD = VARIANT / 'src' / 'io' / 'freemytv' / 'Guard.java'
GUARD_XML = VARIANT / 'res' / 'xml' / 'guard.xml'
OUR_FILES = VARIANT / 'our-files.txt'
HOME_SH = ROOT / 'scripts' / 'home.sh'


def guard_text():
    """The ported Guard, as text."""
    return GUARD.read_text(encoding='utf-8')


def our_files():
    """The paths our-files.txt lists, one per line, blanks dropped."""
    return [line.strip() for line in OUR_FILES.read_text(encoding='utf-8').splitlines()
            if line.strip()]


def label_of(strings_xml):
    """The guard_label string in a values file, or '' when it has none."""
    match = re.search(r'<string\s+name="guard_label"\s*>([^<]*)</string>',
                       strings_xml.read_text(encoding='utf-8'))
    return match.group(1) if match else ''


def fallback_guard_label():
    """The label the scripts know the fallback launcher's guard by.

    The fallback is not in this repo any more, so its label is read from the
    product table in scripts/home.sh - the one place that still names it, and the
    place the check that recognises the fallback's guard reads it from too.
    """
    for line in HOME_SH.read_text(encoding='utf-8').splitlines():
        if "'tv.dumbtv.home|" not in line:
            continue
        for part in line.split("'"):
            if part.startswith('tv.dumbtv.home|'):
                fields = part.split('|')
                if len(fields) > 2:
                    return fields[2]
    return ''


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


class GuardPortTests(unittest.TestCase):
    def test_the_guard_is_in_the_variant_sources(self):
        self.assertTrue(GUARD.is_file(), GUARD)
        self.assertTrue(guard_text().startswith('package io.freemytv;'))

    def test_the_port_has_no_leftover_of_the_launcher(self):
        # A leftover name would send the HOME key to the launcher that works today,
        # which is the one thing the port must not do.
        self.assertNotIn('tv.dumbtv.home', guard_text())
        self.assertNotIn('tv.dumbtv.home', GUARD_XML.read_text(encoding='utf-8'))

    def test_the_guard_is_the_fork_s_own_program(self):
        # The old launcher is not in this repo any more, so its file cannot be
        # compared with the port side by side. What can be checked is the one thing
        # that matters: the port is a program in the fork's own package, and it
        # carries none of the old launcher's names.
        text = guard_text()
        self.assertTrue(text.startswith('package io.freemytv;'))
        self.assertIn('class Guard extends AccessibilityService', text)
        self.assertNotIn('tv.dumbtv.home', text)

    def test_the_guard_starts_the_fork_s_own_home_activity(self):
        # The fork's home screen is io.freemytv.HomeActivity. The launcher starts
        # tv.dumbtv.home/.Home, which is not installed as part of the variant.
        self.assertIn('setClass(c, HomeActivity.class)', guard_text())

    def test_the_mechanism_came_across(self):
        # The three pieces that make the takeover work on a Fire TV: the launch goes
        # through an alarm (system_server is exempt from the five-second app-switch
        # delay), the cover hides Amazon's home, and the launch waits until the cover
        # has reached the window manager (Android 11 refuses a start from an app with
        # no visible window).
        text = guard_text()
        self.assertIn('AlarmManager', text)
        self.assertIn('setExact', text)
        self.assertIn('TYPE_ACCESSIBILITY_OVERLAY', text)
        self.assertIn('OnPreDrawListener', text)
        # The alarm only fires at once with min_futurity=0, which the install path
        # sets. The port has to say so, or nobody sets it.
        self.assertIn('min_futurity=0', text)

    def test_the_launch_waits_for_the_cover_to_be_drawn(self):
        # Not just "OnPreDrawListener" somewhere in the file: the launch has to be
        # scheduled from inside the listener's callback. Android 11 refuses to start
        # an activity from an app with no visible window, and the cover is the only
        # window the Guard has. A launch scheduled before the cover is drawn is
        # refused, and HOME does nothing.
        body = body_of(guard_text(), 'public boolean onPreDraw()')
        self.assertIn('home(Guard.this)', body,
                      'the launch is not scheduled from the cover\'s first draw pass')

    def test_a_cover_that_never_draws_still_launches(self):
        # The fallback: if the cover's first draw pass never comes, the launch must
        # still happen, or HOME would do nothing on a television where the overlay
        # never draws.
        self.assertIn('handler.postDelayed(launch, LAUNCH_FALLBACK_MS)', guard_text())

    def test_the_queued_launch_is_cancelled_when_the_home_screen_comes_up(self):
        # dumbtv home's activity cancels a queued launch when it resumes, so pressing
        # HOME twice does not launch the home screen twice. The fork's activity is
        # upstream's file and cannot call it, so the port cancels when the home
        # screen's own window appears instead.
        body = body_of(guard_text(), 'private void homeShown()')
        self.assertIn('arrived(this)', body,
                      'a queued launch is not cancelled when the home screen is up')

    def test_the_cover_is_painted_the_colour_the_home_screen_is_about_to_be(self):
        # The home screen blends its day background into its night one. A cover
        # painted with a fixed colour flashes white on a dark television at night.
        # The port asks the home screen the same question the home screen asks itself.
        text = guard_text()
        self.assertIn('isNight(', text)
        self.assertIn('NIGHT_BACKGROUND', text)
        self.assertIn('DAY_BACKGROUND', text)
        self.assertNotIn('R.color.home_background', text,
                         'the cover is painted with a fixed resource colour')

    def test_the_configuration_says_what_the_guard_needs(self):
        # The service watches for window changes and reads no screen content: the Guard
        # only needs to know when Amazon's home window appears.
        text = GUARD_XML.read_text(encoding='utf-8')
        self.assertIn('typeWindowStateChanged', text)
        self.assertIn('android:canRetrieveWindowContent="false"', text)

    def test_the_files_of_ours_are_listed(self):
        # The verifier fails on a file of ours that is not listed, and on a listed path
        # that upstream has.
        listed = our_files()
        for path in ('src/io/freemytv/Guard.java', 'res/xml/guard.xml',
                     'res/values/guard.xml'):
            with self.subTest(path=path):
                self.assertIn(path, listed)

    def test_the_guard_s_label_is_its_own(self):
        # "dumpsys accessibility" names a bound service by its label, never by its
        # component, and the TV's accessibility settings show the same string. Two
        # guards with one label cannot be told apart there, and the check that says
        # which one is bound is the one that decides whether HOME works.
        #
        # The fallback launcher's label is not in this repo any more: it lives in
        # the APK that is installed on the TV. The scripts still know it, because
        # they have to recognise the fallback's guard, so that is where it is read
        # from - and that is the point of the test: the fork's label and the
        # fallback's label must not drift into each other.
        ours = label_of(VARIANT / 'res' / 'values' / 'guard.xml')
        theirs = fallback_guard_label()
        self.assertTrue(ours, 'the fork has no guard label')
        self.assertTrue(theirs, 'the fallback has no guard label')
        self.assertNotEqual(ours, theirs,
                            'the fork and the fallback share a guard label')
        # And neither is the beginning of the other. The dump cuts a long label
        # short, so a label that begins with the other one would be read as this one
        # when the dump cut it short: the check for one guard would answer for the
        # other, and it would pass wrongly.
        self.assertFalse(ours.startswith(theirs),
                         f'{ours!r} begins with {theirs!r}')
        self.assertFalse(theirs.startswith(ours),
                         f'{theirs!r} begins with {ours!r}')


class GuardBoundByTheForkTests(unittest.TestCase):
    """The fork's Guard is bound by the fork's own install path, and by nothing else.

    This class used to say the opposite: until the install path existed, no script
    mentioned tv.dumbtv.variant/io.freemytv.Guard, so that the launcher which works
    today stayed the one in front. The install path exists now, and the test says
    what it must do instead: the fork's path binds the fork's Guard, and nothing
    else does. Two paths that bind Guards would fight over the HOME key.

    The old launcher's own install path is gone from this repo; it stays installed
    on a television as the fallback, and the fork's path takes its guard out.
    """

    FORK_GUARD = 'tv.dumbtv.variant/io.freemytv.Guard'

    def test_the_fork_s_install_path_binds_the_fork_s_guard(self):
        text = (VARIANT / 'install.sh').read_text(encoding='utf-8')
        self.assertIn(self.FORK_GUARD, text)

    def test_no_other_script_binds_a_guard(self):
        # Two paths that bind Guards would fight over the HOME key, so the fork's
        # guard is written into the accessibility setting by one script and one only.
        writes = ('put_secure enabled_accessibility_services',
                  'settings put secure enabled_accessibility_services')
        binders = []
        for path in sorted(list((ROOT / 'scripts').glob('*.sh')) + list(VARIANT.glob('*.sh'))):
            text = path.read_text(encoding='utf-8')
            if 'io.freemytv.Guard' in text and any(w in text for w in writes):
                binders.append(str(path.relative_to(ROOT)))
        self.assertEqual(binders, ['variant/install.sh'])

    def test_only_one_install_path_binds_a_guard(self):
        # The fallback's guard has to go out when the fork's comes in: two Guards
        # bound at once would fight over the HOME key.
        text = (VARIANT / 'install.sh').read_text(encoding='utf-8')
        self.assertIn('tv.dumbtv.home/tv.dumbtv.home.Guard', text)

    def test_the_fork_is_not_made_a_home_app_candidate(self):
        # The Guard is the whole mechanism. A HOME category or a set-home-activity
        # would let the package manager hand the HOME key to the fork on its own.
        text = (VARIANT / 'install.sh').read_text(encoding='utf-8')
        self.assertNotIn('set-home-activity', text)
        # A HOME intent may be started - that is how the whole thing is undone and
        # HOME goes back to Amazon's launcher - but never one that names the fork.
        for line in text.splitlines():
            if 'category.HOME' in line:
                self.assertNotIn('tv.dumbtv.variant', line)
        manifest = (VARIANT / 'AndroidManifest.xml').read_text(encoding='utf-8')
        self.assertNotIn('android.intent.category.HOME', manifest)


if __name__ == '__main__':
    unittest.main()
