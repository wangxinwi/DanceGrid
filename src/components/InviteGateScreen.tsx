import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type InviteGateScreenProps = {
  locale: "zh" | "en";
  onSubmitInviteCode: (inviteCode: string) => Promise<void> | void;
};

const copyByLocale = {
  zh: {
    title: "输入邀请码",
    description:
      "这是内测版本, 请输入邀请码。",
    field: "邀请码",
    placeholder: "例如 DG-1000-ABCD",
    action: "验证并进入",
    helpTitle: "说明",
    helpBody: "如果你在本地调试，并且还没有接上 Worker，可以先使用 LOCAL-100 继续开发。",
    error: "暂时无法验证邀请码。",
  },
  en: {
    title: "Enter invite code",
    description:
      "This is a closed beta with 100 seats. Your invite code is checked by a Cloudflare Worker before the app opens. All class data stays local on your device.",
    field: "Invite code",
    placeholder: "e.g. DG-1000-ABCD",
    action: "Verify and enter",
    helpTitle: "Note",
    helpBody: "For local development, you can use LOCAL-100 before the Worker endpoint is connected.",
    error: "Unable to verify the invite code right now.",
  },
} as const;

export function InviteGateScreen({ locale, onSubmitInviteCode }: InviteGateScreenProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const showLocalDevHelp = import.meta.env.DEV;
  const copy = copyByLocale[locale];

  useEffect(() => {
    setMessage("");
  }, [locale]);

  const handleSubmit = async () => {
    const normalized = inviteCode.trim();
    if (!normalized) {
      setMessage(copy.error);
      return;
    }

    setBusy(true);
    try {
      await onSubmitInviteCode(normalized);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="invite-gate">
      <section className="invite-card">
        <span className="eyebrow">DanceGrid</span>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>

        <div className="invite-fields">
          <label className="ui-field">
            <span>{copy.field}</span>
            <input
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder={copy.placeholder}
              autoComplete="one-time-code"
              spellCheck={false}
              inputMode="text"
            />
          </label>
        </div>

        {showLocalDevHelp ? (
          <div className="invite-note">
            <strong>{copy.helpTitle}</strong>
            <p>{copy.helpBody}</p>
          </div>
        ) : null}

        {message ? <p className="invite-message">{message}</p> : null}

        <div className="invite-actions">
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            {copy.action}
          </Button>
        </div>
      </section>
    </main>
  );
}
