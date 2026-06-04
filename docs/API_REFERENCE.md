# API Reference

Complete reference for all AdGen REST API endpoints. All endpoints are served from the Next.js App Router under `/api/`.

---

## Table of Contents

- [Authentication](#authentication)
- [Projects](#projects)
  - [PUT /api/projects/:id](#put-apiprojectsid)
- [Asset Upload](#asset-upload)
  - [POST /api/upload](#post-apiupload)
- [Export](#export)
  - [GET /api/export/render](#get-apiexportrender)
  - [GET /api/export/pdf](#get-apiexportpdf)
  - [GET /api/export/overlay](#get-apiexportoverlay)
  - [GET /api/export/package](#get-apiexportpackage)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)

---

## Authentication

All API endpoints require authentication. The auth mechanism depends on the environment:

### Development Mode

When `ADGEN_AUTH_SECRET` is **not set** and `NODE_ENV` is not `production`, requests are automatically authenticated as a development user.

You can override the dev user identity with headers:

| Header | Default | Description |
|---|---|---|
| `x-user-id` | `dev_user` | User ID for the request |
| `x-user-role` | `admin` | User role (`admin` or `user`) |

Or with environment variables:

| Variable | Default | Description |
|---|---|---|
| `ADGEN_DEV_USER_ID` | `dev_user` | Default dev user ID |
| `ADGEN_DEV_USER_ROLE` | `admin` | Default dev user role |

### Production Mode

Set `ADGEN_AUTH_SECRET` to enable HMAC-signed session cookies.

The session cookie (`adgen_session`) contains a base64url-encoded JSON payload signed with HMAC-SHA256:

```json
{
  "userId": "user_123",
  "role": "admin",
  "exp": 1735689600
}
```

Session format: `<base64url_payload>.<base64url_hmac_signature>`

Maximum session TTL: **30 days**.

### Authorization

- **Admin users** can access any project.
- **Regular users** can only access projects where `ownerId` matches their user ID.

### Unauthorized Response

All endpoints return this when authentication fails:

```json
{
  "error": "Unauthorized"
}
```

---

## Projects

### PUT /api/projects/:id

Update an existing project's content and metadata.

**URL Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | The project ID |

**Request Body:**

The full project object conforming to the `ProjectSchema` (Zod-validated). The `id` in the body must match the URL parameter.

```json
{
  "id": "project_cfc_tactical_board",
  "name": "CFC Tactical Handgun Board",
  "schemaVersion": "1.0.0",
  "type": "inventory_board",
  "canvas": {
    "id": "poster_11x17",
    "name": "Poster 11x17",
    "widthPx": 3300,
    "heightPx": 5100,
    "dpi": 300,
    "safeMarginPx": 120,
    "unit": "in"
  },
  "brand": { "..." },
  "content": { "..." },
  "layout": { "..." },
  "exportSettings": { "..." }
}
```

**Responses:**

| Status | Description |
|---|---|
| `200` | Project updated successfully |
| `400` | Invalid project data or ID mismatch |
| `401` | Unauthorized |
| `403` | User does not own this project |
| `404` | Project not found |
| `500` | Internal server error |

**Success Response:**

```json
{
  "success": true,
  "project": { "...validated project data..." }
}
```

**Error Response:**

```json
{
  "error": "Invalid project data",
  "details": { "...Zod error format..." }
}
```

---

## Asset Upload

### POST /api/upload

Upload one or more image files. Files are validated via magic bytes, processed through Sharp (EXIF stripped, orientation normalized), and stored with UUID filenames.

**Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File(s) | Yes | One or more image files (JPEG, PNG, or WebP) |

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `bulk` | string | `false` | Set to `true` for multi-file uploads (increases size limit to 50MB total) |

**Constraints:**

| Constraint | Limit |
|---|---|
| Max file size (single) | 10 MB |
| Max total size (bulk) | 50 MB |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Max image dimensions | 8000 × 8000 px |

**Responses:**

| Status | Description |
|---|---|
| `200` | Upload successful |
| `400` | Invalid file, unsupported type, size exceeded, or image too large |
| `401` | Unauthorized |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

**Success Response (single file):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "product-photo.jpg",
  "type": "image",
  "filePath": "/uploads/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 102400,
  "width": 1200,
  "height": 900,
  "focalPointX": 0.5,
  "focalPointY": 0.5,
  "createdAt": "2026-06-04T00:00:00.000Z",
  "updatedAt": "2026-06-04T00:00:00.000Z"
}
```

**Success Response (bulk mode):**

Returns an array of asset objects.

**Security Features:**

- Magic-byte (file-type) validation — extensions are not trusted
- EXIF metadata is stripped to protect user privacy
- EXIF orientation is applied before stripping
- Files are renamed to UUIDs to prevent directory traversal
- Image dimensions are capped at 8000px to prevent decompression bombs
- Failed uploads trigger automatic rollback (file + database cleanup)

---

## Export

All export endpoints are `GET` requests. They use Playwright headless browser rendering for pixel-perfect output.

### GET /api/export/render

Render the project layout as a high-resolution PNG image.

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|---|---|---|---|---|
| `id` | string | Yes | — | Project ID |
| `mode` | string | Yes | `full`, `background_only` | Render mode |

- **`full`** — Renders the complete layout with all text, images, and elements.
- **`background_only`** — Renders the layout skeleton with text replaced by gray placeholder blocks. Designed for AI handoff.

**Responses:**

| Status | Content-Type | Description |
|---|---|---|
| `200` | `image/png` | PNG image binary |
| `400` | `application/json` | Missing or invalid parameters |
| `401` | `application/json` | Unauthorized |
| `403` | `application/json` | Forbidden (not project owner) |
| `404` | `application/json` | Project not found |
| `429` | `application/json` | Rate limit exceeded |
| `500` | `application/json` | Internal server error |

**Example:**

```
GET /api/export/render?id=project_cfc_tactical_board&mode=full
```

---

### GET /api/export/pdf

Export the project layout as a vector-quality PDF file with selectable text.

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Project ID |

**Responses:**

| Status | Content-Type | Description |
|---|---|---|
| `200` | `application/pdf` | PDF file download |
| `400` | `application/json` | Missing parameters |
| `401` | `application/json` | Unauthorized |
| `403` | `application/json` | Forbidden |
| `404` | `application/json` | Project not found |
| `429` | `application/json` | Rate limit exceeded |
| `500` | `application/json` | Internal server error |

**Response Headers:**

```
Content-Disposition: attachment; filename="flyer-{projectId}.pdf"
```

**Example:**

```
GET /api/export/pdf?id=project_cfc_tactical_board
```

---

### GET /api/export/overlay

Export the exact text overlay as a transparent PNG or SVG.

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|---|---|---|---|---|
| `id` | string | Yes | — | Project ID |
| `format` | string | Yes | `png`, `svg` | Output format |

- **`png`** — Transparent PNG with exact text rendered at canvas resolution.
- **`svg`** — Scalable vector graphic with text paths.

**Responses:**

| Status | Content-Type | Description |
|---|---|---|
| `200` | `image/png` or `image/svg+xml` | Overlay image |
| `400` | `application/json` | Missing or invalid parameters |
| `401` | `application/json` | Unauthorized |
| `403` | `application/json` | Forbidden |
| `404` | `application/json` | Project not found |
| `429` | `application/json` | Rate limit exceeded |
| `500` | `application/json` | Internal server error |

**Example:**

```
GET /api/export/overlay?id=project_cfc_tactical_board&format=svg
```

---

### GET /api/export/package

Generate and download the complete AI handoff ZIP package.

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Project ID |

**Responses:**

| Status | Content-Type | Description |
|---|---|---|
| `200` | `application/zip` | ZIP file download |
| `400` | `application/json` | Missing parameters |
| `401` | `application/json` | Unauthorized |
| `403` | `application/json` | Forbidden |
| `404` | `application/json` | Project not found |
| `429` | `application/json` | Rate limit exceeded |
| `500` | `application/json` | Internal server error |

**Response Headers:**

```
Content-Disposition: attachment; filename="handoff-{projectId}.zip"
```

**ZIP Contents:**

```
handoff-{projectId}.zip
├── README.md                          # Workflow instructions
├── prompt.md                          # AI visual design prompt
├── negative-prompt.txt                # AI negative prompt
├── rough-layout.png                   # Full rough layout
├── rough-layout-background-only.png   # Text-masked layout
├── exact-text-overlay.svg             # Transparent text overlay
├── exact-text-overlay.png             # Transparent text overlay (raster)
├── project.json                       # Full project data
├── content.json                       # Items and sections
├── layout.json                        # Computed coordinates
├── brand.json                         # Brand profile
└── assets/                            # Product images and logos
```

**Example:**

```
GET /api/export/package?id=project_cfc_tactical_board
```

---

## Error Responses

All error responses follow a consistent format:

```json
{
  "error": "Human-readable error message"
}
```

Some validation errors include additional detail:

```json
{
  "error": "Invalid project data",
  "details": {
    "_errors": [],
    "name": { "_errors": ["Required"] }
  }
}
```

### Standard HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `400` | Bad request (missing/invalid parameters) |
| `401` | Unauthorized (no valid session) |
| `403` | Forbidden (authenticated but no access to resource) |
| `404` | Resource not found |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Rate Limiting

API endpoints are protected by in-memory rate limiters:

| Limiter | Scope | Behavior |
|---|---|---|
| **Upload rate limiter** | Per user ID | Limits the frequency of asset uploads |
| **Export rate limiter** | Per user ID (or IP for unauthenticated) | Limits the frequency of render/export operations |

When rate limited, the API returns:

```json
{
  "error": "Too Many Requests"
}
```

Rate limits are applied per-user in authenticated contexts. In development mode without auth, they key on the `x-forwarded-for` header, `x-real-ip` header, or fall back to `"anonymous"`.
