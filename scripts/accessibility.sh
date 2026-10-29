#!/usr/bin/env bash
# Read-only parser for the bound-service section of dumpsys accessibility.
# Android 9 calls it "services"; newer Android calls it "Bound services".
# AOSP prints the service label, not its component, in these sections. Keep the
# labels in sync with variant/res/values/guard.xml (the fallback launcher's own
# label is in the APK that is installed on the TV, not in this repo). Right after
# the APK is updated, Android 9 prints the class name in place of the label until
# the resources load, so that form counts as bound too. Enabled components are
# checked separately by verify.sh. This is a health check, not an identity proof.
#
# Usage: guard_bound <user> [label] [class]
#   label  what the bound service is called in the dump. The default is this repo's
#          product's: "AverageTV guard". The fallback launcher's is
#          "dumbtv home button".
#   class  what the bound service is called before its resources load. The default is
#          this repo's product's: "io.freemytv.Guard". The fallback launcher's is
#          "tv.dumbtv.home.Guard".
# Return 0 = bound, 1 = a recognized empty/other-service section, 2 = unknown.
guard_bound() {
  local uid=$1 wanted=${2:-AverageTV guard} klass=${3:-io.freemytv.Guard}
  awk -v uid="$uid" -v wanted="$wanted" -v klass="$klass" '
    /User state\[/ { user = ""; inside = 0 }
    /attributes:\{id=[0-9]+[,}]/ {
      id = $0
      sub(/^.*attributes:\{id=/, "", id)
      sub(/[,}].*$/, "", id)
      user = id
    }
    user == uid && /^[[:space:]]*(Bound services|services):[[:space:]]*\{/ {
      inside = 1
      sub(/^[^{]*\{/, "")
    }
    inside {
      # Never accept a similarly named service or a label in Enabled/Binding.
      # A bound service is named by its label, and the dump cuts a long label short:
      # it prints the beginning of the label and an ellipsis. So the label matches
      # when the dump prints it whole, or when what is left of it before the
      # ellipsis is the beginning of it.
      #
      # That last rule is why the two labels may not be the beginning of one another.
      # If they were, a dump that cut the shorter one short would still leave the
      # beginning of the longer one, and the check for one guard would answer for
      # the other. The fallback is "dumbtv home button" and the fork is
      # "AverageTV guard": they part at the first character, so a dump would have
      # to cut a label to nothing to confuse them, and the cut on this television
      # is at twenty-two.
      rest = $0
      while ((p = index(rest, "Service[label=")) > 0) {
        rest = substr(rest, p + 14)
        q = index(rest, ",")
        if (q > 0) {
          got = substr(rest, 1, q - 1)
          if (got == wanted || got == klass) found = 1
          cut = got
          if (sub(/…+$/, "", cut) || sub(/\.\.\.+$/, "", cut)) {
            # A cut label of a few characters is a common word and could be the
            # beginning of any label at all, so it has to be long enough to mean
            # something: twelve characters is past where the two labels part.
            if (length(cut) >= 12 && (index(wanted, cut) == 1 || index(klass, cut) == 1)) found = 1
          }
        }
      }
      if (index($0, "}")) { seen = 1; inside = 0 }
    }
    END { if (!seen || inside) exit 2; exit (found ? 0 : 1) }
  '
}
