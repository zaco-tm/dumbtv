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


def generate(properties, *, generic=False):
    """Run the tool and return the generated Java."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'Config.java'
        args = [sys.executable, str(TOOL)]
        if generic:
            args.append('--generic')
        else:
            props = Path(tmp) / 'config.properties'
            props.write_text(properties, encoding='utf-8')
            args.append(str(props))
        args.append(str(out))
        done = subprocess.run(args, capture_output=True, text=True)
        if done.returncode != 0:
            raise AssertionError(done.stderr.strip())
        return out.read_text(encoding='utf-8')


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

    def test_a_latitude_that_is_not_in_the_file_keeps_the_default(self):
        java = generate('city=Amsterdam\n')
        self.assertIn('static final String LATITUDE = "40.7128";', java)
        self.assertIn('static final String LONGITUDE = "-74.0060";', java)

    def test_a_latitude_is_read(self):
        java = generate('latitude=52.37\n')
        self.assertIn('static final String LATITUDE = "52.37";', java)

    def test_a_latitude_below_zero_is_read(self):
        java = generate('latitude=-33.87\nlongitude=151.21\n')
        self.assertIn('static final String LATITUDE = "-33.87";', java)
        self.assertIn('static final String LONGITUDE = "151.21";', java)

    def test_a_latitude_that_is_not_a_number_is_refused(self):
        with self.assertRaises(AssertionError):
            generate('latitude=52,37\n')

    def test_a_longitude_that_is_not_a_number_is_refused(self):
        with self.assertRaises(AssertionError):
            generate('longitude=4,89\n')

    def test_a_latitude_that_is_not_finite_is_refused(self):
        for value in ('nan', 'inf', '-inf'):
            with self.subTest(value=value):
                with self.assertRaises(AssertionError):
                    generate(f'latitude={value}\n')

    def test_a_latitude_in_exponent_form_is_refused(self):
        with self.assertRaises(AssertionError):
            generate('latitude=1e5\n')

    def test_a_latitude_with_letters_after_it_is_refused(self):
        with self.assertRaises(AssertionError):
            generate('latitude=52.37abc\n')

    def test_the_error_names_the_key_and_the_value(self):
        with self.assertRaises(AssertionError) as caught:
            generate('latitude=nan\n')
        message = str(caught.exception)
        self.assertIn('latitude', message)
        self.assertIn('nan', message)

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
