"""The variant's config.properties -> io.freemytv.Config generator, off-device."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / 'variant' / 'tools' / 'gen_config.py'

FIELDS = ['TMDB_KEY', 'WATCHMODE_KEY', 'TMDB_REGION', 'LATITUDE', 'LONGITUDE', 'CITY',
          'LANGUAGE', 'CURRENCY', 'TEMPERATURE', 'HIDE_SERVICES', 'THEME',
          'DISABLE_ASSISTANT', 'SHOW_CRYPTO', 'HIDE_ANIMATION', 'SCREENSAVER', 'GENERIC']


def run_tool(*arguments):
    """Run the tool with these arguments and return the finished process."""
    return subprocess.run([sys.executable, str(TOOL), *arguments],
                          capture_output=True, text=True)


def generate_bytes(properties, *, generic=False, encoding='utf-8'):
    """Run the tool on these properties and return the generated Java as bytes."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'Config.java'
        args = []
        if generic:
            args.append('--generic')
        else:
            props = Path(tmp) / 'config.properties'
            props.write_text(properties, encoding=encoding)
            args.append(str(props))
        args.append(str(out))
        done = run_tool(*args)
        if done.returncode != 0:
            raise AssertionError(done.stderr.strip())
        return out.read_bytes()


def generate(properties, *, generic=False, encoding='utf-8'):
    """Run the tool and return the generated Java."""
    return generate_bytes(properties, generic=generic, encoding=encoding).decode('utf-8')


class VariantConfigTests(unittest.TestCase):
    def test_generic_leaves_the_location_empty(self):
        java = generate('', generic=True)
        self.assertIn('static final String LATITUDE = "";', java)
        self.assertIn('static final String LONGITUDE = "";', java)
        self.assertIn('static final String TMDB_REGION = "";', java)
        self.assertIn('static final String CURRENCY = "";', java)

    def test_generic_takes_the_other_defaults(self):
        java = generate('', generic=True)
        self.assertIn('static final String TMDB_KEY = "";', java)
        self.assertIn('static final String LANGUAGE = "auto";', java)
        self.assertIn('static final String TEMPERATURE = "auto";', java)
        self.assertIn('static final String THEME = "auto";', java)
        self.assertIn('static final boolean SHOW_CRYPTO = true;', java)
        self.assertIn('static final boolean SCREENSAVER = true;', java)
        self.assertIn('static final boolean GENERIC = true;', java)

    def test_reads_the_values(self):
        java = generate('tmdb_key=abc123\ncity=Amsterdam\ntmdb_region=NL\n'
                        'latitude=52.37\nlongitude=4.89\ncurrency=EUR\n')
        self.assertIn('static final String TMDB_KEY = "abc123";', java)
        self.assertIn('static final String CITY = "Amsterdam";', java)
        self.assertIn('static final String TMDB_REGION = "NL";', java)
        self.assertIn('static final String LATITUDE = "52.37";', java)
        self.assertIn('static final String LONGITUDE = "4.89";', java)
        self.assertIn('static final String CURRENCY = "EUR";', java)

    def test_the_last_value_wins(self):
        java = generate('city=First\ncity=Second\n')
        self.assertIn('static final String CITY = "Second";', java)

    def test_quotes_and_backslashes_are_stripped(self):
        java = generate('tmdb_key="quoted"\n')
        self.assertIn('static final String TMDB_KEY = "quoted";', java)

    def test_spaces_around_the_equals_are_allowed(self):
        # The docstring's own form: "key = value".
        java = generate('city = Amsterdam\ntmdb_key  =  abc123\n')
        self.assertIn('static final String CITY = "Amsterdam";', java)
        self.assertIn('static final String TMDB_KEY = "abc123";', java)

    def test_a_comment_line_is_ignored(self):
        # A comment that looks like a setting is still a comment. It comes after the
        # setting it names, so if it were honoured the last value would win.
        java = generate('city=Amsterdam\n# city=Berlin\n# tmdb_key=commented\n')
        self.assertIn('static final String CITY = "Amsterdam";', java)
        self.assertIn('static final String TMDB_KEY = "";', java)
        self.assertNotIn('Berlin', java)
        self.assertNotIn('commented', java)

    def test_an_unknown_key_is_ignored(self):
        java = generate('not_a_setting=whatever\ncity=Amsterdam\n')
        self.assertIn('static final String CITY = "Amsterdam";', java)
        self.assertNotIn('not_a_setting', java)
        self.assertNotIn('whatever', java)
        # The class holds the sixteen fields and nothing else, so an unknown key in the
        # file cannot turn up in it.
        self.assertEqual(java.count('static final'), len(FIELDS))

    def test_an_unknown_key_is_warned_about(self):
        # A typo like tmdb_keey= would otherwise build an APK with no key and say
        # nothing at all.
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'config.properties'
            props.write_text('tmdb_keey=abc123\ncity=Amsterdam\n', encoding='utf-8')
            done = run_tool(str(props), str(Path(tmp) / 'Config.java'))
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertIn('tmdb_keey', done.stderr)
            self.assertNotIn('Traceback', done.stderr)

    def test_an_unknown_key_is_warned_about_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'config.properties'
            props.write_text('nope=1\nnope=2\n', encoding='utf-8')
            done = run_tool(str(props), str(Path(tmp) / 'Config.java'))
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(done.stderr.count('nope'), 1, done.stderr)

    def test_a_utf16_file_says_so_in_one_line(self):
        # Notepad's "Unicode" saves UTF-16, which is not UTF-8. Upstream's own build
        # script says so in one line; a traceback would not.
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'config.properties'
            props.write_bytes('tmdb_key=abc123\ncity=Amsterdam\n'.encode('utf-16'))
            done = run_tool(str(props), str(Path(tmp) / 'Config.java'))
            self.assertNotEqual(done.returncode, 0)
            self.assertIn('UTF-16', done.stderr)
            self.assertNotIn('Traceback', done.stderr)
            self.assertEqual(len(done.stderr.strip().splitlines()), 1)

    def test_hide_services_is_read(self):
        java = generate('hide_services=netflix,prime\n')
        self.assertIn('static final String HIDE_SERVICES = "netflix,prime";', java)

    def test_watchmode_key_is_read(self):
        java = generate('watchmode_key=abc123\n')
        self.assertIn('static final String WATCHMODE_KEY = "abc123";', java)

    def test_a_city_that_is_not_ascii_comes_out_as_utf8(self):
        # The build compiles with -encoding UTF-8, so the city has to be UTF-8 in the file.
        data = generate_bytes('city=København\n')
        self.assertIn('static final String CITY = "København";', data.decode('utf-8'))
        self.assertIn('København'.encode('utf-8'), data)

    def test_a_byte_order_mark_does_not_hide_the_first_key(self):
        # A file saved with a BOM starts with U+FEFF. Without utf-8-sig the first key
        # would be a byte order mark followed by "tmdb_key": not a known key, and
        # dropped without a word.
        java = generate('tmdb_key=abc123\ncity=Amsterdam\n', encoding='utf-8-sig')
        self.assertIn('static final String TMDB_KEY = "abc123";', java)
        self.assertIn('static final String CITY = "Amsterdam";', java)

    def test_booleans_follow_upstream(self):
        java = generate('disable_assistant=true\nshow_crypto=false\n'
                        'hide_animation=true\nscreensaver=false\n')
        self.assertIn('static final boolean DISABLE_ASSISTANT = true;', java)
        self.assertIn('static final boolean SHOW_CRYPTO = false;', java)
        self.assertIn('static final boolean HIDE_ANIMATION = true;', java)
        self.assertIn('static final boolean SCREENSAVER = false;', java)

    def test_a_word_that_is_not_true_is_not_true(self):
        java = generate('disable_assistant=yes\n')
        self.assertIn('static final boolean DISABLE_ASSISTANT = false;', java)

    def test_a_word_that_is_not_false_is_not_false(self):
        java = generate('screensaver=maybe\n')
        self.assertIn('static final boolean SCREENSAVER = true;', java)

    def test_an_empty_switch_keeps_the_default(self):
        # The app reads the switches as Java booleans: an empty one is a switch that was
        # not set, so it keeps the default, as upstream's shell does.
        java = generate('disable_assistant=\nshow_crypto=\nhide_animation=\nscreensaver=\n')
        self.assertIn('static final boolean DISABLE_ASSISTANT = false;', java)
        self.assertIn('static final boolean SHOW_CRYPTO = true;', java)
        self.assertIn('static final boolean HIDE_ANIMATION = false;', java)
        self.assertIn('static final boolean SCREENSAVER = true;', java)

    def test_an_empty_latitude_stays_empty(self):
        # An empty place is an answer: the app then guesses it from the TV's time zone
        # (Place.java). Upstream's shell would put New York here.
        java = generate('latitude=\nlongitude=\n')
        self.assertIn('static final String LATITUDE = "";', java)
        self.assertIn('static final String LONGITUDE = "";', java)

    def test_an_absent_latitude_stays_empty(self):
        # An absent key and an empty one mean the same thing: the app then guesses the
        # place from the TV's time zone (Place.java). Upstream's shell would put New
        # York here, and a config that sets only a key and a city would pin the TV to
        # New York without saying so.
        java = generate('city=Amsterdam\n')
        self.assertIn('static final String LATITUDE = "";', java)
        self.assertIn('static final String LONGITUDE = "";', java)

    def test_an_absent_region_and_currency_stay_empty(self):
        # The same for the region and the currency: empty means the TV's country.
        java = generate('city=Amsterdam\n')
        self.assertIn('static final String TMDB_REGION = "";', java)
        self.assertIn('static final String CURRENCY = "";', java)

    def test_a_region_and_a_currency_that_are_set_are_kept(self):
        java = generate('tmdb_region=NL\ncurrency=EUR\n')
        self.assertIn('static final String TMDB_REGION = "NL";', java)
        self.assertIn('static final String CURRENCY = "EUR";', java)

    def test_a_latitude_is_read(self):
        java = generate('latitude=52.37\n')
        self.assertIn('static final String LATITUDE = "52.37";', java)

    def test_a_latitude_below_zero_is_read(self):
        java = generate('latitude=-33.87\nlongitude=151.21\n')
        self.assertIn('static final String LATITUDE = "-33.87";', java)
        self.assertIn('static final String LONGITUDE = "151.21";', java)

    def test_a_latitude_that_is_not_a_number_is_refused(self):
        with self.assertRaises(AssertionError) as caught:
            generate('latitude=52,37\n')
        self.assertIn('must be a number', str(caught.exception))

    def test_a_longitude_that_is_not_a_number_is_refused(self):
        with self.assertRaises(AssertionError) as caught:
            generate('longitude=4,89\n')
        self.assertIn('must be a number', str(caught.exception))

    def test_a_latitude_that_is_not_finite_is_refused(self):
        for value in ('nan', 'inf', '-inf'):
            with self.subTest(value=value):
                with self.assertRaises(AssertionError) as caught:
                    generate(f'latitude={value}\n')
                self.assertIn('must be a number', str(caught.exception))

    def test_a_latitude_in_exponent_form_is_refused(self):
        with self.assertRaises(AssertionError) as caught:
            generate('latitude=1e5\n')
        self.assertIn('must be a number', str(caught.exception))

    def test_a_latitude_with_letters_after_it_is_refused(self):
        with self.assertRaises(AssertionError) as caught:
            generate('latitude=52.37abc\n')
        self.assertIn('must be a number', str(caught.exception))

    def test_the_error_names_the_key_and_the_value(self):
        with self.assertRaises(AssertionError) as caught:
            generate('latitude=nan\n')
        message = str(caught.exception)
        self.assertIn('must be a number', message)
        self.assertIn('latitude', message)
        self.assertIn('nan', message)

    def test_a_refused_value_leaves_an_earlier_target_alone(self):
        # The text is built before the target is opened, so a refused value cannot leave
        # an empty Config.java behind for a later javac to misread.
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'config.properties'
            props.write_text('latitude=52,37\n', encoding='utf-8')
            out = Path(tmp) / 'Config.java'
            out.write_text('// the build from before\n', encoding='utf-8')
            done = run_tool(str(props), str(out))
            self.assertNotEqual(done.returncode, 0)
            self.assertEqual(out.read_text(encoding='utf-8'), '// the build from before\n')

    def test_a_refused_value_leaves_no_target_at_all(self):
        # The same, with nothing to keep: the run leaves no file, not an empty one.
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'config.properties'
            props.write_text('latitude=52,37\n', encoding='utf-8')
            out = Path(tmp) / 'Config.java'
            done = run_tool(str(props), str(out))
            self.assertNotEqual(done.returncode, 0)
            self.assertFalse(out.exists())

    def test_a_missing_input_file_says_so_in_one_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / 'nope.properties'
            done = run_tool(str(missing), str(Path(tmp) / 'Config.java'))
            self.assertNotEqual(done.returncode, 0)
            self.assertIn(str(missing), done.stderr)
            self.assertNotIn('Traceback', done.stderr)
            self.assertEqual(len(done.stderr.strip().splitlines()), 1)

    def test_a_missing_output_directory_says_so_in_one_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'config.properties'
            props.write_text('city=Amsterdam\n', encoding='utf-8')
            out = Path(tmp) / 'nowhere' / 'Config.java'
            done = run_tool(str(props), str(out))
            self.assertNotEqual(done.returncode, 0)
            self.assertIn(str(out), done.stderr)
            self.assertNotIn('Traceback', done.stderr)
            self.assertEqual(len(done.stderr.strip().splitlines()), 1)

    def test_an_empty_region_and_currency_stay_empty(self):
        # The app reads an empty region or currency as "the TV's time zone guesses" too.
        java = generate('tmdb_region=\ncurrency=\n')
        self.assertIn('static final String TMDB_REGION = "";', java)
        self.assertIn('static final String CURRENCY = "";', java)

    def test_every_field_upstream_reads_is_there(self):
        java = generate('', generic=True)
        for field in FIELDS:
            self.assertIn(field, java)

    def test_the_class_is_in_upstreams_package(self):
        java = generate('', generic=True)
        self.assertIn('package io.freemytv;', java)
        self.assertIn('final class Config {', java)


if __name__ == '__main__':
    unittest.main()
