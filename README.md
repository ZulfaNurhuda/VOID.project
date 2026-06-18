<div align="center">
  <img src="frontend/public/icons/void.svg" width="80" alt="VOID logo" />
  <h1>VOID</h1>
  <p>Vault-Oriented Infrastructure for Developers — light-speed deployment, black-hole security.</p>

  ![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go&logoColor=white)
  ![Rust](https://img.shields.io/badge/Rust-CLI-CE422B?style=flat-square&logo=rust&logoColor=white)
  ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=flat-square&logo=postgresql&logoColor=white)
  ![Redis](https://img.shields.io/badge/Redis-7+-DC382D?style=flat-square&logo=redis&logoColor=white)
  ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
  ![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)
  ![Part of AEGIS](https://img.shields.io/badge/Part%20of-AEGIS-22d3ee?style=flat-square)
</div>

---

Tired of `.env` files floating around in Slack messages, shared Google Docs, and your teammates' Notes apps? Yeah, same. VOID fixes that. Store every secret your team touches in one encrypted, audited, access-controlled place — then inject them straight into your processes with a single CLI command. No plaintext leaves the client. No secrets live in your shell history. No more "wait, which DB password are we using again?" 🔐

VOID is part of the [AEGIS](https://github.com/ZulfaNurhuda/AEGIS.project) secure credential infrastructure suite alongside [NOVA](https://github.com/ZulfaNurhuda/NOVA.project).

---

### **📋・Table of Contents**

- **✨・<a href="#what-is-void" style="text-decoration: none;">What is VOID?</a>**
- **🌟・<a href="#features" style="text-decoration: none;">Features</a>**
- **🛠️・<a href="#tech-stack" style="text-decoration: none;">Tech Stack</a>**
- **🏗️・<a href="#architecture" style="text-decoration: none;">Architecture</a>**
- **💻・<a href="#cli-reference" style="text-decoration: none;">CLI Reference</a>**
- **🔑・<a href="#rbac" style="text-decoration: none;">RBAC</a>**
- **🚀・<a href="#getting-started" style="text-decoration: none;">Getting Started</a>**
- **⚙️・<a href="#environment-variables" style="text-decoration: none;">Environment Variables</a>**
- **🔐・<a href="#security" style="text-decoration: none;">Security</a>**
- **📜・<a href="#license" style="text-decoration: none;">License</a>**

---

### <div id="what-is-void">**✨・What is VOID? (Your Secrets Deserve Better 🗝️)**</div>

VOID (Vault-Oriented Infrastructure for Developers) is a self-hosted, open-source secrets management platform built for developer teams that want full ownership over their credentials infrastructure. Think of it as your team's private secret vault — organized by workspace, app, and environment — with end-to-end encryption baked in at the architecture level.

The key idea: **the server never sees your plaintext secrets. Ever.** Encryption and decryption happen entirely on the client — whether that's the web console or the Rust CLI. What VOID stores is ciphertext, and what it gives your processes is a clean environment. That's zero-knowledge, done properly, with no asterisks. 🛡️

---

### <div id="features">**🌟・Features (The Whole Arsenal 🚀)**</div>

- **🔐 End-to-end encryption** — secrets encrypted client-side; server only ever touches ciphertext
- **🗂️ Hierarchical organization** — Workspace → Apps → Environments → Secrets, clean and intuitive
- **👥 Team collaboration** — invite members, assign roles, manage access per workspace
- **🏠 Personal workspaces** — every user gets a private workspace the moment they register
- **⚡ Rust CLI** — inject secrets into any process with `void run -- <your command>`
- **📜 Secret history** — every change is versioned; roll back to any previous value anytime
- **📥 Import / Export** — `.env` and JSON, because standards matter
- **🔍 Audit logs** — full tamper-evident trail of every action: who, what, when, from where
- **🔒 RBAC** — Owner / Admin / Member roles with a clean permission matrix
- **🐳 Self-hostable** — full Docker Compose stack, zero cloud dependency, yours forever

---

### <div id="tech-stack">**🛠️・Tech Stack (Powered by Some Seriously Good Tools ⚙️)**</div>

| Layer | Technology |
|---|---|
| Backend | [Go](https://go.dev) 1.22+ · [Gin](https://gin-gonic.com) HTTP framework |
| Database | [PostgreSQL](https://www.postgresql.org) 15+ · [sqlc](https://sqlc.dev) (type-safe SQL, no ORM) |
| Cache / Sessions | [Redis](https://redis.io) 7+ |
| Crypto | ChaCha20-Poly1305 · X25519 ECDH · Argon2id · JWT RS256 |
| CLI | [Rust](https://www.rust-lang.org) · [clap](https://docs.rs/clap) · [ring](https://docs.rs/ring) · [reqwest](https://docs.rs/reqwest) · tokio · zeroize |
| Frontend | [React](https://react.dev) 19 · [TanStack Router](https://tanstack.com/router) · [TanStack Query](https://tanstack.com/query) |
| UI | Tailwind CSS · [shadcn/ui](https://ui.shadcn.com) · Lucide React |
| Client Crypto | [@noble/ciphers](https://github.com/paulmillr/noble-ciphers) + [@noble/curves](https://github.com/paulmillr/noble-curves) |
| Reverse Proxy | Nginx (Docker) |

---

### <div id="architecture">**🏗️・Architecture (How the Magic Flows 🌊)**</div>

#### **Data Hierarchy**

Everything in VOID lives inside a clean, predictable hierarchy. No flat lists, no namespace collisions:

```
Workspace (Team or Personal)
└── Apps          (e.g. api-service, web-app, worker)
    └── Environments  (e.g. dev, staging, prod)
        └── Secrets   (KEY=encrypted_value)
```

#### **Encryption Model**

This is the part that makes VOID genuinely zero-knowledge. Here's exactly what happens — no hand-waving:

```
Registration
  └── X25519 key pair generated in the browser
      ├── Public key   → sent to and stored on server
      └── Private key  → encrypted with Argon2id(password), stored on server

Writing a secret (browser/CLI)
  └── Decrypt private key with password (prompt once, cache briefly)
      └── Decrypt workspace symmetric key via X25519 ECDH
          └── Encrypt secret value with ChaCha20-Poly1305
              └── POST ciphertext → server stores it, sees nothing

Reading a secret (browser/CLI)
  └── GET encrypted blobs from server
      └── Decrypt symmetric key with private key (X25519)
          └── Decrypt each secret (ChaCha20-Poly1305)
              └── Inject into process env / display in UI
```

At no point does the server hold a key that could decrypt your secrets. Period. 🔒

---

### <div id="cli-reference">**💻・CLI Reference (Your New Favourite Tool 🦀)**</div>

The VOID CLI is a standalone Rust binary — no runtime, no dependencies, just grab it and go.

**Get the CLI:**

Pre-built binaries for Linux x86_64, macOS (Apple Silicon + Intel), and Windows x64 are on the [Releases](https://github.com/ZulfaNurhuda/VOID.project/releases) page. Or build from source if you prefer:

```bash
cd cli
cargo build --release
# Binary: target/release/void (Linux/macOS) or target\release\void.exe (Windows)
```

```bash
# Authentication
void auth [--email EMAIL] [--password PASS]
void logout
void whoami

# Initialize a project (creates .void.json in current directory)
void init [--team TEAM] [--app APP] [--env ENV]

# Secrets CRUD
void secrets list   [--app APP] [--env ENV] [--team TEAM] [--keys-only]
void secrets get    KEY [KEY2...]
void secrets create --key KEY --value VALUE
void secrets create --key KEY --generate [--type alphanumeric|hex|base64] [--length 32]
void secrets update --key KEY --value VALUE
void secrets delete --key KEY [--force]
void secrets import .env  [--merge]
void secrets export       [--format env|json] [--file FILE]

# The star of the show — inject secrets and run anything
void run   [--app APP] [--env ENV] [--team TEAM] -- COMMAND [ARGS...]
void shell [--app APP] [--env ENV] [--team TEAM]

# Navigation
void teams list
void apps  list [--team TEAM]
void envs  list [--app APP] [--team TEAM]
```

**Example — inject production secrets into a Node.js app:** 🚀
```bash
void run --team acme --app api --env prod -- node server.js
```

VOID decrypts your secrets, injects them as environment variables, spawns the process, and zeroes memory the moment the process exits. Clean, surgical, no leaks.

---

### <div id="rbac">**🔑・RBAC (Who Can Do What 👮)**</div>

VOID uses a simple three-tier role system per workspace. No granular per-environment weirdness — just clear, predictable rules:

| Permission | Member | Admin | Owner |
|---|:---:|:---:|:---:|
| Read all secrets | ✅ | ✅ | ✅ |
| Create / update own secret | ✅ | ✅ | ✅ |
| Update / delete any secret | — | ✅ | ✅ |
| Create / delete environment | — | ✅ | ✅ |
| Create / delete app | — | ✅ | ✅ |
| Add / remove member | — | ✅ | ✅ |
| Change member role | — | ✅ | ✅ |
| View audit logs | ✅ | ✅ | ✅ |
| Delete team | — | — | ✅ |

> The Owner is always the workspace creator — implicit, not a database row. Owner cannot be demoted or removed by anyone, including themselves.

---

### <div id="getting-started">**🚀・Getting Started (Let's Get Your Secrets Sorted! 🎉)**</div>

#### **Option 1: Docker Compose (The Smooth Path 🐳)**

**Prerequisites:** Docker with the Compose plugin.

**1. Clone the repo:**
```bash
git clone https://github.com/ZulfaNurhuda/VOID.project.git
cd VOID.project
```

**2. Configure your environment:**
```bash
cp .env.example .env
# Fill in: DB credentials, SESSION_SECRET, JWT_SECRET, VOID_BASE_URL
```

**3a. Base stack** (bring your own PostgreSQL 15+ and Redis 7+):
```bash
docker compose up -d
```

**3b. Full stack** (includes PostgreSQL + Redis — great for getting started fast!):
```bash
cp compose.override.yml.disabled compose.override.yml
docker compose up -d
```

To update:
```bash
docker compose pull && docker compose up -d --build
```

#### **Option 2: Local Development (For the Tinkerers 🔧)**

**Prerequisites:** Go 1.22+, Rust 1.75+, Node.js 20+, PostgreSQL 15+, Redis 7+

```bash
# Backend
cd backend && go mod download && go run cmd/server/main.go

# Frontend — second terminal
cd frontend && npm install && npm run dev

# CLI — third terminal
cd cli && cargo run -- auth
```

---

### <div id="environment-variables">**⚙️・Environment Variables (Tune It to Your Heart's Content 🎛️)**</div>

Copy `.env.example` to `.env`. Variables marked **Required** must be set — VOID will refuse to start without them, saving you from mysterious runtime errors later. You're welcome. 😄

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_HOST` | **Yes** | — | PostgreSQL host |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_NAME` | **Yes** | — | Database name |
| `DB_USER` | **Yes** | — | Database user |
| `DB_PASSWORD` | **Yes** | — | Database password |
| `DB_SSLMODE` | No | `disable` | PostgreSQL SSL mode |
| `REDIS_HOST` | **Yes** | — | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `SESSION_SECRET` | **Yes** | — | Session signing secret (min 64 chars). Generate: `openssl rand -base64 64` |
| `JWT_SECRET` | **Yes** | — | JWT signing secret. Generate: `openssl rand -base64 32` |
| `VOID_BASE_URL` | **Yes** | — | Public base URL of the API |
| `API_HOST` | **Yes** | — | API host referenced by the frontend |
| `ENVIRONMENT` | No | `production` | `development` or `production` |
| `COMPOSE_PROJECT_NAME` | No | `void` | Docker Compose project name |

---

### <div id="security">**🔐・Security (Zero-Knowledge Is Not a Marketing Slogan Here 🛡️)**</div>

Every security decision in VOID was made deliberately. Here's the full picture:

| Feature | Implementation |
|---|---|
| Secret encryption at rest | ChaCha20-Poly1305 (AEAD, unique random nonce per secret) |
| Key exchange | X25519 ECDH — workspace symmetric key encrypted individually per member |
| Password hashing | Argon2id (t=2, m=65540, p=1 — OWASP recommended parameters) |
| JWT signing | RS256 — access token 15 min, refresh token 7 days |
| Private key storage | ChaCha20-Poly1305 encrypted with a key derived from user password |
| Transport security | TLS 1.3 minimum, enforced at the Nginx layer |
| Zero-knowledge guarantee | Server processes only ciphertext — no plaintext secret ever transits or rests server-side |
| Rate limiting | Redis-backed per-IP limits on all auth and sensitive endpoints |
| Audit trail | Immutable log: actor, IP, resource type, resource ID, timestamp — for every action |

---

### <div id="license">**📜・License (The Legal Bits, but Still Friendly! 🤝)**</div>

This project is open-source and proudly distributed under the **MIT License**. That means you're completely free to explore, use, modify, self-host, and build on top of VOID — whether for your own team, a side project, or something we haven't imagined yet! You can find all the nitty-gritty legal details in the [LICENSE](LICENSE) file. Happy hacking! 🚀

---

<div align="center">
  <sub>Part of the <a href="https://github.com/ZulfaNurhuda/AEGIS.project">AEGIS</a> secure credential infrastructure suite</sub>
</div>
