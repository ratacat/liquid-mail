export type ShellName = 'bash' | 'zsh';

export function windowEnvSnippet(shell: ShellName): string {
  const header = `# Liquid Mail window env (${shell})`;
  const begin = '# BEGIN LIQUID MAIL WINDOW ENV';
  const end = '# END LIQUID MAIL WINDOW ENV';
  const body = [
    begin,
    'if [ -z "${LIQUID_MAIL_WINDOW_ID:-}" ]; then',
    '  if command -v uuidgen >/dev/null 2>&1; then',
    '    LIQUID_MAIL_WINDOW_ID="lm$(uuidgen | tr -d - | tr \'[:upper:]\' \'[:lower:]\' | cut -c1-12)"',
    '  else',
    '    LIQUID_MAIL_WINDOW_ID="lm$(date -u +%y%m%d%H%M%S)${RANDOM}${RANDOM}"',
    '  fi',
    '  export LIQUID_MAIL_WINDOW_ID',
    'fi',
    end,
  ];
  return [header, ...body].join('\n');
}
