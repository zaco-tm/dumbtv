#!/usr/bin/env bash
# Undoes the package, app-op, network-policy, home-screen and DNS changes.
# Apps that were uninstalled from /data have to be reinstalled from the store.
# Usage: ./scripts/restore.sh [--dry-run] [-y]
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_flags "$@"
need_device
load_conf

# Everything debloat.sh or youtube.sh may have switched off, under any answers.
restore_list() {
  {
    list_of "$(fos packages.txt)"
    list_of "$(fos alexa.txt)"
    list_of "$(fos user-apps.txt)"
    printf '%s\n' $REMOVE_EXTRA com.amazon.firetv.youtube
  } | awk 'NF {print $1}' | awk '!seen[$0]++'
}

step "plan"
note "turn back on every package dumbtv can disable: the ads list, Alexa, apps you named, YouTube"
note "clear app-ops and network blacklists"
note "detach the DNS filter and the home-screen hook"
note "put back every setting from report/settings-before-*.txt, or the bundled defaults"
note "the TV reboots when this finishes"
if [[ $DRY_RUN == 0 ]]; then
  confirm "Restore Amazon defaults on $SERIAL?" || die "cancelled"
fi

mkdir -p "$REPORT"

# Prefer the value this device actually had before the pass (snapshotted by
# preflight.sh); fall back to the stock defaults in data/.
restore_value() {
  local ns=$1 key=$2 fallback=$3 snapshot="$REPORT/settings-before-$1.txt" v
  if [[ -f $snapshot ]]; then
    # The snapshot is raw adb output: a CR left on the value would be written back with it.
    v=$(tr -d '\r' < "$snapshot" | grep -m1 "^$key=" | cut -d= -f2-)
    [[ -n $v ]] && { printf '%s' "$v"; return; }
  fi
  printf '%s' "$fallback"
}

step "packages"
for p in $(restore_list); do
  # Older versions uninstalled some system apps for user 0; install-existing brings
  # those back where the build has it. Store apps come back from the store.
  if ! present "$p"; then
    [[ $REINSTALL == 1 ]] || continue
    a=$(acmd cmd package install-existing "$p" 2>&1 | head -1)
    present "$p" || continue
  else
    a="installed"
  fi
  b=$(acmd pm enable --user 0 "$p" 2>&1 | head -1)
  bg_on "$p"
  uid=$(uid_of "$p")
  [[ -n $uid ]] && acmd cmd netpolicy remove restrict-background-blacklist "$uid" >/dev/null 2>&1
  printf '  %-46s %s / %s\n' "$p" "${a:-no output}" "${b:-no output}"
done

# Older lists disabled packages that have since moved to never-disable.txt
# (com.amazon.firebat is Prime Video), so the loop above no longer reaches them.
step "never-disable packages left disabled"
off=$(dev 'pm list packages -d' | sed 's/^package://' | tr -d '\r')
for p in $(list_of "$(fos never-disable.txt)" | awk '{print $1}'); do
  grep -qx "$p" <<<"$off" || continue
  b=$(acmd pm enable --user 0 "$p" 2>&1 | head -1)
  printf '  %-46s %s\n' "$p" "${b:-no output}"
done

step "screensaver"
if [[ $(dev1 settings get secure screensaver_components) == "$AOSP_DREAM" ]]; then
  want=$(restore_value secure screensaver_components "$(dev1 settings get secure screensaver_default_component)")
  if [[ -n $want && $want != null && $want != "$AOSP_DREAM" ]]; then
    acmd settings put secure screensaver_components "$want" >/dev/null
    printf '  %-46s %s\n' screensaver_components "$want"
  fi
else
  note "unchanged"
fi

step "packages that were only starved"
if [[ -f $REPORT/debloat.txt ]]; then
  while IFS=$'\t' read -r p state rest; do
    [[ -z ${p:-} ]] && continue
    bg_on "$p"
    uid=$(uid_of "$p")
    [[ -n $uid ]] && acmd cmd netpolicy remove restrict-background-blacklist "$uid" >/dev/null 2>&1
    printf '  %-46s %s\n' "$p" "${state:-unknown}"
  done < "$REPORT/debloat.txt"
else
  note "no report/debloat.txt, relying on protected.txt only"
  for p in $(list_of "$(fos protected.txt)"); do
    bg_on "$p"
    uid=$(uid_of "$p")
    [[ -n $uid ]] && acmd cmd netpolicy remove restrict-background-blacklist "$uid" >/dev/null 2>&1
    printf '  %-46s cleared\n' "$p"
  done
fi
acmd cmd netpolicy set restrict-background false >/dev/null 2>&1

step "on-device hooks"
# Without this the TV keeps sending DNS through a filter the user just tried to
# undo, and HOME stays hijacked.
acmd settings delete secure always_on_vpn_app >/dev/null 2>&1

# The home screen is AverageTV's now, and so is the guard that holds the HOME key.
# The undo is one setting: the guard goes out of enabled_accessibility_services, and
# every other accessibility service on the television stays.
#
# It is done here rather than by AverageTV's own installer, so that a television can
# always be put back without another project and without a network. The three things
# AverageTV's undo does are these three: the guard out, the app ops back to their
# default, and the alarm setting put back what it was.
hooks=$(dev 'settings get secure enabled_accessibility_services' | tr -d '\r')
[[ $hooks == null ]] && hooks=
kept=$(printf '%s' "$hooks" | tr ':' '\n' |
  { grep -vxF -e 'tv.averagetv.app/io.freemytv.Guard' -e 'tv.averagetv.app/.io.freemytv.Guard' \
                   -e 'tv.dumbtv.home/tv.dumbtv.home.Guard' -e 'tv.dumbtv.home/.Guard' -e '' || true; } |
  paste -sd: -)
if [[ -n $kept ]]; then
  acmd settings put secure enabled_accessibility_services "$kept" >/dev/null
  acmd settings put secure accessibility_enabled 1 >/dev/null
else
  acmd settings put secure enabled_accessibility_services '""' >/dev/null
  acmd settings put secure accessibility_enabled 0 >/dev/null
fi
acmd appops set tv.averagetv.app SYSTEM_ALERT_WINDOW default >/dev/null 2>&1 || true
acmd appops set tv.averagetv.app REQUEST_INSTALL_PACKAGES default >/dev/null 2>&1 || true

# The alarm setting AverageTV's guard needs: min_futurity=0 is ours, and the value
# the television had before is put back. The helpers live in home.sh.
sh_() { dev "$@"; }
dev_sdk=$SDK
# shellcheck disable=SC1091
source "$ROOT/scripts/home.sh"
set_futurity off
note "always_on_vpn_app cleared, HOME handed back to Amazon's launcher (apps stay installed)"

step "settings"
while read -r ns key value; do
  [[ -z ${ns:-} || $ns == \#* ]] && continue
  want=$(restore_value "$ns" "$key" "$value")
  acmd settings put "$ns" "$key" "$want" >/dev/null
  printf '  %-46s %s\n' "$key" "$want"
done < <(list_of "$(fos settings.restore.txt)" | sed 's/ = / /')

# The filter also starts from its own boot receiver, so clearing always_on_vpn_app
# alone leaves it filtering after the reboot. Disabling it stops the VPN, which can
# cut a network adb session, so it goes last.
if present dnsfilter.android; then
  step "DNS filter"
  acmd pm disable-user --user 0 dnsfilter.android >/dev/null 2>&1
  note "personalDNSfilter disabled (it would start again at boot); dnsfilter.sh turns it back on"
  [[ $DRY_RUN == 1 ]] || { sleep 3; adb_reconnect; }
fi

[[ $DRY_RUN == 1 ]] && { note "[dry-run] done"; exit 0; }
reboot_wait
note "restored. AverageTV, personalDNSfilter and SmartTube (if you added it) are still"
note "installed; remove them in Settings > Applications if you want them gone too."
