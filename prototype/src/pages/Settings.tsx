import * as React from "react"

/**
 * Settings: the things the household sets once.
 *
 * At the moment that is one thing: where Live TV gets its channels from. The provider's
 * host, user and password, or a playlist's address.
 *
 * The password is handed to the native side and forgotten here: it is sealed with the
 * television's own key and never comes back. Nothing on this screen ever holds it after
 * it is saved.
 *
 * **The field and the remote.** A television has no pointer, so the row is the thing the
 * remote's focus lands on, and the OK button puts the caret in the field — which brings
 * up the television's own on-screen keyboard. That keyboard's behaviour with the remote
 * has never been tried on a television, and it is the first thing to check on the Ember 55.
 *
 * The prototype has no native side behind it, so saving here only says the words. The
 * warning is live, though, because it is the one that matters: a host that is not on an
 * encrypted connection works in a development build and the shipping build will not
 * reach it.
 */
export function Settings() {
  const [host, setHost] = React.useState("")
  const [user, setUser] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [playlist, setPlaylist] = React.useState("")
  const [said, setSaid] = React.useState("")

  // A provider that is not on https is one the shipping build will not reach.
  const insecure = host.length > 0 && !/^https:\/\//i.test(host)

  return (
    <div className="px-16 pt-8">
      <h1 className="text-[72px] font-semibold leading-none tracking-tight">Settings</h1>

      <section data-focus-group="settings" className="mt-8">
        <h2 className="text-[32px] font-medium tracking-tight">Live TV</h2>
        <p className="mt-2 text-[24px] text-muted-foreground">
          Where the channels come from. Either a provider account, or a playlist.
        </p>

        <Field
          row={1}
          label="Provider host"
          value={host}
          onChange={setHost}
          placeholder="provider.example.com"
        />
        <Field
          row={2}
          label="User"
          value={user}
          onChange={setUser}
          placeholder="the account name"
        />
        <Field
          row={3}
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="the account password"
          secure
        />

        <button
          type="button"
          data-focusable
          data-row={4}
          data-col={1}
          onClick={() => {
            setSaid("Provider saved.")
            setPassword("")
          }}
          className="mt-6 rounded-xl bg-ember px-7 py-3.5 text-[26px] font-medium text-ember-foreground outline-none focus:ring-4 focus:ring-ring"
        >
          Save the provider
        </button>

        {insecure ? (
          <p className="mt-4 max-w-[900px] text-[24px] text-ember">
            This provider is not on an encrypted connection. It works in a development build,
            and the shipping build will not reach it.
          </p>
        ) : null}

        <Field
          row={5}
          label="Playlist address"
          value={playlist}
          onChange={setPlaylist}
          placeholder="https://…/playlist.m3u"
        />

        <button
          type="button"
          data-focusable
          data-row={6}
          data-col={1}
          onClick={() => setSaid("Playlist saved.")}
          className="mt-6 rounded-xl border border-border px-7 py-3.5 text-[26px] font-medium outline-none focus:ring-4 focus:ring-ring"
        >
          Save the playlist
        </button>

        {said ? <p className="mt-6 text-[24px] text-muted-foreground">{said}</p> : null}
      </section>
    </div>
  )
}

/**
 * One field.
 *
 * The row is the focusable thing: the remote lands on the row, and the OK button puts the
 * caret in the text. The text itself is not focusable, so the remote's arrows cannot
 * wander into it and leave the grid's model out of step with what is on the screen.
 */
function Field({
  row,
  label,
  value,
  onChange,
  placeholder,
  secure,
}: {
  row: number
  label: string
  value: string
  onChange: (text: string) => void
  placeholder: string
  secure?: boolean
}) {
  return (
    <div className="mt-5 max-w-[720px]">
      <span className="text-[19px] uppercase tracking-[0.95px] text-muted-foreground opacity-70">
        {label}
      </span>
      <div
        data-focusable
        data-row={row}
        data-col={1}
        tabIndex={-1}
        className="mt-2 rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-ring focus:bg-muted"
      >
        <input
          type={secure ? "password" : "text"}
          value={value}
          tabIndex={-1}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[28px] leading-9 text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  )
}
