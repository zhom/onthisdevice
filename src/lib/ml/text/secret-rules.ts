/**
 * Secret detection for logs, code and config: provider key formats, private
 * key blocks, tokens in headers and URLs, passwords in config lines, and long
 * random strings found by their entropy.
 *
 * Provider names below are labels for the user ("GitHub token"); each format
 * is the documented or observed prefix and length of that provider's keys.
 */
import { entropy } from './checks'
import type { EntityType, Span } from './types'

export interface SecretRule {
  id: string
  /** What the user sees in the findings list. */
  label: string
  /** Placeholder word for the secrets scrubber, for example GITHUB_TOKEN. */
  tag: string
  re: RegExp
  /** Group that holds the secret; 0 (default) is the whole match. */
  group?: number
  /** Cheap substring test before the regex runs. */
  hint?: string | RegExp
  check?: (value: string) => boolean
  type?: EntityType
}

const hasDigit = (v: string) => /\d/.test(v)

/** At least 60 provider formats plus generic secrets. Order does not matter; spans are merged. */
export const SECRET_RULES: SecretRule[] = [
  // Cloud
  { id: 'aws-access-key', label: 'AWS access key ID', tag: 'AWS_ACCESS_KEY', re: /\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g },
  {
    id: 'aws-secret-key',
    label: 'AWS secret access key',
    tag: 'AWS_SECRET_KEY',
    re: /\baws_?(?:secret_?access_?key|secret_?key)["']?\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})(?![A-Za-z0-9/+=])/gi,
    group: 1,
    hint: /aws/i,
  },
  { id: 'aws-session-token', label: 'AWS session token', tag: 'AWS_SESSION_TOKEN', re: /\baws_?session_?token["']?\s*[:=]\s*["']?([A-Za-z0-9/+=]{100,})/gi, group: 1, hint: /aws/i },
  { id: 'gcp-api-key', label: 'Google API key', tag: 'GOOGLE_API_KEY', re: /\bAIza[0-9A-Za-z_-]{35}(?![\w-])/g, hint: 'AIza' },
  { id: 'gcp-oauth-secret', label: 'Google OAuth client secret', tag: 'GOOGLE_CLIENT_SECRET', re: /\bGOCSPX-[A-Za-z0-9_-]{28}(?![\w-])/g, hint: 'GOCSPX-' },
  { id: 'gcp-oauth-token', label: 'Google OAuth token', tag: 'GOOGLE_TOKEN', re: /\bya29\.[0-9A-Za-z_-]{20,}/g, hint: 'ya29.' },
  { id: 'gcp-refresh-token', label: 'Google refresh token', tag: 'GOOGLE_TOKEN', re: /\b1\/\/0[0-9A-Za-z_-]{40,}/g, hint: '1//0' },
  {
    id: 'azure-storage-key',
    label: 'Azure storage key',
    tag: 'AZURE_KEY',
    re: /\b(?:AccountKey|SharedAccessKey)\s*=\s*([A-Za-z0-9+/]{40,}={0,2})/g,
    group: 1,
    hint: /AccessKey|AccountKey/,
  },
  { id: 'azure-client-secret', label: 'Azure client secret', tag: 'AZURE_CLIENT_SECRET', re: /(?<![\w~.-])[A-Za-z0-9_~.]{3}\dQ~[A-Za-z0-9_~.-]{31,34}(?![\w~.-])/g, hint: 'Q~' },
  { id: 'azure-sas', label: 'Azure SAS signature', tag: 'AZURE_SAS', re: /[?&]sig=([A-Za-z0-9%+/=]{30,})/g, group: 1, hint: 'sig=' },
  { id: 'digitalocean', label: 'DigitalOcean token', tag: 'DIGITALOCEAN_TOKEN', re: /\bdo[por]_v1_[a-f0-9]{64}\b/g, hint: '_v1_' },
  { id: 'alibaba', label: 'Alibaba Cloud access key', tag: 'ALIBABA_KEY', re: /\bLTAI[A-Za-z0-9]{12,20}\b/g, hint: 'LTAI' },
  { id: 'scaleway', label: 'Scaleway access key', tag: 'SCALEWAY_KEY', re: /\bSCW[A-Z0-9]{17}\b/g, hint: 'SCW' },
  { id: 'cloudflare-origin-ca', label: 'Cloudflare Origin CA key', tag: 'CLOUDFLARE_KEY', re: /\bv1\.0-[a-f0-9]{24}-[a-f0-9]{146}\b/g, hint: 'v1.0-' },
  { id: 'fly', label: 'Fly.io token', tag: 'FLY_TOKEN', re: /\b(?:fo1_[A-Za-z0-9_-]{43}|FlyV1 fm[12][a-z]?_[A-Za-z0-9+/=,_-]{100,})/g, hint: /fo1_|FlyV1/ },
  { id: 'heroku', label: 'Heroku API key', tag: 'HEROKU_KEY', re: /\bHRKU-AA[0-9A-Za-z_-]{58}\b/g, hint: 'HRKU-' },
  { id: 'databricks', label: 'Databricks token', tag: 'DATABRICKS_TOKEN', re: /\bdapi[a-f0-9]{32}(?:-\d)?\b/g, hint: 'dapi' },
  { id: 'hashicorp-vault', label: 'Vault token', tag: 'VAULT_TOKEN', re: /\bhv[sbr]\.[A-Za-z0-9_-]{24,}/g, hint: /hv[sbr]\./ },
  { id: 'terraform', label: 'Terraform Cloud token', tag: 'TERRAFORM_TOKEN', re: /\b[a-z0-9]{14}\.atlasv1\.[a-z0-9_=-]{60,70}\b/g, hint: 'atlasv1' },
  { id: 'pulumi', label: 'Pulumi token', tag: 'PULUMI_TOKEN', re: /\bpul-[a-f0-9]{40}\b/g, hint: 'pul-' },
  { id: 'doppler', label: 'Doppler token', tag: 'DOPPLER_TOKEN', re: /\bdp\.(?:pt|st|sa|ct|scim|audit)\.[A-Za-z0-9]{40,44}\b/g, hint: 'dp.' },
  { id: 'supabase', label: 'Supabase key', tag: 'SUPABASE_KEY', re: /\b(?:sbp_[a-f0-9]{40}|sb_secret_[A-Za-z0-9_-]{30,})\b/g, hint: /sbp_|sb_secret_/ },
  { id: 'planetscale', label: 'PlanetScale token', tag: 'PLANETSCALE_TOKEN', re: /\bpscale_(?:tkn|pw|oauth)_[A-Za-z0-9_.-]{32,64}/g, hint: 'pscale_' },
  // Code hosting and packages
  { id: 'github-token', label: 'GitHub token', tag: 'GITHUB_TOKEN', re: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g, hint: /gh[pousr]_/ },
  { id: 'github-pat', label: 'GitHub token', tag: 'GITHUB_TOKEN', re: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g, hint: 'github_pat_' },
  { id: 'gitlab-token', label: 'GitLab token', tag: 'GITLAB_TOKEN', re: /\bgl(?:pat|ptt|dt|rt|cbt|ft|soat|imt|agent|oas)-[A-Za-z0-9_-]{20,}/g, hint: /gl[a-z]+-/ },
  { id: 'bitbucket', label: 'Bitbucket app password', tag: 'BITBUCKET_TOKEN', re: /\bATBB[A-Za-z0-9_=.-]{32,}\b/g, hint: 'ATBB' },
  { id: 'atlassian', label: 'Atlassian API token', tag: 'ATLASSIAN_TOKEN', re: /\bATATT3[A-Za-z0-9_=-]{150,}/g, hint: 'ATATT3' },
  { id: 'npm', label: 'npm token', tag: 'NPM_TOKEN', re: /\bnpm_[A-Za-z0-9]{36}\b/g, hint: 'npm_' },
  { id: 'pypi', label: 'PyPI token', tag: 'PYPI_TOKEN', re: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}/g, hint: 'pypi-' },
  { id: 'rubygems', label: 'RubyGems key', tag: 'RUBYGEMS_KEY', re: /\brubygems_[a-f0-9]{48}\b/g, hint: 'rubygems_' },
  { id: 'nuget', label: 'NuGet key', tag: 'NUGET_KEY', re: /\boy2[a-z0-9]{43}\b/g, hint: 'oy2' },
  { id: 'clojars', label: 'Clojars token', tag: 'CLOJARS_TOKEN', re: /\bCLOJARS_[a-z0-9]{60}\b/g, hint: 'CLOJARS_' },
  { id: 'dockerhub', label: 'Docker Hub token', tag: 'DOCKER_TOKEN', re: /\bdckr_(?:pat|oat)_[A-Za-z0-9_-]{27,}/g, hint: 'dckr_' },
  // AI providers
  { id: 'openai', label: 'OpenAI API key', tag: 'OPENAI_KEY', re: /\bsk-(?:proj-|svcacct-|admin-|None-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}/g, hint: 'T3BlbkFJ' },
  { id: 'openai-project', label: 'OpenAI API key', tag: 'OPENAI_KEY', re: /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,}/g, hint: 'sk-' },
  { id: 'anthropic', label: 'Anthropic API key', tag: 'ANTHROPIC_KEY', re: /\bsk-ant-(?:api|admin|sid)\d{2}-[A-Za-z0-9_-]{60,}/g, hint: 'sk-ant-' },
  { id: 'openrouter', label: 'OpenRouter key', tag: 'OPENROUTER_KEY', re: /\bsk-or-v1-[a-f0-9]{64}\b/g, hint: 'sk-or-' },
  { id: 'huggingface', label: 'Hugging Face token', tag: 'HF_TOKEN', re: /\b(?:hf_[A-Za-z0-9]{34,40}|api_org_[A-Za-z0-9]{34})\b/g, hint: /hf_|api_org_/ },
  { id: 'groq', label: 'Groq API key', tag: 'GROQ_KEY', re: /\bgsk_[A-Za-z0-9]{52}\b/g, hint: 'gsk_' },
  { id: 'xai', label: 'xAI API key', tag: 'XAI_KEY', re: /\bxai-[A-Za-z0-9]{80}\b/g, hint: 'xai-' },
  { id: 'perplexity', label: 'Perplexity API key', tag: 'PERPLEXITY_KEY', re: /\bpplx-[A-Za-z0-9]{48}\b/g, hint: 'pplx-' },
  { id: 'replicate', label: 'Replicate token', tag: 'REPLICATE_TOKEN', re: /\br8_[A-Za-z0-9]{37}\b/g, hint: 'r8_' },
  { id: 'deepseek-like', label: 'API key', tag: 'API_KEY', re: /\bsk-[a-f0-9]{32}\b/g, hint: 'sk-' },
  { id: 'openai-legacy', label: 'API key', tag: 'API_KEY', re: /\bsk-[A-Za-z0-9]{48}\b/g, hint: 'sk-' },
  // Payments
  { id: 'stripe-secret', label: 'Stripe secret key', tag: 'STRIPE_KEY', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g, hint: /[sr]k_(?:live|test)_/ },
  { id: 'stripe-webhook', label: 'Stripe webhook secret', tag: 'STRIPE_WEBHOOK_SECRET', re: /\bwhsec_[A-Za-z0-9+/=]{32,}/g, hint: 'whsec_' },
  { id: 'stripe-publishable', label: 'Stripe publishable key', tag: 'STRIPE_PUBLISHABLE_KEY', re: /\bpk_(?:live|test)_[A-Za-z0-9]{20,}\b/g, hint: 'pk_' },
  { id: 'square', label: 'Square token', tag: 'SQUARE_TOKEN', re: /\b(?:EAAA[A-Za-z0-9_-]{60}|sq0atp-[0-9A-Za-z_-]{22}|sq0csp-[0-9A-Za-z_-]{43})\b/g, hint: /EAAA|sq0/ },
  { id: 'braintree', label: 'Braintree token', tag: 'BRAINTREE_TOKEN', re: /\baccess_token\$(?:production|sandbox)\$[0-9a-z]{16}\$[0-9a-f]{32}\b/g, hint: 'access_token$' },
  { id: 'shopify', label: 'Shopify token', tag: 'SHOPIFY_TOKEN', re: /\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b/g, hint: 'shp' },
  { id: 'razorpay', label: 'Razorpay key', tag: 'RAZORPAY_KEY', re: /\brzp_(?:live|test)_[A-Za-z0-9]{14}\b/g, hint: 'rzp_' },
  { id: 'flutterwave', label: 'Flutterwave key', tag: 'FLUTTERWAVE_KEY', re: /\bFLWSECK(?:_TEST)?-[a-h0-9]{32}-X\b/g, hint: 'FLWSECK' },
  { id: 'easypost', label: 'EasyPost key', tag: 'EASYPOST_KEY', re: /\bEZ[AT]K[a-zA-Z0-9]{54}\b/g, hint: /EZ[AT]K/ },
  { id: 'shippo', label: 'Shippo token', tag: 'SHIPPO_TOKEN', re: /\bshippo_(?:live|test)_[a-f0-9]{40}\b/g, hint: 'shippo_' },
  { id: 'duffel', label: 'Duffel token', tag: 'DUFFEL_TOKEN', re: /\bduffel_(?:test|live)_[A-Za-z0-9_=-]{43}/g, hint: 'duffel_' },
  // Messaging and email
  { id: 'slack-token', label: 'Slack token', tag: 'SLACK_TOKEN', re: /\bxox[abposr]-(?:\d+-)?[A-Za-z0-9-]{10,}/g, hint: 'xox' },
  { id: 'slack-app-token', label: 'Slack app token', tag: 'SLACK_TOKEN', re: /\bxapp-\d-[A-Z0-9]+-\d+-[a-z0-9]+\b/g, hint: 'xapp-' },
  { id: 'slack-webhook', label: 'Slack webhook', tag: 'SLACK_WEBHOOK', re: /https:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9/_-]{20,}/g, hint: 'hooks.slack.com' },
  { id: 'discord-webhook', label: 'Discord webhook', tag: 'DISCORD_WEBHOOK', re: /https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g, hint: 'discord' },
  { id: 'discord-bot', label: 'Discord bot token', tag: 'DISCORD_TOKEN', re: /\b[MNO][A-Za-z\d_-]{23,25}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,38}\b/g },
  { id: 'teams-webhook', label: 'Teams webhook', tag: 'TEAMS_WEBHOOK', re: /https:\/\/[a-z0-9-]+\.webhook\.office\.com\/webhookb2\/[A-Za-z0-9@/_-]+/g, hint: 'webhook.office.com' },
  { id: 'telegram-bot', label: 'Telegram bot token', tag: 'TELEGRAM_TOKEN', re: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/g, hint: ':AA' },
  { id: 'twilio-key', label: 'Twilio API key', tag: 'TWILIO_KEY', re: /\bSK[0-9a-fA-F]{32}\b/g, hint: 'SK' },
  { id: 'twilio-sid', label: 'Twilio account SID', tag: 'TWILIO_SID', re: /\bAC[a-f0-9]{32}\b/g, hint: 'AC' },
  { id: 'sendgrid', label: 'SendGrid key', tag: 'SENDGRID_KEY', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, hint: 'SG.' },
  { id: 'mailgun', label: 'Mailgun key', tag: 'MAILGUN_KEY', re: /\bkey-[0-9a-zA-Z]{32}\b/g, hint: 'key-' },
  { id: 'mailchimp', label: 'Mailchimp key', tag: 'MAILCHIMP_KEY', re: /\b[0-9a-f]{32}-us\d{1,2}\b/g, hint: '-us' },
  { id: 'postmark', label: 'Postmark token', tag: 'POSTMARK_TOKEN', re: /\bX-Postmark-Server-Token:\s*([0-9a-f-]{36})/gi, group: 1, hint: /postmark/i },
  { id: 'resend', label: 'Resend key', tag: 'RESEND_KEY', re: /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{24}\b/g, hint: 're_' },
  // Productivity and dev tools
  { id: 'linear', label: 'Linear key', tag: 'LINEAR_KEY', re: /\blin_(?:api|oauth)_[A-Za-z0-9]{40}\b/g, hint: 'lin_' },
  { id: 'notion', label: 'Notion token', tag: 'NOTION_TOKEN', re: /\b(?:secret_[A-Za-z0-9]{43}|ntn_[A-Za-z0-9]{46})\b/g, hint: /secret_|ntn_/ },
  { id: 'figma', label: 'Figma token', tag: 'FIGMA_TOKEN', re: /\bfig[dur]_[A-Za-z0-9_-]{40,}/g, hint: 'fig' },
  { id: 'postman', label: 'Postman key', tag: 'POSTMAN_KEY', re: /\bPMAK-[a-f0-9]{24}-[a-f0-9]{34}\b/g, hint: 'PMAK-' },
  { id: 'sentry-token', label: 'Sentry token', tag: 'SENTRY_TOKEN', re: /\b(?:sntrys_[A-Za-z0-9+/=_-]{50,}|sntryu_[a-f0-9]{64})/g, hint: 'sntry' },
  { id: 'sentry-dsn', label: 'Sentry DSN', tag: 'SENTRY_DSN', re: /https:\/\/([a-f0-9]{32})@[a-z0-9.-]*sentry\.io\/\d+/g, group: 1, hint: 'sentry' },
  { id: 'newrelic', label: 'New Relic key', tag: 'NEWRELIC_KEY', re: /\b(?:NRAK-[A-Z0-9]{27}|NRII-[A-Za-z0-9_-]{32}|NRJS-[a-f0-9]{19}|NRAA-[a-f0-9]{27})\b/g, hint: 'NR' },
  { id: 'grafana', label: 'Grafana token', tag: 'GRAFANA_TOKEN', re: /\b(?:glc_[A-Za-z0-9+/]{32,}={0,2}|glsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8})/g, hint: /gl[cs]a?_/ },
  { id: 'dropbox', label: 'Dropbox token', tag: 'DROPBOX_TOKEN', re: /\bsl\.[A-Za-z0-9_-]{130,}/g, hint: 'sl.' },
  { id: 'asana', label: 'Asana token', tag: 'ASANA_TOKEN', re: /\b[012]\/\d{10,16}(?:\/\d{10,16})?:[A-Za-z0-9]{32}\b/g },
  { id: 'airtable', label: 'Airtable token', tag: 'AIRTABLE_TOKEN', re: /\bpat[A-Za-z0-9]{14}\.[a-f0-9]{64}\b/g, hint: 'pat' },
  { id: 'mapbox', label: 'Mapbox secret token', tag: 'MAPBOX_TOKEN', re: /\bsk\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, hint: 'sk.eyJ' },
  { id: 'contentful', label: 'Contentful token', tag: 'CONTENTFUL_TOKEN', re: /\bCFPAT-[A-Za-z0-9_-]{43}\b/g, hint: 'CFPAT-' },
  { id: 'typeform', label: 'Typeform token', tag: 'TYPEFORM_TOKEN', re: /\btfp_[A-Za-z0-9_.=-]{59}/g, hint: 'tfp_' },
  { id: 'readme', label: 'ReadMe key', tag: 'README_KEY', re: /\brdme_[a-z0-9]{70}\b/g, hint: 'rdme_' },
  { id: 'prefect', label: 'Prefect key', tag: 'PREFECT_KEY', re: /\bpnu_[A-Za-z0-9]{36}\b/g, hint: 'pnu_' },
  { id: 'frameio', label: 'Frame.io token', tag: 'FRAMEIO_TOKEN', re: /\bfio-u-[A-Za-z0-9_=-]{64}\b/g, hint: 'fio-u-' },
  { id: 'facebook', label: 'Facebook access token', tag: 'FACEBOOK_TOKEN', re: /\bEAA[BCDGIQ][A-Za-z0-9]{80,}\b/g, hint: 'EAA' },
  { id: 'twitter-bearer', label: 'X bearer token', tag: 'X_TOKEN', re: /\bAAAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%]{30,}/g, hint: 'AAAAAAAAAA' },
  { id: 'age-key', label: 'age secret key', tag: 'AGE_KEY', re: /\bAGE-SECRET-KEY-1[QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L]{58}\b/g, hint: 'AGE-SECRET' },
  // Generic structures
  {
    id: 'private-key',
    label: 'Private key',
    tag: 'PRIVATE_KEY',
    re: /-----BEGIN ((?:[A-Z0-9]+ )*)PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END \1PRIVATE KEY(?: BLOCK)?-----/g,
    hint: 'PRIVATE KEY',
  },
  {
    id: 'private-key-open',
    label: 'Private key',
    tag: 'PRIVATE_KEY',
    re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----(?:\\n|\s)+[A-Za-z0-9+/=\s\\n]{40,}/g,
    hint: 'PRIVATE KEY',
  },
  { id: 'putty-key', label: 'PuTTY private key', tag: 'PRIVATE_KEY', re: /Private-Lines: \d+\r?\n((?:[A-Za-z0-9+/=]+\r?\n)+)/g, group: 1, hint: 'Private-Lines' },
  { id: 'jwt', label: 'JSON web token', tag: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, hint: 'eyJ' },
  {
    id: 'url-password',
    label: 'Password in a URL',
    tag: 'PASSWORD',
    re: /\b[a-z][a-z0-9+.-]{1,20}:\/\/[^\s:/?#@"']+:([^\s/?#@"']+)@/gi,
    group: 1,
    hint: '://',
    check: (v) => !/^\$|^\{\{|^<.+>$|^\*+$/.test(v),
  },
  {
    id: 'auth-header',
    label: 'Authorization header',
    tag: 'TOKEN',
    re: /\b(?:Bearer|Basic|Token|Digest|Bot|ApiKey|SSWS)\s+([A-Za-z0-9\-._~+/]{8,}=*)/g,
    group: 1,
    check: (v) => /\d/.test(v) || v.length >= 20,
  },
  {
    id: 'api-key-header',
    label: 'API key header',
    tag: 'API_KEY',
    re: /\b(?:x-api-key|x-auth-token|x-access-token|api-key|apikey|x-goog-api-key|ocp-apim-subscription-key|private-token|x-functions-key)\s*:\s*["']?([A-Za-z0-9\-._~+/]{12,}=*)/gi,
    group: 1,
  },
  {
    id: 'cookie',
    label: 'Cookie value',
    tag: 'COOKIE',
    re: /\b(?:session|sess|sid|token|auth|jwt|remember|connect\.sid|PHPSESSID|JSESSIONID|ASP\.NET_SessionId|laravel_session|_session_id|csrftoken|sessionid|__Secure-[\w-]+|__Host-[\w-]+)=([A-Za-z0-9%._~+/=-]{12,})/gi,
    group: 1,
    check: hasDigit,
  },
  {
    id: 'npmrc-auth',
    label: 'Registry auth token',
    tag: 'TOKEN',
    re: /\/\/[^\s:]+\/:_(?:authToken|auth|password)=([^\s]+)/g,
    group: 1,
    hint: ':_auth',
  },
]

/* ------------------------------------------------------------------ */
/* Passwords and keys in config lines                                  */
/* ------------------------------------------------------------------ */

/**
 * A key that ends with a secret word, an assignment, and a value:
 * DB_PASSWORD=..., "apiKey": "...", client_secret: ..., password => '...'.
 */
const ASSIGN =
  /(?<![\w-])(["']?)((?:[A-Za-z_$][\w.$-]{0,60}?)?(?:password|passwd|passphrase|pwd|_pass|-pass|\.pass|\bpass|secret|token|api[_.-]?key|apikey|access[_.-]?key|account[_.-]?key|private[_.-]?key|secret[_.-]?key|signing[_.-]?key|encryption[_.-]?key|master[_.-]?key|client[_.-]?secret|app[_.-]?secret|auth[_.-]?key|credentials?|session[_.-]?(?:id|key|secret)|cookie[_.-]?secret|salt|dsn|connection[_.-]?string|conn[_.-]?str|webhook[_.-]?(?:url|secret)))\1\s*(?::=|=>|\+=|=|:)\s*(?:"([^"\n]{1,300})"|'([^'\n]{1,300})'|`([^`\n]{1,300})`|([^\s"'`,;)}\]]{1,300}))/gi

const NOT_A_VALUE = new Set([
  'null', 'none', 'nil', 'true', 'false', 'undefined', 'string', 'str', 'number', 'int', 'integer',
  'boolean', 'bool', 'any', 'object', 'required', 'optional', 'password', 'secret', 'token', 'redacted',
  '[redacted]', 'hidden', 'masked', 'xxx', 'xxxx', 'xxxxx', '****', '*****', '********', 'yes', 'no', 'on', 'off',
  'env', 'void', 'unknown', 'never', 'text', 'char', 'varchar', 'bytes', 'buffer', 'uuid', 'self', 'this',
  'new', 'function', 'func', 'fn', 'lambda', 'async', 'await', 'return', 'type', 'interface', 'class',
  'default', 'empty', 'blank', 'value', 'placeholder', 'example', 'your-password', 'your_password',
])

function plausibleSecretValue(value: string, key: string, quoted: boolean): boolean {
  const v = value.trim()
  if (v.length < 3) return false
  if (!quoted && /[([{]/.test(v)) return false // a call, a lookup or an object
  if (NOT_A_VALUE.has(v.toLowerCase())) return false
  if (/^[*x•.]+$/i.test(v)) return false // already masked
  if (/^(?:\$\{|\$\(|\$[A-Z_]|%[A-Z_]+%|\{\{|<[^>]*>$|#\{|@\{|%\()/.test(v)) return false // template or env ref
  if (/[([]/.test(v) && /[)\]]$/.test(v)) return false // a call or a lookup
  if (/^(?:process\.env|os\.environ|env\.|import\.meta|getenv|System\.getenv|config\.|settings\.|ENV\[)/.test(v)) return false
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(v) && !/\d/.test(v)) return false // member access
  if (/^\d{1,3}$/.test(v)) return false
  // "token: 3600" style numbers are counts or lengths, unless the key is a password.
  if (/^\d+(?:\.\d+)?$/.test(v) && !/pass|pwd|pin/i.test(key)) return false
  // "password: string" in a type and "token = None" in code are covered above; a lone
  // identifier after "token" in prose ("the token is valid") is too.
  if (/^[a-z]+$/.test(v) && v.length < 6 && !/pass|pwd/i.test(key)) return false
  return true
}

function findAssignments(text: string, out: Span[]) {
  for (const m of text.matchAll(ASSIGN)) {
    const key = m[2]
    const value = m[3] ?? m[4] ?? m[5] ?? m[6]
    if (value === undefined) continue
    if (/(?:^|[_.-])(?:type|length|len|count|size|limit|max|min|expir\w*|ttl|url|uri|endpoint|name|id|path|file|header|field|prefix|format)$/i.test(key) && !/webhook|dsn/i.test(key)) continue
    if (/^(?:max_?tokens?|tokens?_?limit|num_?tokens|token_?count)$/i.test(key)) continue
    const quoted = m[3] !== undefined || m[4] !== undefined || m[5] !== undefined
    if (!plausibleSecretValue(value, key, quoted)) continue
    const valueStart = m.index + m[0].length - value.length - (quoted ? 1 : 0)
    let start = valueStart
    let end = valueStart + value.length
    // A Bearer value keeps its scheme word visible.
    const scheme = /^(?:Bearer|Basic|Token)\s+/.exec(value)
    if (scheme) start += scheme[0].length
    while (end > start && /\s/.test(text[end - 1])) end--
    const pw = /pass|pwd/i.test(key)
    out.push({
      start,
      end,
      type: 'SECRET',
      source: 'rule',
      score: 0.9,
      rule: pw ? 'config-password' : 'config-secret',
      label: pw ? 'Password' : 'Secret in config',
    })
  }
}

/* ------------------------------------------------------------------ */
/* Long random strings                                                 */
/* ------------------------------------------------------------------ */

const RANDOM_CAND = /(?<![A-Za-z0-9+/_\-.])[A-Za-z0-9+/_-]{24,200}={0,2}(?![A-Za-z0-9+/=_-])/g

function classOf(c: string): number {
  if (c >= 'a' && c <= 'z') return 0
  if (c >= 'A' && c <= 'Z') return 1
  if (c >= '0' && c <= '9') return 2
  return 3
}

/** True for strings that look machine-random rather than like words, paths or hashes. */
export function looksRandom(s: string): boolean {
  const core = s.replace(/=+$/, '')
  if (core.length < 24) return false
  const lower = (core.match(/[a-z]/g) ?? []).length
  const upper = (core.match(/[A-Z]/g) ?? []).length
  const digit = (core.match(/\d/g) ?? []).length
  if (lower < 3 || upper < 3 || digit < 2) return false // hex hashes and words do not qualify
  if (entropy(core) < 4.1) return false
  let transitions = 0
  for (let i = 1; i < core.length; i++) if (classOf(core[i]) !== classOf(core[i - 1])) transitions++
  if (transitions / core.length < 0.38) return false // camelCase identifiers switch class less often
  // Words: random text rarely has four lowercase letters in a row.
  let inRuns = 0
  for (const run of core.match(/[a-z]{4,}/g) ?? []) inRuns += run.length
  if (inRuns / core.length > 0.25) return false
  // Paths: several slash-separated parts that read like words.
  const parts = core.split('/')
  if (parts.length >= 3 && parts.filter((p) => /^[A-Za-z][a-z]{2,}$/.test(p)).length >= 2) return false
  return true
}

const HASH_CONTEXT = /(?:sha\d*|md5|sha-?\d+|integrity|digest|checksum|hash|commit|etag|nonce-|base64,|blake\w*|crc32|fingerprint|tx|txid|block|address)[\s:=-]*["']?$/i

function findRandom(text: string, out: Span[]) {
  for (const m of text.matchAll(RANDOM_CAND)) {
    const v = m[0]
    if (/^(?:sha\d{1,3}|md5)[-_]/i.test(v)) continue
    if (!looksRandom(v)) continue
    if (HASH_CONTEXT.test(text.slice(Math.max(0, m.index - 24), m.index))) continue
    out.push({ start: m.index, end: m.index + v.length, type: 'SECRET', source: 'rule', score: 0.6, rule: 'high-entropy', label: 'Random string' })
  }
}

/* ------------------------------------------------------------------ */
/* Internal host names                                                 */
/* ------------------------------------------------------------------ */

const INTERNAL_HOST =
  /(?<![\w.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:internal|local|lan|corp|intranet|private|home\.arpa|localdomain|svc\.cluster\.local|ec2\.internal|compute\.internal)(?![\w-]|\.[a-z])/gi

function findInternalHosts(text: string, out: Span[]) {
  for (const m of text.matchAll(INTERNAL_HOST)) {
    out.push({ start: m.index, end: m.index + m[0].length, type: 'URL', source: 'rule', score: 0.85, rule: 'internal-host', label: 'Internal host name' })
  }
}

const RULE_BY_ID = new Map(SECRET_RULES.map((r) => [r.id, r]))

export function secretRule(id: string | undefined): SecretRule | undefined {
  return id ? RULE_BY_ID.get(id) : undefined
}

/** All secret rules. Not merged; overlapping spans are expected. */
export function findSecrets(text: string, options: { entropy?: boolean; hosts?: boolean } = {}): Span[] {
  const out: Span[] = []
  for (const rule of SECRET_RULES) {
    if (rule.hint) {
      if (typeof rule.hint === 'string' ? !text.includes(rule.hint) : !rule.hint.test(text)) continue
    }
    rule.re.lastIndex = 0
    for (const m of text.matchAll(rule.re)) {
      const g = rule.group ?? 0
      const value = m[g]
      if (!value) continue
      if (rule.check && !rule.check(value)) continue
      const start = g === 0 ? m.index : m.index + m[0].lastIndexOf(value)
      out.push({ start, end: start + value.length, type: rule.type ?? 'SECRET', source: 'rule', score: 0.98, rule: rule.id, label: rule.label })
    }
  }
  findAssignments(text, out)
  if (options.entropy !== false) findRandom(text, out)
  if (options.hosts) findInternalHosts(text, out)
  return out
}
