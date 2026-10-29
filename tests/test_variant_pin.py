"""The parent PIN can be changed, from inside the settings, behind the PIN.

Off-device: the code is read from the tree and checked for the wiring the feature
promises — the current PIN first, then a new one twice, stored where the old one was.
Nothing here touches a TV.
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


class ChangePinTests(unittest.TestCase):
    """The row, the chain of steps, and where the new PIN goes."""

    def test_there_is_a_row_for_it(self):
        settings = read('SettingsActivity.java')
        self.assertIn('Ui.tr("Change PIN")', settings)
        # It is in the main menu, next to the Sleep Timer and the TV's own settings.
        labels = method(settings, 'private void drawMain')
        self.assertIn('Ui.tr("Change PIN")', labels)
        self.assertIn('case MAIN: return 9;', settings)

    def test_the_row_opens_the_lock_in_the_changing_mode(self):
        settings = read('SettingsActivity.java')
        change = method(settings, 'private void changePin')
        self.assertIn('new ParentLock(', change)
        # The last argument says the PIN is being changed.
        self.assertIn('true)', change)

    def test_the_lock_has_a_changing_mode(self):
        lock = read('ParentLock.java')
        self.assertIn('boolean changing', lock)
        self.assertIn('ParentLock(View host, Listener listener, String purpose, boolean changing)', lock)

    def test_the_current_pin_comes_first_and_then_the_new_one_twice(self):
        """ENTER (the PIN in use) → CREATE (the new one) → CONFIRM (the new one again):
        the step the lock is in says which of the three it is."""
        lock = read('ParentLock.java')
        self.assertIn('ENTER = 0, CREATE = 1, CONFIRM = 2', lock)
        typed = method(lock, 'private void type')
        # The current PIN was right: the new one is asked for, not the door opened.
        self.assertIn('if (changing)', typed)
        self.assertIn('step = CREATE', typed)
        # A new one is asked for twice, and only a match is kept.
        self.assertIn('first = pin', typed)
        self.assertIn('step = CONFIRM', typed)
        self.assertIn('pin.equals(first)', typed)

    def test_the_new_pin_goes_where_the_old_one_was(self):
        """The same file, the same rules: a salted hash, written with commit(), never the
        PIN itself, and not in the shared settings file."""
        lock = read('ParentLock.java')
        typed = method(lock, 'private void type')
        self.assertIn('Prefs.setPin(pin)', typed)
        prefs = read('Prefs.java')
        self.assertIn('getSharedPreferences("parent_pin"', prefs)
        self.assertIn('putString("pin", hashPin(pin)).commit()', prefs)
        self.assertNotIn('putString("pin", pin)', prefs)

    def test_the_rules_are_the_same_ones(self):
        """Five wrong tries wait 30 seconds, and the wait is kept in the prefs, so closing
        and reopening the settings does not reset it."""
        lock = read('ParentLock.java')
        self.assertIn('TRIES = 5', lock)
        self.assertIn('WAIT = 30_000', lock)
        self.assertIn('Prefs.pinWaitUntil', lock)
        self.assertIn('Prefs.setPinFails', lock)

    def test_a_wrong_pin_is_refused_the_way_it_is_at_the_door(self):
        typed = method(read('ParentLock.java'), 'private void type')
        self.assertIn('Prefs.checkPin(pin)', typed)
        self.assertIn('Prefs.pinFails()', typed)


if __name__ == '__main__':
    unittest.main()
