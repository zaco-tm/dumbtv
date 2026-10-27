"""scripts/accessibility.sh: which guard is bound, read off a dumpsys accessibility.

Run: python3 -m unittest discover -s tests -v

The parser is the one thing that tells the two guards apart on the TV: it prints the
label of a bound service, never its component, so the label is what the caller has to
name. A parser that matched a label too loosely would report the old launcher's guard
as bound while the fork's is the one in front, and the check that decides whether HOME
works would be wrong.
"""
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ACCESSIBILITY = ROOT / 'scripts' / 'accessibility.sh'
FORK_LABEL = 'dumbtv home (variant) button'
OLD_LABEL = 'dumbtv home button'


def dump_of(body, user=0, form='Bound services'):
    """A dumpsys accessibility dump with one service in the bound section."""
    return (f'User state[\n attributes:{{id={user}, flags=0}}\n'
            f' {form}:{{{body}}}\n Enabled services:{{tv.dumbtv.variant/io.freemytv.Guard}}\n'
            ' Binding services:{}\n]\n')


def guard_bound(dump, user='0', label=None, klass=None):
    """What the parser says about a dump: 0 bound, 1 not bound, 2 unknown."""
    args = [user]
    if label is not None:
        args.append(label)
    if klass is not None:
        args.append(klass)
    script = 'source "$1"; shift; dump=$(cat); printf "%s" "$dump" | guard_bound "$@"'
    result = subprocess.run(['bash', '-c', script, 'bash', str(ACCESSIBILITY), *args],
                            input=dump, text=True, capture_output=True)
    return result.returncode


class GuardBoundTests(unittest.TestCase):
    def test_the_launcher_s_label_is_the_default(self):
        # The old caller passes only the user; it must keep working.
        dump = dump_of(f'Service[label={OLD_LABEL}, feedbackType[FEEDBACK_GENERIC]]')
        self.assertEqual(guard_bound(dump), 0)

    def test_the_fork_s_label_finds_the_fork_s_guard(self):
        dump = dump_of(f'Service[label={FORK_LABEL}, feedbackType[FEEDBACK_GENERIC]]')
        self.assertEqual(guard_bound(dump, '0', FORK_LABEL, 'io.freemytv.Guard'), 0)

    def test_the_launcher_s_label_does_not_find_the_fork_s_guard(self):
        # The comma straight after the label is what keeps the two apart.
        dump = dump_of(f'Service[label={FORK_LABEL}, feedbackType[FEEDBACK_GENERIC]]')
        self.assertEqual(guard_bound(dump), 1)

    def test_the_fork_s_label_does_not_find_the_launcher_s_guard(self):
        dump = dump_of(f'Service[label={OLD_LABEL}, feedbackType[FEEDBACK_GENERIC]]')
        self.assertEqual(guard_bound(dump, '0', FORK_LABEL, 'io.freemytv.Guard'), 1)

    def test_the_class_name_counts_before_the_resources_load(self):
        # Right after an APK update Android prints the class name in place of the
        # label, and that is the moment the install path waits for.
        dump = dump_of('Service[label=io.freemytv.Guard, feedbackType[FEEDBACK_GENERIC]]')
        self.assertEqual(guard_bound(dump, '0', FORK_LABEL, 'io.freemytv.Guard'), 0)

    def test_the_launcher_s_class_name_still_counts(self):
        dump = dump_of('Service[label=tv.dumbtv.home.Guard, feedbackType[FEEDBACK_GENERIC]]')
        self.assertEqual(guard_bound(dump), 0)

    def test_a_label_outside_the_bound_section_does_not_count(self):
        dump = dump_of('') + f' Binding services:{{Service[label={FORK_LABEL},]}}\n'
        self.assertEqual(guard_bound(dump, '0', FORK_LABEL, 'io.freemytv.Guard'), 1)

    def test_another_user_s_service_does_not_count(self):
        # The dump has no section for the user asked about, so the answer is "cannot
        # tell", not "not bound".
        dump = dump_of(f'Service[label={FORK_LABEL}, feedbackType[FEEDBACK_GENERIC]]', user=10)
        self.assertEqual(guard_bound(dump, '0', FORK_LABEL, 'io.freemytv.Guard'), 2)

    def test_an_unknown_dump_is_not_a_failure(self):
        # 2 means "cannot tell", not "not bound": the caller says so.
        self.assertEqual(guard_bound('', '0', FORK_LABEL, 'io.freemytv.Guard'), 2)

    def test_the_android_9_shape_is_read_too(self):
        dump = (f'User state[attributes:{{id=0, currentUser=true}}\n'
                f' services:{{Service[label={FORK_LABEL}, feedbackType[FEEDBACK_GENERIC]]}}]')
        self.assertEqual(guard_bound(dump, '0', FORK_LABEL, 'io.freemytv.Guard'), 0)

    def test_a_label_the_dump_cut_short_still_counts(self):
        # The dump cuts a long label short and prints an ellipsis: the fork's label
        # is "dumbtv home (variant) button" and the dump shows
        # "dumbtv home (variant) b…". What is left of it is still the beginning of
        # the label, so the fork's guard is found.
        dump = dump_of('Service[label=dumbtv home (variant) b…, feedbackType[FEEDBACK_GENERIC]]')
        self.assertEqual(guard_bound(dump, '0', FORK_LABEL, 'io.freemytv.Guard'), 0)

    def test_a_cut_short_label_of_the_launcher_is_not_the_fork_s_guard(self):
        # The other way round, and the one that matters: the dump cuts the launcher's
        # label short, and what is left of it must not be taken for the fork's. The
        # two labels part at the eleventh character, so a cut to ten characters or
        # fewer is all it would take to confuse them; the cut on this television is at
        # twenty-two. If the labels ever grew into one another again, this test is
        # what would say so.
        dump = dump_of('Service[label=dumbtv home bu…, feedbackType[FEEDBACK_GENERIC]]')
        self.assertEqual(guard_bound(dump, '0', FORK_LABEL, 'io.freemytv.Guard'), 1)

    def test_a_cut_short_label_that_is_only_a_few_characters_does_not_count(self):
        # A cut of a few characters is a common word and could be the beginning of
        # any label at all, so it must not be taken for ours.
        dump = dump_of('Service[label=dumbtv…, feedbackType[FEEDBACK_GENERIC]]')
        self.assertEqual(guard_bound(dump, '0', FORK_LABEL, 'io.freemytv.Guard'), 1)

    def test_the_whole_label_of_the_launcher_is_not_the_fork_s_guard(self):
        dump = dump_of(f'Service[label={OLD_LABEL}, feedbackType[FEEDBACK_GENERIC]]')
        self.assertEqual(guard_bound(dump, '0', FORK_LABEL, 'io.freemytv.Guard'), 1)

    def test_the_two_labels_part_early(self):
        # The invariant the cut-short rule rests on: neither label is the beginning
        # of the other. Without it, a dump that cut the shorter one short would
        # answer for the longer one.
        self.assertFalse(FORK_LABEL.startswith(OLD_LABEL),
                         f'{FORK_LABEL!r} begins with {OLD_LABEL!r}')
        self.assertFalse(OLD_LABEL.startswith(FORK_LABEL),
                         f'{OLD_LABEL!r} begins with {FORK_LABEL!r}')
        # And they part before the cut a dump would leave: a cut of twenty-two
        # characters still tells them apart.
        self.assertNotEqual(FORK_LABEL[:22], OLD_LABEL[:22])


if __name__ == '__main__':
    unittest.main()
