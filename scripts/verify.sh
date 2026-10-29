#!/usr/bin/env bash
# Proof that it worked: blocked hosts must answer 0.0.0.0 or NXDOMAIN, everyday
# hosts must still resolve, and HOME must land on AverageTV unless the user kept
# Amazon's. Exit code 0 means every enabled check passed.
# Usage: ./scripts/verify.sh
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
source "$ROOT/scripts/accessibility.sh"
source "$ROOT/scripts/home.sh"
parse_flags "$@"
need_device
load_conf

fail=0
printf '\n%-10s %-38s %s\n' '' host result
printf '%-10s %-38s %s\n' '----------' '--------------------------------------' '----------------------'

if [[ $DNSFILTER == 0 ]]; then
  printf '%-10s %-38s %s\n' skip dns "DNSFILTER=0, not checked"
else
  # A blocked host answers 0.0.0.0 on personalDNSfilter, but NXDOMAIN on a router's
  # Blocky or Unbound denylist. NXDOMAIN only counts as blocked when an everyday
  # host still resolves: a resolver that is down makes every lookup "unknown host",
  # and passing that would hide a broken filter. So check the allowed hosts first
  # and hold their rows back, to keep the table in its documented order.
  allowed_rows=""
  resolver=0
  while read -r h; do
    line=$(dev "ping -c1 -W2 $h" | head -1)
    case $line in
      *0.0.0.0*|*127.0.0.1*)
        allowed_rows="${allowed_rows}$(printf '%-10s %-38s %s\n' FAIL "$h" 'WRONGLY BLOCKED')"$'\n'; fail=1 ;;
      *"unknown host"*|*"not known"*|*"cannot resolve"*|"")
        allowed_rows="${allowed_rows}$(printf '%-10s %-38s %s\n' FAIL "$h" 'no answer')"$'\n'; fail=1 ;;
      *)
        allowed_rows="${allowed_rows}$(printf '%-10s %-38s %s\n' ok "$h" 'resolves')"$'\n'; resolver=1 ;;
    esac
  done < <(list_of "$DATA/blocklists/verify-allowed.txt")

  while read -r h; do
    line=$(dev "ping -c1 -W2 $h" | head -1)
    case $line in
      *0.0.0.0*|*127.0.0.1*) printf '%-10s %-38s %s\n' ok "$h" 'blocked' ;;
      *"unknown host"*|*"not known"*|*"cannot resolve"*|"")
        if [[ $resolver == 1 ]]; then
          printf '%-10s %-38s %s\n' ok "$h" 'blocked (NXDOMAIN)'
        else
          printf '%-10s %-38s %s\n' FAIL "$h" 'no answer from the resolver'; fail=1
        fi ;;
      *) printf '%-10s %-38s %s\n' FAIL "$h" 'NOT BLOCKED'; fail=1 ;;
    esac
  done < <(expected_blocked)
  printf '%s' "$allowed_rows"
fi

home=$(front_activity)
wake=$(dev 'dumpsys power' | sed -n 's/.*mWakefulness=\([A-Za-z]*\).*/\1/p' | head -1)
# Android 12 and later read min_futurity from DeviceConfig, not from the global setting.
if [[ $SDK -ge 31 ]]; then
  futurity=$(dev 'device_config get alarm_manager min_futurity' | tr -d '\r')
else
  futurity=$(dev 'settings get global alarm_manager_constants' | tr -d '\r' | tr ',' '\n' |
    sed -n 's/^min_futurity=//p' | head -1)
fi
if [[ $LAUNCHER == 0 ]]; then
  printf '%-10s %-38s %s\n' skip home "LAUNCHER=0, not checked"
elif [[ $SDK -lt 26 ]]; then
  # Fire OS 6 is below the fork's floor: it needs Android 8, and the home screen
  # there is the old launcher's. There is nothing of ours to check.
  printf '%-10s %-38s %s\n' skip home "Fire OS 6: AverageTV does not run on this TV; the old launcher is the home screen"
else
  # An enabled setting can outlive the process/binding. Check the current user's
  # exact component AND the live bound-service section, without sending HOME.
  # Which product is in charge is decided by the enabled guard component, and every
  # check below is about that product: the fork and the old launcher it falls back
  # to are two home screens, and the table has to say which one it is talking about.
  current_user=$(dev 'am get-current-user' | tr -d '\r')
  hook=unknown
  product=""
  user_ok=0
  case $current_user in
    ''|*[!0-9]*) ;;
    *)
      user_ok=1
      a11y=$(dev "settings --user $current_user get secure enabled_accessibility_services" | tr -d '\r')
      enabled=$(dev "settings --user $current_user get secure accessibility_enabled" | tr -d '\r')
      product=$(dumbtv_home_product_of "$a11y" || true)
      if [[ -n $product ]]; then
        IFS='|' read -r _ guard_class guard_label guard_activity product_name _ \
          <<< "$(dumbtv_home_product "$product")"
        if [[ $enabled == 1 ]]; then
          if dump=$(dev 'dumpsys accessibility'); then
            printf '%s\n' "$dump" | guard_bound "$current_user" "$guard_label" "$guard_class"
            case $? in 0) hook=bound ;; 1) hook=unbound ;; esac
          fi
        else
          hook=disabled
        fi
      fi ;;
  esac
  install_cmd=$(dumbtv_home_install_cmd "$product")
  [[ -n $install_cmd ]] || install_cmd='the install script'
  if [[ $product == tv.dumbtv.home ]]; then
    # The fallback launcher is in charge. It works, but it is not this repo's
    # product any more, so the check says so and says how to change that.
    printf '%-10s %-38s %s\n' FAIL home "the old launcher (fallback) is in charge; re-run $install_cmd"
    fail=1
  elif [[ -z $product ]]; then
    if [[ $user_ok == 1 ]]; then
      printf '%-10s %-38s %s\n' FAIL home "no AverageTV is in charge; no AverageTV guard is enabled"; fail=1
    else
      printf '%-10s %-38s %s\n' FAIL home "cannot verify accessibility binding; inspect dumpsys accessibility"; fail=1
    fi
  else
    case $hook in
      bound) printf '%-10s %-38s %s\n' ok home "$product_name: bound, front is ${home:-unknown}" ;;
      unbound)
        printf '%-10s %-38s %s\n' FAIL home "$product_name: enabled but not bound; see docs/TROUBLESHOOTING.md"; fail=1 ;;
      disabled)
        printf '%-10s %-38s %s\n' FAIL home "$product_name: hook disabled (front: ${home:-unknown}, wakefulness: ${wake:-?})"; fail=1 ;;
      *) printf '%-10s %-38s %s\n' FAIL home "$product_name: cannot verify accessibility binding; inspect dumpsys accessibility"; fail=1 ;;
    esac
  fi
  if [[ $futurity != 0 ]]; then
    # Without it HOME still works, but Amazon's home shows for 5 s first.
    printf '%-10s %-38s %s\n' FAIL home-speed "min_futurity=0 missing; re-run $install_cmd"; fail=1
  fi
  if [[ -z $product ]]; then
    printf '%-10s %-38s %s\n' skip home-key "no AverageTV is in charge"
  else
    # A bound accessibility service proves nothing about the swap: on Fire OS 8 the
    # launch can be refused by the background-activity-start rule even when the
    # service is enabled and bound. The only proof is the HOME key itself.
    # Leave the home screen first: a swap that starts while our own activity is
    # still resumed is allowed anyway, and that would hide a takeover that is
    # broken.
    [[ $wake == Awake ]] || { dev 'input keyevent KEYCODE_WAKEUP' >/dev/null 2>&1 || true; sleep 2; }
    dev 'am start -a android.intent.action.MAIN -c android.intent.category.LEANBACK_SETTINGS' >/dev/null 2>&1 || true
    for i in 1 2 3 4 5 6; do
      away=$(front_activity)
      [[ -n $away && $away != "$product"/* ]] && break
      sleep 1
    done
    if [[ -z $away || $away == "$product"/* ]]; then
      printf '%-10s %-38s %s\n' skip home-key "could not leave the home screen; press HOME to check"
    else
      dev 'input keyevent KEYCODE_HOME' >/dev/null 2>&1 || true
      # Amazon's home can show first while the swap is under way.
      for i in 1 2 3 4 5 6 7 8; do
        sleep 1
        landed=$(front_activity)
        [[ $landed == "$product"/* ]] && break
      done
      if home_activity_is "$landed" "$guard_activity"; then
        printf '%-10s %-38s %s\n' ok home-key "$product_name: HOME lands on $landed"
      else
        printf '%-10s %-38s %s\n' FAIL home-key "$product_name: HOME lands on ${landed:-unknown}"; fail=1
      fi
    fi
  fi
fi

off=$(dev 'pm list packages -d' | tr -d '\r')
printf '%-10s %-38s %s\n' packages "" "$(printf '%s\n' "$off" | grep -c '^package:') disabled"
dream=$(dream_package)
if [[ -n $dream ]] && grep -qx "package:$dream" <<<"$off"; then
  printf '%-10s %-38s %s\n' warn screensaver "$dream is disabled, so the TV sleeps at the timeout; run debloat.sh"
fi

if [[ $DNSFILTER == 0 ]]; then
  printf '%-10s %-38s %s\n' skip filter "not installed by choice"
else
  n=$(dev 'grep -c . /sdcard/Android/data/dnsfilter.android/files/PersonalDNSFilter/FILTERHOSTS.TXT 2>/dev/null' | tr -d '\r')
  if [[ $SDK -ge 30 ]] && ! [[ ${n:-0} -gt 0 ]] 2>/dev/null; then
    # Android 11 hides Android/data from adb; the blocked-host lookups above are the proof.
    printf '%-10s %-38s %s\n' skip filter "list not readable over adb on $(fireos_name); see the DNS checks"
  elif [[ ${n:-0} -gt 0 ]] 2>/dev/null; then
    printf '%-10s %-38s %s entries\n' ok filter "$n"
  else
    printf '%-10s %-38s %s\n' FAIL filter "missing or empty"; fail=1
  fi
  vpn=$(dev 'settings get secure always_on_vpn_app' | tr -d '\r')
  if ! present dnsfilter.android; then
    # Every VPN app gets a tunN, so a live tunnel proves nothing by itself: a
    # Surfshark or NordVPN tunnel used to be reported here as the filter.
    printf '%-10s %-38s %s\n' FAIL vpn "personalDNSfilter is not installed; set DNSFILTER=0 if a router filters DNS"; fail=1
  else
    # Fire OS 6 always forgets always_on_vpn_app at boot; at least one Fire OS 7
    # build (7.7.1.3 / PS7713) does too. The network's owner uid survives that, so
    # match it against the filter's uid. The interface name is not stable across
    # boots (seen tun0, then tun1 on the same device), hence any tunN.
    filter_uid=$(uid_of dnsfilter.android)
    vpn_uid=$(dev 'dumpsys connectivity' | grep -m1 'type: VPN' | sed -n 's/.*Uid: \([0-9][0-9]*\).*/\1/p')
    tunif=$(dev 'ip addr show' | sed -n 's/^[0-9]*: \(tun[0-9]*\):.*UP.*/\1/p' | head -1)
    if [[ -n $filter_uid && $vpn_uid == "$filter_uid" ]]; then
      printf '%-10s %-38s %s\n' ok vpn "${tunif:-VPN} owned by uid $vpn_uid (personalDNSfilter)"
    elif [[ -z $vpn_uid && $vpn == dnsfilter.android ]]; then
      printf '%-10s %-38s %s\n' ok vpn "$vpn (always-on)"
    elif [[ -n $tunif ]]; then
      printf '%-10s %-38s %s\n' FAIL vpn "$tunif belongs to another VPN (uid ${vpn_uid:-?}, filter uid ${filter_uid:-?})"; fail=1
    else
      printf '%-10s %-38s %s\n' FAIL vpn "${vpn:-unset}; no tun interface up; open personalDNSfilter once, then reboot"; fail=1
    fi
  fi
fi

if [[ $LAUNCHER == 0 ]]; then
  printf '%-10s %-38s %s\n' skip alarm "LAUNCHER=0, not checked"
elif [[ $SDK -lt 26 ]]; then
  printf '%-10s %-38s %s\n' skip alarm "Fire OS 6: AverageTV does not run on this TV"
else
  # AverageTV needs this to answer HOME immediately; an update can drop it.
  if [[ $futurity == 0 ]]; then
    printf '%-10s %-38s %s\n' ok alarm "min_futurity=0"
  else
    printf '%-10s %-38s %s\n' warn alarm "missing min_futurity=0 (HOME is slower, still works)"
  fi
fi

if [[ $fail == 0 ]]; then
  printf '\nall checks passed\n'
else
  printf '\nfailures above. Recovery steps: docs/TROUBLESHOOTING.md\n'
fi
exit $fail
