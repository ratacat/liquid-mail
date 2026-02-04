export type HookShell = 'bash' | 'zsh';

export function hookSnippet(shell: HookShell): string {
  const header = `# Liquid Mail notify hook (${shell})`;
  const body = [
    'if [ -z "${LIQUID_MAIL_WINDOW_ID:-}" ]; then',
    '  if command -v uuidgen >/dev/null 2>&1; then',
    '    LIQUID_MAIL_WINDOW_ID="lm-$(uuidgen | tr -d - | cut -c1-8)"',
    '  else',
    '    LIQUID_MAIL_WINDOW_ID="lm-$(date -u +%y%m%d-%H%M%S)-${RANDOM}${RANDOM}"',
    '  fi',
    '  export LIQUID_MAIL_WINDOW_ID',
    'fi',
    'if [ "${LIQUID_MAIL_NOTIFY_ON_START:-0}" = "1" ] && [ -n "${LIQUID_MAIL_WINDOW_ID:-}" ]; then',
    '  liquid-mail notify || true',
    'fi',
  ];
  return [header, ...body].join('\n');
}
