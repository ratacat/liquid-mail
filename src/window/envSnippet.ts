export type ShellName = 'bash' | 'zsh';

export function windowEnvSnippet(shell: ShellName): string {
  const header = `# Liquid Mail window env (${shell})`;
  const begin = '# BEGIN LIQUID MAIL WINDOW ENV';
  const end = '# END LIQUID MAIL WINDOW ENV';
  const body = [
    begin,
    'if [ -z "${LIQUID_MAIL_WINDOW_ID:-}" ]; then',
    '  export LIQUID_MAIL_WINDOW_ID="lm$(printf \'%04x%04x%04x\' $RANDOM $RANDOM $RANDOM)"',
    'fi',
    end,
  ];
  return [header, ...body].join('\n');
}
