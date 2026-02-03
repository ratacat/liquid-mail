export type HookShell = 'bash' | 'zsh';

export function hookSnippet(shell: HookShell): string {
  const header = `# Liquid Mail notify hook (${shell})`;
  const body = [
    'if [ "${LIQUID_MAIL_NOTIFY_ON_START:-0}" = "1" ] && [ -n "${LIQUID_MAIL_AGENT_ID:-}" ]; then',
    '  liquid-mail notify --agent-id "${LIQUID_MAIL_AGENT_ID}" || true',
    'fi',
  ];
  return [header, ...body].join('\n');
}
