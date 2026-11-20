import { LEGAL_APP_NAME, LEGAL_UPDATED_AT } from './legal.constants'

export interface ILegalPage {
  title: string
  body: string
}

export function renderLegalPage({ title, body }: ILegalPage): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · ${LEGAL_APP_NAME}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6;max-width:720px;margin:0 auto;padding:24px;color:#1c1c1e}
h1{margin-bottom:4px}
h2{margin-top:32px}
.updated{color:#6e6e73;margin-top:0}
a{color:#0a64d8}
@media(prefers-color-scheme:dark){body{background:#000;color:#f2f2f7}.updated{color:#98989d}a{color:#4da3ff}}
</style>
</head>
<body>
<h1>${title}</h1>
<p class="updated">Last updated: ${LEGAL_UPDATED_AT}</p>
${body}
</body>
</html>`
}
