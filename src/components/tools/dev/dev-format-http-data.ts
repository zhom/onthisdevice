/**
 * HTTP status code reference data for the `dev-format` batch.
 *
 * Sources are the RFCs themselves (RFC 9110 for the core semantics, plus the
 * extension RFCs named per entry) and the IANA HTTP Status Code Registry.
 * Vendor-specific codes are marked `standard: false` so the pages never imply
 * they are part of HTTP.
 */

export type StatusClass = '1xx' | '2xx' | '3xx' | '4xx' | '5xx'

export interface HttpStatus {
  code: number
  title: string
  klass: StatusClass
  /** One-sentence definition, in plain language. */
  summary: string
  /** Why a developer actually sees this one. */
  causes: string[]
  /** What to do about it. */
  fixes: string[]
  /** e.g. "RFC 9110 §15.5.5" */
  reference: string
  /** False for vendor extensions (Cloudflare, nginx, AWS). */
  standard: boolean
  /** Cacheable by default per RFC 9110 §15. */
  cacheable?: boolean
  /** Worth retrying the same request. */
  retryable?: boolean
}

export const STATUS_CLASSES: { id: StatusClass; title: string; blurb: string }[] = [
  {
    id: '1xx',
    title: '1xx Informational',
    blurb:
      'The request was received and the process is continuing. A client will normally never surface these to a user; they are handshake traffic.',
  },
  {
    id: '2xx',
    title: '2xx Success',
    blurb:
      'The request was received, understood and accepted. The differences between them are about what the body contains and what the client should do with its current view.',
  },
  {
    id: '3xx',
    title: '3xx Redirection',
    blurb:
      'Further action is needed to complete the request. The critical distinctions are permanent vs temporary (which affects SEO and browser caching) and whether the method may change.',
  },
  {
    id: '4xx',
    title: '4xx Client Error',
    blurb:
      'The request was malformed, unauthorised or asked for something that is not there. Retrying the identical request will normally fail identically.',
  },
  {
    id: '5xx',
    title: '5xx Server Error',
    blurb:
      'The server knows it failed. The request may have been perfectly valid, so an automated client should usually back off and retry the idempotent ones.',
  },
]

export const HTTP_STATUSES: HttpStatus[] = [
  /* ---------------------------- 1xx ---------------------------- */
  {
    code: 100,
    title: 'Continue',
    klass: '1xx',
    summary:
      'The server has received the request headers and the client should go ahead and send the body.',
    causes: [
      'The client sent `Expect: 100-continue` before uploading a large body, so it could be rejected on headers alone.',
      'curl adds this header automatically for POST bodies over 1 KB.',
    ],
    fixes: [
      'Nothing to fix. This is normal handshake traffic.',
      'If a proxy chokes on it, send `Expect:` (empty) to suppress the header. In curl: `-H "Expect:"`.',
    ],
    reference: 'RFC 9110 §15.2.1',
    standard: true,
  },
  {
    code: 101,
    title: 'Switching Protocols',
    klass: '1xx',
    summary: 'The server is switching to the protocol the client asked for in `Upgrade`.',
    causes: [
      'A WebSocket handshake succeeded. This is the response to `Upgrade: websocket`.',
      'An HTTP/1.1 to HTTP/2 upgrade over cleartext (h2c).',
    ],
    fixes: [
      'Nothing to fix on a successful WebSocket connection.',
      'If you expected 101 and got 200, an intermediary stripped the `Upgrade` header. Check the proxy configuration.',
    ],
    reference: 'RFC 9110 §15.2.2',
    standard: true,
  },
  {
    code: 102,
    title: 'Processing',
    klass: '1xx',
    summary:
      'A WebDAV interim response telling the client the server is still working so it does not time out.',
    causes: ['A long-running WebDAV method such as PROPFIND or MOVE on a large collection.'],
    fixes: ['Nothing. Wait for the final status. Deprecated in favour of 103 Early Hints.'],
    reference: 'RFC 2518 §10.1',
    standard: true,
  },
  {
    code: 103,
    title: 'Early Hints',
    klass: '1xx',
    summary:
      'Preliminary headers (usually `Link: rel=preload`) sent before the real response so the browser can start fetching assets.',
    causes: ['A server or CDN sending resource hints while the origin is still generating the page.'],
    fixes: [
      'Nothing to fix. If hints are ignored, check the client supports them and that no intermediary is buffering the response.',
    ],
    reference: 'RFC 8297',
    standard: true,
  },

  /* ---------------------------- 2xx ---------------------------- */
  {
    code: 200,
    title: 'OK',
    klass: '2xx',
    summary: 'The request succeeded and the body contains the result.',
    causes: ['The normal outcome for GET, and for POST/PUT that return a representation.'],
    fixes: [
      'Nothing to fix, but beware a 200 carrying an error payload. Returning `200 {"error": "..."}` breaks every generic HTTP client, retry policy and monitor.',
    ],
    reference: 'RFC 9110 §15.3.1',
    standard: true,
    cacheable: true,
  },
  {
    code: 201,
    title: 'Created',
    klass: '2xx',
    summary: 'The request succeeded and created one or more new resources.',
    causes: ['A POST that created a record; a PUT to a URL that did not previously exist.'],
    fixes: [
      'Include a `Location` header pointing at the new resource. Clients rely on it and many APIs forget it.',
    ],
    reference: 'RFC 9110 §15.3.2',
    standard: true,
  },
  {
    code: 202,
    title: 'Accepted',
    klass: '2xx',
    summary: 'The request was accepted for processing, but the processing has not finished.',
    causes: ['An asynchronous job was queued: a bulk import, a video encode, an email send.'],
    fixes: [
      'Return a status URL the client can poll, otherwise the client has no way to learn the outcome.',
    ],
    reference: 'RFC 9110 §15.3.3',
    standard: true,
  },
  {
    code: 203,
    title: 'Non-Authoritative Information',
    klass: '2xx',
    summary:
      'The request succeeded, but a transforming proxy modified the response the origin sent.',
    causes: ['A proxy that compresses images, strips comments or rewrites HTML.'],
    fixes: [
      'If you need untouched bytes, send `Cache-Control: no-transform`.',
    ],
    reference: 'RFC 9110 §15.3.4',
    standard: true,
    cacheable: true,
  },
  {
    code: 204,
    title: 'No Content',
    klass: '2xx',
    summary: 'The request succeeded and deliberately has no body.',
    causes: ['A successful DELETE; a PUT that returns nothing; a form save handled by JavaScript.'],
    fixes: [
      'A 204 must not have a body. Sending one confuses HTTP/1.1 clients about message framing.',
      'If your `fetch` code throws parsing JSON, guard on `response.status === 204` before calling `.json()`.',
    ],
    reference: 'RFC 9110 §15.3.5',
    standard: true,
    cacheable: true,
  },
  {
    code: 205,
    title: 'Reset Content',
    klass: '2xx',
    summary: 'The request succeeded and the client should reset the document view, for example clear the form.',
    causes: ['A data-entry form designed for repeated submission.'],
    fixes: ['Rarely used in modern apps; a 204 plus a client-side reset is more common.'],
    reference: 'RFC 9110 §15.3.6',
    standard: true,
  },
  {
    code: 206,
    title: 'Partial Content',
    klass: '2xx',
    summary: 'The server is returning only the byte range the client asked for.',
    causes: [
      'A video player seeking within a file.',
      'A download manager resuming an interrupted transfer.',
      'A client sent a `Range` header.',
    ],
    fixes: [
      'The response must include `Content-Range` and, for a single range, must not include a full `Content-Length` of the whole file.',
      'If seeking does not work in a `<video>` element, the server is probably ignoring `Range` and returning 200 with the whole file.',
    ],
    reference: 'RFC 9110 §15.3.7',
    standard: true,
    cacheable: true,
  },
  {
    code: 207,
    title: 'Multi-Status',
    klass: '2xx',
    summary: 'A WebDAV response whose XML body carries a separate status for each sub-request.',
    causes: ['A PROPFIND or batch operation across several resources.'],
    fixes: [
      'Parse the body: a 207 does not mean everything succeeded. Individual entries can still be 403 or 424.',
    ],
    reference: 'RFC 4918 §11.1',
    standard: true,
  },
  {
    code: 208,
    title: 'Already Reported',
    klass: '2xx',
    summary:
      'Inside a WebDAV 207 body, marks a resource whose members were already enumerated in an earlier part of the response.',
    causes: ['A recursive PROPFIND over a collection that appears in more than one binding.'],
    fixes: ['Nothing. It exists to stop the same subtree being sent twice.'],
    reference: 'RFC 5842 §7.1',
    standard: true,
  },
  {
    code: 226,
    title: 'IM Used',
    klass: '2xx',
    summary:
      'The server applied one or more instance manipulations (such as a delta encoding) to the current representation.',
    causes: ['Delta encoding with `A-IM: feed`, used by a small number of RSS caches.'],
    fixes: ['Very rare in practice; no action needed.'],
    reference: 'RFC 3229 §10.4.1',
    standard: true,
  },

  /* ---------------------------- 3xx ---------------------------- */
  {
    code: 300,
    title: 'Multiple Choices',
    klass: '3xx',
    summary: 'The request has more than one possible response and the client must pick.',
    causes: ['Agent-driven content negotiation. Almost never used on the public web.'],
    fixes: ['Prefer server-driven negotiation with `Vary` and a single 200.'],
    reference: 'RFC 9110 §15.4.1',
    standard: true,
    cacheable: true,
  },
  {
    code: 301,
    title: 'Moved Permanently',
    klass: '3xx',
    summary: 'The resource has a new permanent URL, given in `Location`.',
    causes: [
      'A site moved to HTTPS, to a new domain, or from /old-page to /new-page.',
      'A canonical-URL rule adding or removing a trailing slash or www.',
    ],
    fixes: [
      'Browsers cache 301s hard, sometimes indefinitely. If you 301 by mistake, visitors keep being redirected after you fix the server. Test with 302 first, then switch to 301 once you are sure.',
      'For SEO, a 301 passes ranking signals; a 302 does not reliably.',
      'Old clients may turn a 301 on POST into a GET. Use 308 if the method must be preserved.',
    ],
    reference: 'RFC 9110 §15.4.2',
    standard: true,
    cacheable: true,
  },
  {
    code: 302,
    title: 'Found',
    klass: '3xx',
    summary: 'The resource is temporarily at a different URL. Keep using the original URL.',
    causes: [
      'A post-login redirect back to the requested page.',
      'A framework default: most web frameworks send 302 for `redirect()`.',
    ],
    fixes: [
      'Historically, clients rewrote POST to GET on a 302 even though the spec forbade it. Use 303 when you want that behaviour and 307 when you do not.',
    ],
    reference: 'RFC 9110 §15.4.3',
    standard: true,
  },
  {
    code: 303,
    title: 'See Other',
    klass: '3xx',
    summary: 'The result of the request is at another URL, which the client should fetch with GET.',
    causes: ['The POST/Redirect/GET pattern that stops a browser refresh re-submitting a form.'],
    fixes: [
      'Use this status, and not 302, for "form submitted, now go look at the result".',
    ],
    reference: 'RFC 9110 §15.4.4',
    standard: true,
  },
  {
    code: 304,
    title: 'Not Modified',
    klass: '3xx',
    summary:
      'The cached copy the client already holds is still fresh, so no body is sent.',
    causes: [
      'The client sent `If-None-Match` with an ETag that still matches.',
      'The client sent `If-Modified-Since` and the resource has not changed.',
    ],
    fixes: [
      'A 304 must not have a body, and must repeat the headers that would have been sent with a 200 (notably `ETag` and `Cache-Control`).',
      'Seeing stale content? Your ETag probably does not change when the content does. Hash the body; do not use the mtime of a rebuilt file.',
    ],
    reference: 'RFC 9110 §15.4.5',
    standard: true,
  },
  {
    code: 305,
    title: 'Use Proxy',
    klass: '3xx',
    summary: 'Deprecated. The resource must be accessed through the proxy named in `Location`.',
    causes: ['Effectively never seen. It was deprecated for security reasons.'],
    fixes: ['Do not use. Browsers ignore it.'],
    reference: 'RFC 9110 §15.4.6',
    standard: true,
  },
  {
    code: 307,
    title: 'Temporary Redirect',
    klass: '3xx',
    summary:
      'Same as 302, but the method and body must not be changed when following the redirect.',
    causes: [
      'An API redirecting a POST to a different host without losing the body.',
      'HSTS-preloaded upgrades from HTTP to HTTPS.',
    ],
    fixes: [
      'Use 307 rather than 302 whenever the request is not a GET and the body matters.',
    ],
    reference: 'RFC 9110 §15.4.8',
    standard: true,
  },
  {
    code: 308,
    title: 'Permanent Redirect',
    klass: '3xx',
    summary: 'Same as 301, but the method and body must not be changed.',
    causes: ['A permanent API endpoint move that must not turn POSTs into GETs.'],
    fixes: [
      'Like 301, this is cached aggressively. Confirm the destination is right before deploying.',
    ],
    reference: 'RFC 9110 §15.4.9',
    standard: true,
    cacheable: true,
  },

  /* ---------------------------- 4xx ---------------------------- */
  {
    code: 400,
    title: 'Bad Request',
    klass: '4xx',
    summary: 'The server refuses to process the request because it is malformed.',
    causes: [
      'Invalid JSON in the body, such as a trailing comma or a truncated payload.',
      'A header that is too large, or contains an illegal character.',
      'A query string with an invalid percent-encoding, such as a bare `%`.',
      'A missing required parameter, where the API chose 400 over 422.',
    ],
    fixes: [
      'Log the raw body server-side and validate it. Most 400s are a serialisation bug on the client.',
      'If the request works with curl but not from a browser, compare the exact headers; a stray cookie or oversized `Authorization` header is a common culprit.',
      'nginx returns 400 for oversized request headers before your application ever sees them; raise `large_client_header_buffers` if that is the cause.',
    ],
    reference: 'RFC 9110 §15.5.1',
    standard: true,
  },
  {
    code: 401,
    title: 'Unauthorized',
    klass: '4xx',
    summary:
      'The request lacks valid authentication credentials. Despite the name, it means "unauthenticated".',
    causes: [
      'No `Authorization` header, or an expired token.',
      'A token signed with the wrong key, or for the wrong audience.',
      'Basic auth credentials that do not match.',
    ],
    fixes: [
      'A 401 response must include a `WWW-Authenticate` header naming the scheme. Many APIs omit it, which is a spec violation.',
      'Refresh the token and retry once. Only once, or you will build a redirect loop.',
      'If you meant "you are logged in but not allowed", the correct status is 403.',
    ],
    reference: 'RFC 9110 §15.5.2',
    standard: true,
  },
  {
    code: 402,
    title: 'Payment Required',
    klass: '4xx',
    summary: 'Reserved for future use; in practice, a payment or quota wall.',
    causes: ['A SaaS API signalling an expired subscription or an exhausted credit balance.'],
    fixes: [
      'Not standardised, so read the vendor documentation. Check the response body for the specific reason.',
    ],
    reference: 'RFC 9110 §15.5.3',
    standard: true,
  },
  {
    code: 403,
    title: 'Forbidden',
    klass: '4xx',
    summary:
      'The server understood the request and is refusing it. Authenticating again will not help.',
    causes: [
      'The user is logged in but lacks the permission or role.',
      'Filesystem permissions on a static file the web server cannot read.',
      'Directory listing is disabled and there is no index file.',
      'A WAF, bot rule or IP allowlist blocked the request.',
      'S3: the object exists but the bucket policy denies it, or the object does not exist and the bucket hides that with 403.',
    ],
    fixes: [
      'Distinguish it from 401: 401 means "who are you?", 403 means "I know who you are and no".',
      'For static files, check ownership and mode (`chmod 644` for files, `755` for directories) and SELinux context if applicable.',
      'For a CDN or WAF, look at the request ID in the response headers and find it in the edge logs.',
    ],
    reference: 'RFC 9110 §15.5.4',
    standard: true,
  },
  {
    code: 404,
    title: 'Not Found',
    klass: '4xx',
    summary: 'The server has no representation for this URL and will not say whether it ever did.',
    causes: [
      'The URL is wrong: a typo, a stale link, or a case-sensitivity mismatch on a Linux server.',
      'The route exists in your code but not in the deployed build.',
      'A rewrite rule is missing, so a single-page app route is being handed to the file server.',
      'The resource was deleted (410 would be more informative).',
    ],
    fixes: [
      'Check the server access log: a 404 with the exact requested path tells you whether the request even reached your application.',
      'For SPAs, add a catch-all rewrite to `index.html`.',
      'Serve a useful 404 page with search and links. It is often the highest-traffic error page on a site.',
      'Do not return 404 with a 200 status ("soft 404"); search engines treat that as a duplicate-content problem.',
    ],
    reference: 'RFC 9110 §15.5.5',
    standard: true,
    cacheable: true,
  },
  {
    code: 405,
    title: 'Method Not Allowed',
    klass: '4xx',
    summary: 'The URL exists, but not for the HTTP method you used.',
    causes: [
      'POSTing to a route that only defines GET.',
      'A trailing-slash redirect turning a POST into a GET, which then 405s.',
      'A static host that only serves GET and HEAD receiving a POST.',
    ],
    fixes: [
      'The response must include an `Allow` header listing the methods that are supported. Read it. It tells you exactly what to change.',
      'Check for a redirect immediately before the failing request; that is the usual cause when the same call works in Postman.',
    ],
    reference: 'RFC 9110 §15.5.6',
    standard: true,
  },
  {
    code: 406,
    title: 'Not Acceptable',
    klass: '4xx',
    summary:
      'The server cannot produce a response matching the `Accept` headers the client sent.',
    causes: [
      'A client asking for `Accept: application/xml` from a JSON-only API.',
      'An over-strict `Accept-Language` or `Accept-Encoding` negotiation.',
      'Mod_security rules on shared hosting frequently return 406 for requests they dislike.',
    ],
    fixes: [
      'Relax the `Accept` header to `*/*` to confirm negotiation is the cause.',
      'Most APIs are better off ignoring `Accept` and returning their one format with a 200.',
    ],
    reference: 'RFC 9110 §15.5.7',
    standard: true,
  },
  {
    code: 407,
    title: 'Proxy Authentication Required',
    klass: '4xx',
    summary: 'Like 401, but the credentials are needed by a proxy rather than the origin server.',
    causes: ['A corporate HTTP proxy requiring authentication.'],
    fixes: [
      'Set proxy credentials in the client (`https_proxy=http://user:pass@host:port`) and read the `Proxy-Authenticate` header for the scheme.',
    ],
    reference: 'RFC 9110 §15.5.8',
    standard: true,
  },
  {
    code: 408,
    title: 'Request Timeout',
    klass: '4xx',
    summary: 'The client took too long to send the complete request, so the server gave up.',
    causes: [
      'A slow upload on a poor connection.',
      'An idle keep-alive connection being closed. Browsers often show this after the fact.',
      'A client that opened a connection and sent nothing.',
    ],
    fixes: [
      'Raise the server read timeout for endpoints that accept large uploads.',
      'Retry is safe for idempotent requests.',
    ],
    reference: 'RFC 9110 §15.5.9',
    standard: true,
    retryable: true,
  },
  {
    code: 409,
    title: 'Conflict',
    klass: '4xx',
    summary: 'The request conflicts with the current state of the resource.',
    causes: [
      'A duplicate create: the unique key already exists.',
      'An optimistic-concurrency failure: the record changed since you read it.',
      'A git-style push rejected because the ref moved.',
    ],
    fixes: [
      'Include enough detail in the body for the client to resolve it: which field conflicted, and what the current value is.',
      'For concurrency, pair it with ETags and `If-Match` so the client can re-read and retry.',
    ],
    reference: 'RFC 9110 §15.5.10',
    standard: true,
  },
  {
    code: 410,
    title: 'Gone',
    klass: '4xx',
    summary: 'The resource used to exist here and has been permanently removed.',
    causes: ['A deliberately retired endpoint or a deleted account page.'],
    fixes: [
      'Prefer 410 over 404 when you know the resource is gone: search engines de-index a 410 much faster.',
    ],
    reference: 'RFC 9110 §15.5.11',
    standard: true,
    cacheable: true,
  },
  {
    code: 411,
    title: 'Length Required',
    klass: '4xx',
    summary: 'The server refuses the request without a `Content-Length` header.',
    causes: ['A chunked or streaming request to a server that will not accept one.'],
    fixes: ['Buffer the body and send an explicit `Content-Length`.'],
    reference: 'RFC 9110 §15.5.12',
    standard: true,
  },
  {
    code: 412,
    title: 'Precondition Failed',
    klass: '4xx',
    summary: 'A conditional header such as `If-Match` or `If-Unmodified-Since` did not hold.',
    causes: ['Optimistic locking: the ETag you sent no longer matches the current resource.'],
    fixes: ['Re-fetch the resource, merge your change onto the newer version and retry.'],
    reference: 'RFC 9110 §15.5.13',
    standard: true,
  },
  {
    code: 413,
    title: 'Content Too Large',
    klass: '4xx',
    summary: 'The request body is bigger than the server is willing to process.',
    causes: [
      'A file upload over the server limit.',
      'nginx `client_max_body_size` (default 1 MB).',
      'Apache `LimitRequestBody`; PHP `upload_max_filesize` / `post_max_size`.',
      'An API gateway payload cap (AWS API Gateway: 10 MB).',
    ],
    fixes: [
      'Raise the limit on every hop. The proxy, the app server and the language runtime all have their own.',
      'For large files, use chunked or presigned direct-to-storage uploads instead of proxying through the app.',
      'Formerly called "Payload Too Large" and, before that, "Request Entity Too Large".',
    ],
    reference: 'RFC 9110 §15.5.14',
    standard: true,
  },
  {
    code: 414,
    title: 'URI Too Long',
    klass: '4xx',
    summary: 'The request target is longer than the server will accept.',
    causes: [
      'A GET with a huge query string, such as a search form submitted with GET instead of POST.',
      'nginx `large_client_header_buffers`, Apache `LimitRequestLine` (default 8190 bytes).',
    ],
    fixes: ['Move the payload into a POST body, or shorten the parameters.'],
    reference: 'RFC 9110 §15.5.15',
    standard: true,
  },
  {
    code: 415,
    title: 'Unsupported Media Type',
    klass: '4xx',
    summary: 'The body format named in `Content-Type` is one the endpoint does not accept.',
    causes: [
      'Sending JSON without `Content-Type: application/json`.',
      'Sending `application/x-www-form-urlencoded` to a JSON-only API, or vice versa.',
      'A missing `charset` on a server that insists on one.',
    ],
    fixes: [
      'Set `Content-Type` explicitly. `fetch()` defaults to `text/plain` for a string body, which is the single most common cause of this error.',
    ],
    reference: 'RFC 9110 §15.5.16',
    standard: true,
  },
  {
    code: 416,
    title: 'Range Not Satisfiable',
    klass: '4xx',
    summary: 'The byte range asked for lies outside the size of the resource.',
    causes: ['A resumed download where the local file is already larger than the remote one.'],
    fixes: [
      'Delete the partial file and start again, or issue a HEAD first to read `Content-Length`.',
    ],
    reference: 'RFC 9110 §15.5.17',
    standard: true,
  },
  {
    code: 417,
    title: 'Expectation Failed',
    klass: '4xx',
    summary: 'The server cannot meet the requirement in the `Expect` header.',
    causes: ['A proxy that does not implement `Expect: 100-continue`.'],
    fixes: ['Suppress the header: in curl, `-H "Expect:"`.'],
    reference: 'RFC 9110 §15.5.18',
    standard: true,
  },
  {
    code: 418,
    title: "I'm a teapot",
    klass: '4xx',
    summary:
      'An April Fools joke from 1998 that became a permanent fixture. The teapot refuses to brew coffee.',
    causes: ['Someone implemented it deliberately, or an API is using it as a decoy for bot traffic.'],
    fixes: [
      'Never use it in production. It is reserved by IANA specifically so nobody assigns 418 to a real meaning.',
    ],
    reference: 'RFC 2324 §2.3.2',
    standard: true,
  },
  {
    code: 421,
    title: 'Misdirected Request',
    klass: '4xx',
    summary:
      'The request was sent to a server that cannot produce a response for this authority.',
    causes: [
      'HTTP/2 connection coalescing: the client reused a connection for a second hostname on the same IP and certificate, and the server disagreed.',
      'A TLS certificate covering multiple domains behind a server that is not configured for all of them.',
    ],
    fixes: [
      'Clients should retry on a fresh connection. On the server, make sure every hostname on a shared certificate is configured as a virtual host.',
    ],
    reference: 'RFC 9110 §15.5.20',
    standard: true,
    retryable: true,
  },
  {
    code: 422,
    title: 'Unprocessable Content',
    klass: '4xx',
    summary:
      'The syntax is fine and the content type is understood, but the data itself fails validation.',
    causes: [
      'A valid JSON body with a semantically invalid field, such as an email without an @ or an end date before the start date.',
      'Rails, Laravel and FastAPI use 422 as the default validation-error status.',
    ],
    fixes: [
      'Return a per-field error map in the body. A bare 422 with no detail is the least useful response an API can give.',
      'If the body was not parseable at all, 400 is the more accurate status.',
    ],
    reference: 'RFC 9110 §15.5.21',
    standard: true,
  },
  {
    code: 423,
    title: 'Locked',
    klass: '4xx',
    summary: 'The WebDAV resource is locked.',
    causes: ['Another client holds a WebDAV write lock on the file or collection.'],
    fixes: ['Wait for the lock, or send the correct lock token in `If`.'],
    reference: 'RFC 4918 §11.3',
    standard: true,
  },
  {
    code: 424,
    title: 'Failed Dependency',
    klass: '4xx',
    summary: 'The request failed because a previous request it depended on failed.',
    causes: ['A WebDAV batch where an earlier operation in the same transaction failed.'],
    fixes: ['Fix the upstream failure; this status is a consequence, not a cause.'],
    reference: 'RFC 4918 §11.4',
    standard: true,
  },
  {
    code: 425,
    title: 'Too Early',
    klass: '4xx',
    summary:
      'The server will not risk processing a request sent in TLS early data, because it could be replayed.',
    causes: ['A non-idempotent request sent in a TLS 1.3 0-RTT handshake.'],
    fixes: ['Retry once the handshake completes; do not send POSTs in early data.'],
    reference: 'RFC 8470 §5.2',
    standard: true,
    retryable: true,
  },
  {
    code: 426,
    title: 'Upgrade Required',
    klass: '4xx',
    summary: 'The server refuses this protocol version and names an alternative in `Upgrade`.',
    causes: ['A server that requires TLS, or requires HTTP/2.'],
    fixes: ['Follow the `Upgrade` header. This is also how some APIs enforce a minimum client version.'],
    reference: 'RFC 9110 §15.5.22',
    standard: true,
  },
  {
    code: 428,
    title: 'Precondition Required',
    klass: '4xx',
    summary:
      'The server requires the request to be conditional, to prevent the lost-update problem.',
    causes: ['An API that insists on `If-Match` for every update.'],
    fixes: ['GET the resource, take its ETag and resend with `If-Match: "<etag>"`.'],
    reference: 'RFC 6585 §3',
    standard: true,
  },
  {
    code: 429,
    title: 'Too Many Requests',
    klass: '4xx',
    summary: 'The client has sent too many requests in a given amount of time (rate limited).',
    causes: [
      'A tight polling loop or an un-throttled batch job.',
      'A shared IP (office NAT, CI runner) hitting a per-IP limit.',
      'A retry storm: a failure causing every client to retry simultaneously.',
    ],
    fixes: [
      'Read the `Retry-After` header and wait exactly that long. If it is absent, back off exponentially with jitter.',
      'Cache aggressively and batch requests. Most 429s are caused by asking for the same data repeatedly.',
      'On the server, send `RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset` so clients can self-regulate.',
    ],
    reference: 'RFC 6585 §4',
    standard: true,
    retryable: true,
  },
  {
    code: 431,
    title: 'Request Header Fields Too Large',
    klass: '4xx',
    summary: 'The header block, or one individual header, is too big.',
    causes: [
      'Cookie bloat: a domain collects dozens of tracking cookies until every request exceeds the limit.',
      'A very long `Referer` or a huge JWT in `Authorization`.',
    ],
    fixes: [
      'Clear cookies for the domain to confirm the cause, then trim what you set.',
      'Keep JWTs small: put a session ID in the cookie and the claims in your own store.',
    ],
    reference: 'RFC 6585 §5',
    standard: true,
  },
  {
    code: 451,
    title: 'Unavailable For Legal Reasons',
    klass: '4xx',
    summary: 'Access is denied because of a legal demand: a court order, a takedown, a geoblock.',
    causes: ['A DMCA takedown, a national blocking order, or GDPR-driven geographic restriction.'],
    fixes: [
      'The response should include a `Link` header with `rel="blocked-by"` identifying who imposed the block.',
      'The number is a reference to Ray Bradbury\'s Fahrenheit 451.',
    ],
    reference: 'RFC 7725',
    standard: true,
  },
  {
    code: 499,
    title: 'Client Closed Request',
    klass: '4xx',
    summary: 'Non-standard nginx code: the client disconnected before the server replied.',
    causes: [
      'A user navigated away or hit stop while a slow request was in flight.',
      'A load balancer or client library timeout shorter than the server response time.',
      'A mobile client losing connectivity mid-request.',
    ],
    fixes: [
      'Usually harmless if occasional. A spike means your responses are slower than your clients are willing to wait. Compare `upstream_response_time` with the client timeout.',
    ],
    reference: 'nginx (non-standard)',
    standard: false,
  },

  /* ---------------------------- 5xx ---------------------------- */
  {
    code: 500,
    title: 'Internal Server Error',
    klass: '5xx',
    summary: 'The server hit an unhandled condition. It is a catch-all, not a diagnosis.',
    causes: [
      'An unhandled exception in application code.',
      'A database connection failure or a missing environment variable in the deployed build.',
      'A syntax error in server configuration, or a bad `.htaccess` directive.',
      'File permissions preventing a script from executing.',
    ],
    fixes: [
      'The status tells you nothing. Go straight to the server error log. In nginx that is usually `/var/log/nginx/error.log`; in a PaaS, the platform log stream.',
      'Reproduce with the same request locally and turn on stack traces in a non-production environment only.',
      'Never leak a stack trace to the client; return a request ID and log the detail server-side.',
    ],
    reference: 'RFC 9110 §15.6.1',
    standard: true,
    retryable: true,
  },
  {
    code: 501,
    title: 'Not Implemented',
    klass: '5xx',
    summary: 'The server does not support the functionality required to fulfil the request.',
    causes: ['An unrecognised HTTP method such as PATCH on an old server, or an unimplemented route.'],
    fixes: [
      'Unlike 405, this means the method is unsupported by the server as a whole, not just for this URL.',
    ],
    reference: 'RFC 9110 §15.6.2',
    standard: true,
    cacheable: true,
  },
  {
    code: 502,
    title: 'Bad Gateway',
    klass: '5xx',
    summary:
      'A proxy or gateway got an invalid response, or no response, from the server behind it.',
    causes: [
      'The upstream application crashed or is not listening on the expected port or socket.',
      'The upstream returned a malformed response, or closed the connection early.',
      'A deploy in progress: the old process stopped before the new one was ready.',
      'A container health check failing so the load balancer has no healthy targets.',
    ],
    fixes: [
      'Check whether the upstream process is running and bound to the address the proxy expects (`ss -ltnp`).',
      'Read the proxy error log. nginx logs the exact upstream address and failure reason.',
      'For zero-downtime deploys, start the new process and confirm it is healthy before stopping the old one.',
    ],
    reference: 'RFC 9110 §15.6.3',
    standard: true,
    retryable: true,
  },
  {
    code: 503,
    title: 'Service Unavailable',
    klass: '5xx',
    summary: 'The server is temporarily unable to handle the request: it is overloaded or down for maintenance.',
    causes: [
      'Deliberate maintenance mode.',
      'The worker pool or connection pool is exhausted.',
      'Autoscaling has not caught up with a traffic spike.',
      'A dependency (database, cache) is unreachable and the app is failing fast.',
    ],
    fixes: [
      'Send a `Retry-After` header. This is the one status where clients act on it.',
      'Check pool saturation before adding capacity; a slow query holding connections looks identical to a traffic spike.',
      'Return 503, not 500, for planned maintenance: search engines will keep the page indexed.',
    ],
    reference: 'RFC 9110 §15.6.4',
    standard: true,
    retryable: true,
  },
  {
    code: 504,
    title: 'Gateway Timeout',
    klass: '5xx',
    summary: 'A proxy waited for an upstream response and gave up.',
    causes: [
      'A slow query or an external API call exceeding the proxy timeout.',
      'nginx `proxy_read_timeout` (default 60 s); AWS ALB idle timeout (default 60 s); Cloudflare (100 s).',
      'A deadlock or an infinite loop in the upstream handler.',
    ],
    fixes: [
      'Find the slow operation first. Raising the timeout hides the problem and makes an outage last longer.',
      'For genuinely long jobs, return 202 with a polling URL instead of holding the connection open.',
      'Every hop has its own timeout; raise them consistently or the shortest one wins.',
    ],
    reference: 'RFC 9110 §15.6.5',
    standard: true,
    retryable: true,
  },
  {
    code: 505,
    title: 'HTTP Version Not Supported',
    klass: '5xx',
    summary: 'The server refuses the major HTTP version used in the request.',
    causes: ['A very old client speaking HTTP/0.9, or a malformed request line misread as a version.'],
    fixes: ['Usually indicates a corrupted request rather than a genuine version problem.'],
    reference: 'RFC 9110 §15.6.6',
    standard: true,
  },
  {
    code: 506,
    title: 'Variant Also Negotiates',
    klass: '5xx',
    summary: 'A content-negotiation misconfiguration: a variant is itself set up to negotiate.',
    causes: ['Transparent content negotiation configured in a loop.'],
    fixes: ['Fix the negotiation configuration; this is a server bug, not a client one.'],
    reference: 'RFC 2295 §8.1',
    standard: true,
  },
  {
    code: 507,
    title: 'Insufficient Storage',
    klass: '5xx',
    summary: 'The server cannot store the representation needed to complete the request.',
    causes: ['A WebDAV quota exhausted, or a full disk.'],
    fixes: ['Free space or raise the quota. Check inode usage as well as bytes (`df -i`).'],
    reference: 'RFC 4918 §11.5',
    standard: true,
  },
  {
    code: 508,
    title: 'Loop Detected',
    klass: '5xx',
    summary: 'The server detected an infinite loop while processing the request.',
    causes: ['A WebDAV collection that contains itself through a binding cycle.'],
    fixes: ['Break the cycle in the resource graph.'],
    reference: 'RFC 5842 §7.2',
    standard: true,
  },
  {
    code: 510,
    title: 'Not Extended',
    klass: '5xx',
    summary: 'Further extensions to the request are required for the server to fulfil it.',
    causes: ['An HTTP extension framework almost nothing implements.'],
    fixes: ['Effectively obsolete; treat as a server misconfiguration.'],
    reference: 'RFC 2774 §7',
    standard: true,
  },
  {
    code: 511,
    title: 'Network Authentication Required',
    klass: '5xx',
    summary: 'The client must authenticate to gain network access, as on a captive portal.',
    causes: ['Hotel, airport or café Wi-Fi intercepting traffic before you sign in.'],
    fixes: [
      'Open any plain HTTP page to trigger the portal. This status exists so intercepting proxies stop faking 200s.',
    ],
    reference: 'RFC 6585 §6',
    standard: true,
  },
  {
    code: 520,
    title: 'Web Server Returned an Unknown Error',
    klass: '5xx',
    summary: 'Cloudflare-specific: the origin returned something Cloudflare could not interpret.',
    causes: [
      'The origin returned an empty response, or a response with too many headers.',
      'The origin crashed mid-response, or reset the TCP connection.',
    ],
    fixes: [
      'Bypass Cloudflare (hit the origin IP directly with a `Host` header) to see the real response.',
      'Check origin logs for a crash at the same timestamp; 520 is almost always an origin bug.',
    ],
    reference: 'Cloudflare (non-standard)',
    standard: false,
  },
  {
    code: 521,
    title: 'Web Server Is Down',
    klass: '5xx',
    summary: 'Cloudflare-specific: the origin refused the connection.',
    causes: [
      'The origin process is not running.',
      'A firewall is blocking Cloudflare IP ranges.',
    ],
    fixes: [
      'Confirm the origin is listening, then allow Cloudflare IP ranges through the firewall.',
    ],
    reference: 'Cloudflare (non-standard)',
    standard: false,
  },
  {
    code: 522,
    title: 'Connection Timed Out',
    klass: '5xx',
    summary: 'Cloudflare-specific: the TCP handshake with the origin never completed.',
    causes: ['Packet loss, an overloaded origin, or a firewall dropping (not rejecting) packets.'],
    fixes: ['Check origin load and firewall rules; a drop shows as a timeout rather than a refusal.'],
    reference: 'Cloudflare (non-standard)',
    standard: false,
  },
  {
    code: 523,
    title: 'Origin Is Unreachable',
    klass: '5xx',
    summary: 'Cloudflare-specific: no route to the origin at all.',
    causes: ['A DNS record pointing at a dead or wrong IP address.'],
    fixes: ['Verify the A/AAAA record and that the IP is routable.'],
    reference: 'Cloudflare (non-standard)',
    standard: false,
  },
  {
    code: 524,
    title: 'A Timeout Occurred',
    klass: '5xx',
    summary:
      'Cloudflare-specific: the connection succeeded but the origin did not respond within 100 seconds.',
    causes: ['A long-running request: a report, an export, a large upload being processed inline.'],
    fixes: [
      'Move the work to a background job and return immediately, or put the endpoint on a subdomain that bypasses the proxy.',
    ],
    reference: 'Cloudflare (non-standard)',
    standard: false,
  },
  {
    code: 525,
    title: 'SSL Handshake Failed',
    klass: '5xx',
    summary: 'Cloudflare-specific: the TLS handshake with the origin failed.',
    causes: [
      'No valid certificate on the origin while the SSL mode is Full (strict).',
      'A cipher or TLS-version mismatch.',
    ],
    fixes: ['Install a valid origin certificate, or switch the SSL mode to match what the origin supports.'],
    reference: 'Cloudflare (non-standard)',
    standard: false,
  },
  {
    code: 526,
    title: 'Invalid SSL Certificate',
    klass: '5xx',
    summary:
      'Cloudflare-specific: the origin certificate could not be validated under Full (strict) mode.',
    causes: ['A self-signed or expired origin certificate, or a hostname mismatch.'],
    fixes: ['Install a certificate from a trusted CA, or use a Cloudflare Origin CA certificate.'],
    reference: 'Cloudflare (non-standard)',
    standard: false,
  },
]

export const STATUS_BY_CODE: Map<number, HttpStatus> = new Map(
  HTTP_STATUSES.map((status) => [status.code, status]),
)

export function statusClassOf(code: number): StatusClass {
  if (code < 200) return '1xx'
  if (code < 300) return '2xx'
  if (code < 400) return '3xx'
  if (code < 500) return '4xx'
  return '5xx'
}
